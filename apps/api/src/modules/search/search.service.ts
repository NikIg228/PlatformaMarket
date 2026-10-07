import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CompareOffersInput,
  SearchCatalogInput,
} from "@marketplace/schemas";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { expandDentalSearchQuery } from "./dental-search-lexicon";
import { SearchAnalyticsService } from "./search-analytics.service";
import { resolvePriceRules } from "../pricing/price-resolver";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { MediaAccessService } from "../../platform/storage/media-access.service";
import { scopeMatches } from "../promotions/promotion-engine";
import { environment } from "../../platform/config/environment";
import { SupplierTermsService } from "../agreements/supplier-terms.service";
import { visibleOfferSummary } from "./visible-offer-summary";
import { catalogSaleJoin } from "./catalog-sale-query";
import { publicContactSelect, publicOrganizationContact } from "../organizations/contact-projection";

type SearchRow = { productId: string; rank: number };
type PublicSearchPromotion = {
  id: string;
  supplierOrganizationId: string;
  name: string;
  percentageBasisPoints: number | null;
  scope: Prisma.JsonValue;
  endsAt: Date;
  sponsorshipLabel: string | null;
  offerId: string | null;
  baseAmountMinor: Prisma.Decimal | null;
  currency: string | null;
};
const publicVariant = (variant: {
  id: string;
  sku: string | null;
  gtin: string | null;
  externalMetadata: Prisma.JsonValue;
}) => {
  const metadata =
    variant.externalMetadata &&
    typeof variant.externalMetadata === "object" &&
    !Array.isArray(variant.externalMetadata)
      ? (variant.externalMetadata as Record<string, unknown>)
      : {};
  return {
    id: variant.id,
    sku: variant.sku,
    gtin: variant.gtin,
    label:
      typeof metadata.label === "string"
        ? metadata.label
        : variant.sku
          ? `REF ${variant.sku}`
          : "Стандартный вариант",
    attributes:
      metadata.attributes &&
      typeof metadata.attributes === "object" &&
      !Array.isArray(metadata.attributes)
        ? metadata.attributes
        : {},
  };
};

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: SearchAnalyticsService,
    private readonly mediaAccess: MediaAccessService,
    private readonly terms: SupplierTermsService,
  ) {}

  async publicCities() {
    return this.prisma.city.findMany({
      select: { id: true, nameRu: true, region: { select: { nameRu: true } } },
      orderBy: [{ nameRu: "asc" }],
    });
  }

  private async assertBuyer(
    buyerOrganizationId: string,
    context: SupplierActorContext,
  ) {
    const [operatorCapability, buyer] = await Promise.all([
      this.prisma.organizationCapability.findUnique({
        where: {
          organizationId_capability: {
            organizationId: context.organizationId,
            capability: "MARKETPLACE_OPERATOR",
          },
        },
      }),
      this.prisma.organization.findUnique({
        where: { id: buyerOrganizationId },
        include: { capabilities: true },
      }),
    ]);
    const operator = Boolean(operatorCapability);
    if (buyerOrganizationId !== context.organizationId && !operator)
      throw new ForbiddenException(
        "Buyer search belongs to another organization",
      );
    if (
      !buyer ||
      !buyer.capabilities.some(({ capability }) => capability === "BUYER")
    )
      throw new NotFoundException("Buyer organization not found");
  }

  async search(input: SearchCatalogInput, context: SupplierActorContext) {
    await this.assertBuyer(input.buyerOrganizationId, context);
    const admittedSuppliers = await this.terms.activeSupplierIds();
    const pilotProfile = environment().DEPLOYMENT_PROFILE === "pilot";
    const saleBasis = input.priceBasis === "SALE_UNIT";
    const saleJoin = saleBasis ? catalogSaleJoin(input, admittedSuppliers) : Prisma.empty;
    if (input.minSalePriceMinor && input.maxSalePriceMinor && BigInt(input.minSalePriceMinor) > BigInt(input.maxSalePriceMinor))
      throw new BadRequestException("Minimum price exceeds maximum price");
    const searchIntent = expandDentalSearchQuery(input.q);
    const q = searchIntent.normalizedQuery;
    const expandedQuery = searchIntent.expandedQuery;
    let attributeFilters: Record<string, unknown> = {};
    if (input.attributeFilters) {
      try {
        const parsed: unknown = JSON.parse(input.attributeFilters);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("not an object");
        attributeFilters = parsed as Record<string, unknown>;
      } catch {
        throw new BadRequestException("attributeFilters must be a JSON object");
      }
    }
    const where: Prisma.Sql[] = [
      Prisma.sql`p.status = 'ACTIVE'`,
      admittedSuppliers.length ? Prisma.sql`d."supplierIds" && ARRAY[${Prisma.join(admittedSuppliers.map((id) => Prisma.sql`${id}::uuid`))}]` : Prisma.sql`FALSE`,
    ];
    if (pilotProfile)
      where.push(
        Prisma.sql`p."externalMetadata" ->> 'importedAsCanonicalDraft' = 'true'`,
      );
    if (q)
      where.push(
        Prisma.sql`(d."searchVector" @@ websearch_to_tsquery('simple', ${expandedQuery}) OR d."normalizedText" % ${q})`,
      );
    if (input.categoryId)
      where.push(
        Prisma.sql`EXISTS (WITH RECURSIVE tree AS (SELECT id FROM "Category" WHERE id = ${input.categoryId}::uuid UNION ALL SELECT c.id FROM "Category" c JOIN tree t ON c."parentId" = t.id) SELECT 1 FROM tree WHERE tree.id = ANY(d."categoryIds"))`,
      );
    if (input.industryId)
      where.push(
        Prisma.sql`CAST(${input.industryId} AS uuid) = ANY(d."industryIds")`,
      );
    if (input.brandId)
      where.push(Prisma.sql`p."brandId" = CAST(${input.brandId} AS uuid)`);
    if (input.brandName) where.push(Prisma.sql`EXISTS (SELECT 1 FROM "Brand" b WHERE b.id = p."brandId" AND b.name = ${input.brandName})`);
    if (input.categoryName) where.push(Prisma.sql`EXISTS (SELECT 1 FROM "Category" c WHERE c.id = ANY(d."categoryIds") AND c."nameRu" = ${input.categoryName})`);
    if (input.manufacturerId)
      where.push(
        Prisma.sql`p."manufacturerId" = CAST(${input.manufacturerId} AS uuid)`,
      );
    if (input.supplierOrganizationId)
      where.push(
        Prisma.sql`CAST(${input.supplierOrganizationId} AS uuid) = ANY(d."supplierIds")`,
      );
    if (input.cityId && !saleBasis)
      where.push(Prisma.sql`CAST(${input.cityId} AS uuid) = ANY(d."cityIds")`);
    if (input.warehouseId)
      where.push(
        Prisma.sql`CAST(${input.warehouseId} AS uuid) = ANY(d."warehouseIds")`,
      );
    if (input.deliveryMethod)
      where.push(
        Prisma.sql`${input.deliveryMethod} = ANY(d."deliveryMethods")`,
      );
    if (input.unit && !saleBasis)
      where.push(
        Prisma.sql`d."normalizedText" ILIKE ${`%${this.normalizeFilter(input.unit)}%`}`,
      );
    if (input.packaging && !saleBasis)
      where.push(
        Prisma.sql`d."normalizedText" ILIKE ${`%${this.normalizeFilter(input.packaging)}%`}`,
      );
    if (input.inStock !== undefined && !saleBasis)
      where.push(Prisma.sql`d."isAvailable" = ${input.inStock}`);
    if (saleBasis) {
      where.push(Prisma.sql`sale."offerCount" > 0`);
      if (input.inStock !== undefined) where.push(Prisma.sql`sale.available = ${input.inStock}`);
      if (input.minSalePriceMinor) where.push(Prisma.sql`sale.price >= ${input.minSalePriceMinor}::numeric`);
      if (input.maxSalePriceMinor) where.push(Prisma.sql`sale.price <= ${input.maxSalePriceMinor}::numeric`);
    }
    if (input.minNormalizedPriceMinor !== undefined)
      where.push(
        Prisma.sql`d."maxNormalizedPriceMinor" >= ${input.minNormalizedPriceMinor}`,
      );
    if (input.maxNormalizedPriceMinor !== undefined)
      where.push(
        Prisma.sql`d."minNormalizedPriceMinor" <= ${input.maxNormalizedPriceMinor}`,
      );
    if (Object.keys(attributeFilters).length > 0)
      where.push(
        Prisma.sql`(d.facets -> 'attributes') @> CAST(${JSON.stringify(attributeFilters)} AS jsonb)`,
      );
    const condition = Prisma.join(where, " AND ");
    const rank = q
      ? Prisma.sql`GREATEST(ts_rank(d."searchVector", websearch_to_tsquery('simple', ${expandedQuery})), similarity(d."normalizedText", ${q})) + CASE WHEN d."normalizedText" = ${q} THEN 1.0 WHEN d."normalizedText" ILIKE ${`%${q}%`} THEN 0.2 ELSE 0 END`
      : Prisma.sql`0::real`;
    const sort = (
      {
        RELEVANCE: Prisma.sql`rank DESC, d."isAvailable" DESC, d."updatedAt" DESC`,
        PRICE_ASC: saleBasis ? Prisma.sql`sale.price ASC NULLS LAST` : Prisma.sql`d."minNormalizedPriceMinor" ASC NULLS LAST, d."isAvailable" DESC`,
        PRICE_DESC: saleBasis ? Prisma.sql`sale.price DESC NULLS LAST` : Prisma.sql`d."minNormalizedPriceMinor" DESC NULLS LAST, d."isAvailable" DESC`,
        NAME_ASC: Prisma.sql`p."canonicalName" ASC`,
        UPDATED_DESC: Prisma.sql`d."updatedAt" DESC`,
      } as const
    )[input.sort];
    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<SearchRow[]>(
        Prisma.sql`SELECT d."productId", ${rank} AS rank FROM "ProductSearchDocument" d JOIN "Product" p ON p.id = d."productId" ${saleJoin} WHERE ${condition} ORDER BY ${sort}, p.id LIMIT ${input.limit} OFFSET ${input.offset}`,
      ),
      this.prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM "ProductSearchDocument" d JOIN "Product" p ON p.id = d."productId" ${saleJoin} WHERE ${condition}`,
      ),
    ]);
    const products = await this.loadSearchProducts(
      rows.map(({ productId }) => productId),
    );
    const supplierIds = [
      ...new Set(
        products.flatMap((product) =>
          product.variants.flatMap((variant) =>
            variant.supplierOffers.map((offer) => offer.supplierOrganizationId),
          ),
        ),
      ),
    ];
    const promotions: PublicSearchPromotion[] =
      !pilotProfile && supplierIds.length
        ? await this.prisma.promotion.findMany({
            where: {
              supplierOrganizationId: { in: supplierIds },
              status: "ACTIVE",
              moderationStatus: "APPROVED",
              approvedRevision: { equals: this.prisma.promotion.fields.termsRevision },
              claimedQuantity: { lt: this.prisma.promotion.fields.quantityLimit },
              kind: "PERCENTAGE",
              isPrivate: false,
              couponCodeHash: null,
              startsAt: { lte: new Date() },
              endsAt: { gt: new Date() },
            },
            select: {
              id: true,
              supplierOrganizationId: true,
              name: true,
              percentageBasisPoints: true,
              scope: true,
              endsAt: true,
              sponsorshipLabel: true,
              offerId: true,
              baseAmountMinor: true,
              currency: true,
            },
            orderBy: [{ percentageBasisPoints: "desc" }, { endsAt: "asc" }],
          })
        : [];
    const reviewSummary = pilotProfile
      ? new Map<string, { count: number; averageRating: number | null }>()
      : await this.reviewSummaries(
          products.flatMap((product) => product.variants.map(({ id }) => id)),
        );
    const rankById = new Map(
      rows.map((row, index) => [
        row.productId,
        { rank: Number(row.rank), index },
      ]),
    );
    const items = products
      .map((product) =>
        this.toSearchItem(
          product,
          input,
          rankById.get(product.id)?.rank ?? 0,
          reviewSummary,
          promotions,
        ),
      )
      .sort(
        (left, right) =>
          (rankById.get(left.id)?.index ?? 0) -
          (rankById.get(right.id)?.index ?? 0),
      );
    const total = Number(countRows[0]?.count ?? 0);
    this.analytics.record(input.q, total, context);
    return {
      query: input.q,
      interpretedQuery: searchIntent.matchedAliases.length
        ? searchIntent.matchedAliases
        : undefined,
      total,
      offset: input.offset,
      limit: input.limit,
      items,
      facets: this.aggregateFacets(items),
      ...(input.includeFilterOptions === "true" ? { filterOptions: await this.filterOptions(input, admittedSuppliers, pilotProfile) } : {}),
    };
  }

  private normalizeFilter(value: string) {
    return value
      .toLocaleLowerCase("ru")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  private async filterOptions(input: SearchCatalogInput, admitted: string[], pilot: boolean) {
    // Unpaginated reference options, restricted to the caller's visible catalogue.
    // Never derive filter choices from the currently loaded page.
    const context = { ...input, supplierOrganizationId: undefined, packaging: undefined, unit: undefined, warehouseId: undefined, deliveryMethod: undefined };
    const rows = await this.prisma.$queryRaw<Array<{ id: string; brandId: string | null; manufacturerId: string | null; categoryIds: string[]; facets: Prisma.JsonValue }>>(Prisma.sql`
      SELECT p.id, p."brandId", p."manufacturerId", d."categoryIds", d.facets
      FROM "Product" p JOIN "ProductSearchDocument" d ON d."productId" = p.id
      ${catalogSaleJoin(context, admitted)} WHERE p.status = 'ACTIVE' AND sale."offerCount" > 0
      ${pilot ? Prisma.sql`AND p."externalMetadata" ->> 'importedAsCanonicalDraft' = 'true'` : Prisma.empty}`);
    const ids = rows.map(row => row.id);
    const [categories, brands, manufacturers, offers, definitions] = await Promise.all([
      this.prisma.category.findMany({ where: { status: "ACTIVE" }, select: { id: true, nameRu: true, parentId: true }, orderBy: { nameRu: "asc" } }),
      this.prisma.brand.findMany({ where: { id: { in: rows.flatMap(row => row.brandId ? [row.brandId] : []) } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.manufacturer.findMany({ where: { id: { in: rows.flatMap(row => row.manufacturerId ? [row.manufacturerId] : []) } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      this.prisma.supplierOffer.findMany({ where: { productVariant: { productId: { in: ids }, status: "ACTIVE" }, supplierOrganizationId: { in: admitted }, status: "ACTIVE", publication: { is: { marketplaceVisible: true, status: { in: ["PUBLISHED", "RESTRICTED"] } } } }, select: { supplierOrganizationId: true, supplier: { select: { organization: { select: { displayName: true } } } }, publication: { select: { allowedBuyerIds: true, allowedCityIds: true } }, packaging: { select: { name: true } }, saleUnit: { select: { nameRu: true } } } }),
      this.prisma.attributeDefinition.findMany({ where: { isFilterable: true }, select: { code: true, nameRu: true, options: { select: { code: true, labelRu: true } } } }),
    ]);
    const usedCategories = new Set(rows.flatMap(row => row.categoryIds));
    for (const id of [...usedCategories]) {
      let parent = categories.find(c => c.id === id)?.parentId;
      while (parent && !usedCategories.has(parent)) { usedCategories.add(parent); parent = categories.find(c => c.id === parent)?.parentId; }
    }
    const selected = new Set(input.categoryId ? [input.categoryId] : []);
    for (let size = -1; size !== selected.size;) { size = selected.size; for (const c of categories) if (c.parentId && selected.has(c.parentId)) selected.add(c.id); }
    const attributeRows = input.categoryId ? rows.filter(row => row.categoryIds.some(id => selected.has(id))) : [];
    const attributes = definitions.flatMap(def => {
      const values = new Map<string, string | number | boolean>();
      for (const row of attributeRows) {
        const facets = row.facets as { attributes?: Record<string, unknown> } | null;
        const value = facets?.attributes?.[def.code];
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") values.set(JSON.stringify(value), value);
      }
      return values.size ? [{ code: def.code, name: def.nameRu, values: [...values.values()].sort((a, b) => String(a).localeCompare(String(b), "ru")) }] : [];
    });
    const visible = offers.filter(offer => {
      const buyers = offer.publication?.allowedBuyerIds, cities = offer.publication?.allowedCityIds;
      return (!Array.isArray(buyers) || !buyers.length || buyers.includes(input.buyerOrganizationId)) && (!input.cityId || !Array.isArray(cities) || !cities.length || cities.includes(input.cityId));
    });
    return {
      categories: categories.filter(c => usedCategories.has(c.id)).map(c => ({ id: c.id, name: c.nameRu, parentId: c.parentId })), brands, manufacturers,
      suppliers: [...new Map(visible.map(o => [o.supplierOrganizationId, { id: o.supplierOrganizationId, name: o.supplier.organization.displayName }])).values()].sort((a, b) => a.name.localeCompare(b.name, "ru")),
      packaging: [...new Set(visible.map(o => o.packaging?.name ?? o.saleUnit?.nameRu).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, "ru")), attributes,
    };
  }

  async compare(input: CompareOffersInput, context: SupplierActorContext) {
    await this.assertBuyer(input.buyerOrganizationId, context);
    const products = await this.loadProducts(
      [input.productId],
      input.buyerOrganizationId,
      input.quantity,
    );
    const product = products[0];
    if (!product) throw new NotFoundException("Marketplace product not found");
    const now = new Date();
    const selectedVariants = input.variantId
      ? product.variants.filter(({ id }) => id === input.variantId)
      : product.variants;
    if (input.variantId && !selectedVariants.length)
      throw new NotFoundException("Product variant not found");
    const offers = selectedVariants
      .flatMap((variant) =>
        variant.supplierOffers.map((offer) => {
          const decision = resolvePriceRules({
            quantity: input.quantity,
            at: now,
            contracts: offer.contractPrices.map((price) => ({
              id: price.id,
              amountMinor: price.amountMinor.toString(),
              currency: price.currency,
              minimumQuantity: price.minimumQuantity.toString(),
              validFrom: price.validFrom,
              validTo: price.validTo,
              priority: price.priority,
            })),
            tiers: offer.priceTiers.map((price) => ({
              id: price.id,
              amountMinor: price.unitPriceMinor.toString(),
              currency: price.currency,
              minimumQuantity: price.minimumQuantity.toString(),
              maximumQuantity: price.maximumQuantity?.toString(),
              validFrom: price.validFrom,
              validTo: price.validTo,
            })),
            base: offer.prices[0]
              ? {
                  id: offer.prices[0].id,
                  amountMinor: offer.prices[0].amountMinor.toString(),
                  currency: offer.prices[0].currency,
                  validFrom: offer.prices[0].validFrom,
                  validTo: offer.prices[0].validTo,
                }
              : null,
          });
          if (decision.source === "UNAVAILABLE" || !decision.amountMinor)
            return null;
          const baseUnits = new Prisma.Decimal(
            offer.packaging?.quantityInBaseUnit ?? offer.baseUnitsPerSaleUnit,
          );
          const normalizedPriceMinor = new Prisma.Decimal(
            decision.amountMinor,
          ).div(baseUnits);
          const balances = offer.inventoryBalances.filter(
            (balance) =>
              (!input.cityId || balance.warehouse.cityId === input.cityId) &&
              balance.freshnessStatus === "FRESH" &&
              (!balance.freshnessExpiresAt || balance.freshnessExpiresAt > now) &&
              Number(balance.quantityAvailable) > 0,
          );
          const delivery = offer.deliveryOptions.filter(
            (option) =>
              !input.cityId ||
              option.method === "NATIONWIDE" ||
              option.method === "CARRIER" ||
              balances.some(
                ({ warehouseId }) => warehouseId === option.warehouseId,
              ),
          );
          const latestCompliance = offer.complianceChecks[0] ?? null;
          const regulatory =
            offer.supplier.regulatoryDetails &&
            typeof offer.supplier.regulatoryDetails === "object" &&
            !Array.isArray(offer.supplier.regulatoryDetails)
              ? (offer.supplier.regulatoryDetails as Record<string, unknown>)
              : {};
          return {
            offerId: offer.id,
            variantId: variant.id,
            supplier: {
              organizationId: offer.supplierOrganizationId,
              name: offer.supplier.organization.displayName,
              publicContact: publicOrganizationContact(offer.supplier.organization.profile),
            },
            supplierSku: offer.supplierSku,
            price: {
              amountMinor: decision.amountMinor,
              currency: decision.currency,
              source: decision.source,
              normalizedPriceMinor: normalizedPriceMinor.toFixed(6),
              baseUnits: baseUnits.toString(),
              normalizedUnit: product.baseUnit?.symbol ?? "base unit",
            },
            packaging: offer.packaging
              ? {
                  id: offer.packaging.id,
                  name: offer.packaging.name,
                  level: offer.packaging.level,
                  quantityInBaseUnit:
                    offer.packaging.quantityInBaseUnit.toString(),
                  unit: offer.packaging.unit.symbol,
                }
              : {
                  name: offer.saleUnit?.nameRu ?? "Единица продажи",
                  quantityInBaseUnit: offer.baseUnitsPerSaleUnit.toString(),
                  unit: offer.saleUnit?.symbol ?? null,
                },
            minimumOrderQuantity: offer.minimumOrderQuantity.toString(),
            orderIncrement: offer.orderIncrement.toString(),
            availability: balances.map((balance) => ({
              warehouseId: balance.warehouseId,
              warehouse: balance.warehouse.name,
              cityId: balance.warehouse.cityId,
              quantityAvailable: balance.quantityAvailable.toString(),
              updatedAt: balance.lastSuccessfulSyncAt,
              freshnessExpiresAt: balance.freshnessExpiresAt,
            })),
            delivery: delivery.map((option) => ({
              method: option.method,
              priceType: option.priceType,
              fixedAmountMinor: option.fixedAmountMinor?.toString() ?? null,
              freeFromAmountMinor: option.freeFromAmountMinor?.toString() ?? null,
              currency: option.currency,
              minLeadTimeHours: option.minLeadTimeHours,
              maxLeadTimeHours: option.maxLeadTimeHours,
              temperatureControlled: option.temperatureControlled,
              installationRequired: option.installationRequired,
            })),
            markers: {
              verifiedDocuments: latestCompliance?.status === "PASSED",
              complianceRisk: latestCompliance?.riskLevel ?? null,
              officialDistributor: regulatory.officialDistributor === true,
              supplierWarranty: regulatory.supplierWarranty === true,
              requiresConfirmation:
                offer.confirmationMode === "MANUAL" || balances.length === 0,
            },
          };
        }),
      )
      .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer))
      .sort(
        (left, right) =>
          Number(left.price.normalizedPriceMinor) -
          Number(right.price.normalizedPriceMinor),
      );
    const reviewSummary = await this.reviewSummaries(
      selectedVariants.map(({ id }) => id),
    );
    const summary = this.productReviewSummary(
      selectedVariants.map(({ id }) => id),
      reviewSummary,
    );
    return {
      product: {
        id: product.id,
        name: product.canonicalName,
        brand: product.brand?.name ?? null,
        manufacturer: product.manufacturer?.name ?? null,
        baseUnit: product.baseUnit,
      },
      reviewSummary: summary,
      variants: product.variants.map(publicVariant),
      selectedVariantId: input.variantId ?? null,
      offers,
      comparisonAttributes: this.comparisonAttributes(product),
    };
  }

  private async reviewSummaries(variantIds: string[]) {
    if (!variantIds.length)
      return new Map<string, { count: number; averageRating: number | null }>();
    const rows = await this.prisma.$queryRaw<
      Array<{ productVariantId: string; overallRating: number }>
    >(
      Prisma.sql`SELECT "productVariantId", "overallRating" FROM "VerifiedReview" WHERE "productVariantId" IN (${Prisma.join(variantIds.map((id) => Prisma.sql`${id}::uuid`))}) AND "status" = 'PUBLISHED'`,
    );
    const grouped = new Map<string, number[]>();
    for (const row of rows)
      if (row.productVariantId)
        grouped.set(row.productVariantId, [
          ...(grouped.get(row.productVariantId) ?? []),
          row.overallRating,
        ]);
    return new Map(
      [...grouped.entries()].map(([variantId, ratings]) => [
        variantId,
        {
          count: ratings.length,
          averageRating:
            ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
        },
      ]),
    );
  }

  private productReviewSummary(
    variantIds: string[],
    summaries: Map<string, { count: number; averageRating: number | null }>,
  ) {
    const values = variantIds
      .map((id) => summaries.get(id))
      .filter(
        (value): value is { count: number; averageRating: number | null } =>
          Boolean(value),
      );
    const count = values.reduce((sum, value) => sum + value.count, 0);
    return {
      count,
      averageRating: count
        ? values.reduce(
            (sum, value) => sum + (value.averageRating ?? 0) * value.count,
            0,
          ) / count
        : null,
    };
  }

  private async loadSearchProducts(productIds: string[]) {
    const now = new Date();
    const admittedSuppliers = await this.terms.activeSupplierIds();
    return this.prisma.product.findMany({
      where: { id: { in: productIds }, status: "ACTIVE" },
      select: {
        id: true,
        slug: true,
        canonicalName: true,
        catalogName: true,
        manufacturerSku: true,
        description: true,
        descriptionSources: true,
        productType: true,
        regulatoryClass: true,
        brand: { select: { name: true } },
        manufacturer: { select: { name: true } },
        categories: {
          select: {
            categoryId: true,
            category: { select: { id: true, nameRu: true, parent: { select: { id: true, nameRu: true } } } },
          },
        },
        media: {
          where: { status: "READY" },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            sourceUrl: true,
            normalizedStorageKey: true,
            altText: true,
            width: true,
            height: true,
            metadata: true,
          },
        },
        searchDocument: {
          select: {
            minNormalizedPriceMinor: true,
            maxNormalizedPriceMinor: true,
            isAvailable: true,
          },
        },
        variants: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            sku: true,
            gtin: true,
            externalMetadata: true,
            supplierOffers: {
              where: {
                supplierOrganizationId: { in: admittedSuppliers },
                status: "ACTIVE",
                publication: {
                  is: {
                    status: { in: ["PUBLISHED", "RESTRICTED"] },
                    marketplaceVisible: true,
                  },
                },
              },
              select: {
                id: true,
                supplierOrganizationId: true,
                baseUnitsPerSaleUnit: true,
                confirmationMode: true,
                supplier: {
                  select: {
                    organization: { select: { displayName: true, profile: { select: publicContactSelect } } },
                  },
                },
                publication: {
                  select: { allowedBuyerIds: true, allowedCityIds: true },
                },
                saleUnit: { select: { nameRu: true, symbol: true } },
                packaging: {
                  select: {
                    name: true,
                    quantityInBaseUnit: true,
                    unit: { select: { symbol: true } },
                  },
                },
                prices: {
                  where: {
                    status: "ACTIVE",
                    validFrom: { lte: now },
                    OR: [{ validTo: null }, { validTo: { gte: now } }],
                    AND: [
                      {
                        OR: [
                          { freshnessExpiresAt: null },
                          { freshnessExpiresAt: { gte: now } },
                        ],
                      },
                    ],
                  },
                  orderBy: { validFrom: "desc" },
                  take: 1,
                  select: { amountMinor: true, currency: true },
                },
                inventoryBalances: {
                  select: {
                    warehouseId: true,
                    quantityAvailable: true,
                    freshnessStatus: true,
                    freshnessExpiresAt: true,
                    lastSuccessfulSyncAt: true,
                    warehouse: { select: { cityId: true } },
                  },
                  orderBy: { quantityAvailable: "desc" },
                },
                deliveryOptions: {
                  where: { status: "ACTIVE" },
                  select: { method: true },
                },
              },
            },
          },
        },
      },
    });
  }

  private async loadProducts(
    productIds: string[],
    buyerOrganizationId?: string,
    quantity = 1,
  ) {
    const now = new Date();
    const admittedSuppliers = await this.terms.activeSupplierIds();
    return this.prisma.product.findMany({
      where: { id: { in: productIds }, status: "ACTIVE" },
      include: {
        brand: true,
        manufacturer: true,
        baseUnit: true,
        categories: { include: { category: true } },
        media: { where: { status: "READY" }, orderBy: { sortOrder: "asc" } },
        industries: { include: { industry: true } },
        attributeValues: { include: { attribute: true } },
        searchDocument: true,
        variants: {
          where: { status: "ACTIVE" },
          include: {
            saleUnit: true,
            attributeValues: { include: { attribute: true } },
            packagings: {
              where: { status: "ACTIVE" },
              include: { unit: true },
            },
            supplierOffers: {
              where: {
                supplierOrganizationId: { in: admittedSuppliers },
                status: "ACTIVE",
                publication: {
                  is: {
                    status: { in: ["PUBLISHED", "RESTRICTED"] },
                    marketplaceVisible: true,
                  },
                },
              },
              include: {
                supplier: { include: { organization: { select: { displayName: true, profile: { select: publicContactSelect } } } } },
                publication: true,
                saleUnit: true,
                packaging: { include: { unit: true } },
                prices: {
                  where: {
                    status: "ACTIVE",
                    validFrom: { lte: now },
                    OR: [{ validTo: null }, { validTo: { gte: now } }],
                    AND: [
                      {
                        OR: [
                          { freshnessExpiresAt: null },
                          { freshnessExpiresAt: { gte: now } },
                        ],
                      },
                    ],
                  },
                  orderBy: { validFrom: "desc" },
                  take: 1,
                },
                priceTiers: {
                  where: {
                    minimumQuantity: { lte: quantity },
                    validFrom: { lte: now },
                    OR: [
                      { maximumQuantity: null },
                      { maximumQuantity: { gte: quantity } },
                    ],
                    AND: [
                      { OR: [{ validTo: null }, { validTo: { gte: now } }] },
                    ],
                  },
                },
                contractPrices: {
                  where: {
                    ...(buyerOrganizationId ? { buyerOrganizationId } : {}),
                    status: "ACTIVE",
                    minimumQuantity: { lte: quantity },
                    validFrom: { lte: now },
                    OR: [{ validTo: null }, { validTo: { gte: now } }],
                  },
                },
                inventoryBalances: {
                  include: { warehouse: true },
                  orderBy: { quantityAvailable: "desc" },
                },
                deliveryOptions: {
                  where: { status: "ACTIVE" },
                  include: { warehouse: true },
                },
                complianceChecks: { orderBy: { evaluatedAt: "desc" }, take: 1 },
              },
            },
          },
        },
      },
    });
  }

  private toSearchItem(
    product: Awaited<ReturnType<SearchService["loadSearchProducts"]>>[number],
    input: SearchCatalogInput,
    rank: number,
    reviewSummaries: Map<
      string,
      { count: number; averageRating: number | null }
    >,
    promotions: PublicSearchPromotion[] = [],
  ) {
    const categoryIds = product.categories.map(({ categoryId }) => categoryId);
    const now = new Date();
    const offers = product.variants.flatMap((variant) =>
      variant.supplierOffers
        .filter((offer) => {
          const allowedBuyers = offer.publication?.allowedBuyerIds;
          if (
            Array.isArray(allowedBuyers) &&
            allowedBuyers.length > 0 &&
            !allowedBuyers.includes(input.buyerOrganizationId)
          )
            return false;
          const allowedCities = offer.publication?.allowedCityIds;
          if (
            input.cityId &&
            Array.isArray(allowedCities) &&
            allowedCities.length > 0 &&
            !allowedCities.includes(input.cityId)
          )
            return false;
          if (
            input.supplierOrganizationId &&
            offer.supplierOrganizationId !== input.supplierOrganizationId
          )
            return false;
          if (
            input.warehouseId &&
            !offer.inventoryBalances.some(
              ({ warehouseId }) => warehouseId === input.warehouseId,
            )
          )
            return false;
          if (
            input.cityId &&
            !offer.inventoryBalances.some(
              ({ warehouse }) => warehouse.cityId === input.cityId,
            ) &&
            !offer.deliveryOptions.some(({ method }) =>
              ["NATIONWIDE", "CARRIER", "MARKETPLACE_LOGISTICS"].includes(
                method,
              ),
            )
          )
            return false;
          if (
            input.deliveryMethod &&
            !offer.deliveryOptions.some(
              ({ method }) => method === input.deliveryMethod,
            )
          )
            return false;
          if (input.priceBasis === "SALE_UNIT" && input.packaging && (offer.packaging?.name ?? offer.saleUnit?.nameRu) !== input.packaging) return false;
          if (input.priceBasis === "SALE_UNIT" && input.unit && (offer.packaging?.unit.symbol ?? offer.saleUnit?.symbol) !== input.unit) return false;
          return true;
        })
        .map((offer) => {
          const promotion = promotions.find((item) => {
            if (
              item.supplierOrganizationId !== offer.supplierOrganizationId ||
              item.offerId !== offer.id ||
              item.baseAmountMinor?.toString() !== offer.prices[0]?.amountMinor.toString() ||
              item.currency !== offer.prices[0]?.currency ||
              !item.percentageBasisPoints
            )
              return false;
            const scope =
              item.scope &&
              typeof item.scope === "object" &&
              !Array.isArray(item.scope)
                ? (item.scope as Record<string, string[]>)
                : {};
            const locations = offer.inventoryBalances.length
              ? offer.inventoryBalances
              : [null];
            return locations.some((balance) =>
              scopeMatches(scope, {
                offerId: offer.id,
                productId: product.id,
                categoryIds,
                cityId: input.cityId ?? balance?.warehouse.cityId ?? null,
                warehouseId: balance?.warehouseId ?? null,
              }),
            );
          });
          return {
            id: offer.id,
            variantId: variant.id,
            supplier: {
              id: offer.supplierOrganizationId,
              name: offer.supplier.organization.displayName,
              publicContact: publicOrganizationContact(offer.supplier.organization.profile),
            },
            priceMinor: offer.prices[0]?.amountMinor.toString() ?? null,
            currency: offer.prices[0]?.currency ?? null,
            normalizedPriceMinor: offer.prices[0]
              ? new Prisma.Decimal(offer.prices[0].amountMinor)
                  .div(
                    offer.packaging?.quantityInBaseUnit ??
                      offer.baseUnitsPerSaleUnit,
                  )
                  .toFixed(6)
              : null,
            packaging: offer.packaging
              ? {
                  name: offer.packaging.name,
                  quantityInBaseUnit:
                    offer.packaging.quantityInBaseUnit.toString(),
                  unit: offer.packaging.unit.symbol,
                }
              : {
                  name: offer.saleUnit?.nameRu ?? null,
                  quantityInBaseUnit: offer.baseUnitsPerSaleUnit.toString(),
                  unit: offer.saleUnit?.symbol ?? null,
                },
            available: Boolean(offer.prices[0] && offer.prices[0].amountMinor.gt(0) && offer.prices[0].currency === "KZT") && offer.inventoryBalances.some(
              (balance) =>
                balance.freshnessStatus === "FRESH" &&
                (!balance.freshnessExpiresAt || balance.freshnessExpiresAt > now) &&
                Number(balance.quantityAvailable) > 0,
            ),
            freshness: offer.inventoryBalances.map(
              ({ lastSuccessfulSyncAt, freshnessStatus, warehouse }) => ({
                status: freshnessStatus,
                updatedAt: lastSuccessfulSyncAt,
                cityId: warehouse.cityId,
              }),
            ),
            confirmationMode: offer.confirmationMode,
            deliveryMethods: offer.deliveryOptions.map(({ method }) => method),
            promotion: promotion
              ? {
                  label: promotion.sponsorshipLabel ?? promotion.name,
                  percentage: promotion.percentageBasisPoints! / 100,
                  endsAt: promotion.endsAt.toISOString(),
                }
              : null,
          };
        }),
    );
    return {
      id: product.id,
      slug: product.slug,
      name: product.canonicalName,
      catalogName: product.catalogName,
      manufacturerSku: product.manufacturerSku,
      description: product.description,
      descriptionSources: product.descriptionSources,
      brand: product.brand?.name ?? null,
      manufacturer: product.manufacturer?.name ?? null,
      productType: product.productType,
      regulatoryClass: product.regulatoryClass,
      media: product.media.map((media) => ({
        id: media.id,
        sourceUrl: media.sourceUrl,
        securePath: media.normalizedStorageKey
          ? `/catalog/media/${media.id}?ticket=${this.mediaAccess.issue(media.id).token}`
          : null,
        normalizedStorageKey: media.normalizedStorageKey,
        altText: media.altText,
        width: media.width,
        height: media.height,
        metadata: media.metadata,
      })),
      categories: [...new Map(product.categories.flatMap(({ category }) => [category.parent, category].filter((c): c is NonNullable<typeof c> => c !== null).map(c => [c.id, { id: c.id, name: c.nameRu }] as const))).values()],
      ...visibleOfferSummary(offers),
      reviewSummary: this.productReviewSummary(
        product.variants.map(({ id }) => id),
        reviewSummaries,
      ),
      rank,
      variants: product.variants.map(publicVariant),
      offers,
    };
  }

  private aggregateFacets(
    items: Array<ReturnType<SearchService["toSearchItem"]>>,
  ) {
    const categoryCounts = new Map<
      string,
      { id: string; name: string; count: number }
    >();
    const suppliers = new Map<
      string,
      { id: string; name: string; count: number }
    >();
    for (const item of items) {
      for (const category of item.categories)
        categoryCounts.set(category.id, {
          ...category,
          count: (categoryCounts.get(category.id)?.count ?? 0) + 1,
        });
      for (const offer of item.offers)
        suppliers.set(offer.supplier.id, {
          ...offer.supplier,
          count: (suppliers.get(offer.supplier.id)?.count ?? 0) + 1,
        });
    }
    return {
      categories: [...categoryCounts.values()].sort(
        (a, b) => b.count - a.count,
      ),
      suppliers: [...suppliers.values()].sort((a, b) => b.count - a.count),
    };
  }

  private comparisonAttributes(
    product: Awaited<ReturnType<SearchService["loadProducts"]>>[number],
  ) {
    return [
      ...product.attributeValues.map((value) => ({
        scope: "PRODUCT",
        code: value.attribute.code,
        name: value.attribute.nameRu,
        value: this.attributeValue(value),
      })),
      ...product.variants.flatMap((variant) =>
        variant.attributeValues.map((value) => ({
          scope: "VARIANT",
          variantId: variant.id,
          code: value.attribute.code,
          name: value.attribute.nameRu,
          value: this.attributeValue(value),
        })),
      ),
    ];
  }

  private attributeValue(value: {
    valueText: string | null;
    valueInteger: bigint | null;
    valueDecimal: Prisma.Decimal | null;
    valueBoolean: boolean | null;
    valueDate: Date | null;
    valueOptionId: string | null;
    valueOptionIds: Prisma.JsonValue;
    rangeMin: Prisma.Decimal | null;
    rangeMax: Prisma.Decimal | null;
  }) {
    return (
      value.valueText ??
      value.valueInteger?.toString() ??
      value.valueDecimal?.toString() ??
      value.valueBoolean ??
      value.valueDate?.toISOString().slice(0, 10) ??
      value.valueOptionId ??
      value.valueOptionIds ??
      (value.rangeMin || value.rangeMax
        ? {
            min: value.rangeMin?.toString() ?? null,
            max: value.rangeMax?.toString() ?? null,
          }
        : null)
    );
  }
}
