import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { calculateVatLine } from "@marketplace/schemas";
import { resolvePriceRules } from "../pricing/price-resolver";
import { quoteOfferPromotion } from "../promotions/checkout-promotions";
import { assertVatCurrent, storedVat } from "../vat/vat-rules";
import { calculateLineTotal, quantityMatchesOffer, type CartLineSnapshot } from "./commerce-rules";
import type { MarketplaceAgreementsService } from "../agreements/marketplace-agreements.service";

// Null buyer means personal/public conditions. Never substitute an active membership.
export async function resolveCartOffer(db: Prisma.TransactionClient, agreements: Pick<MarketplaceAgreementsService, "assertActive">,
  buyerOrganizationId: string | null, offerId: string, quantity: number, expectedCurrency?: string) {
    const at = new Date();
    const offer = await db.supplierOffer.findFirst({
      where: {
        id: offerId,
        status: "ACTIVE",
        ...(buyerOrganizationId ? {} : {
          productVariant: { status: "ACTIVE", product: { status: "ACTIVE" } },
          supplier: { organization: { status: "ACTIVE", capabilities: { some: { capability: "SUPPLIER" } } } },
        }),
        publication: {
          is: {
            status: buyerOrganizationId ? { in: ["PUBLISHED", "RESTRICTED"] } : "PUBLISHED",
            marketplaceVisible: true,
          },
        },
      },
      include: {
        publication: true,
        packaging: true,
        saleUnit: true,
        supplier: { include: { organization: true } },
        productVariant: { include: { product: true } },
        prices: {
          where: {
            status: "ACTIVE",
            validFrom: { lte: at },
            OR: [{ validTo: null }, { validTo: { gte: at } }],
            AND: [
              {
                OR: [
                  { freshnessExpiresAt: null },
                  { freshnessExpiresAt: { gte: at } },
                ],
              },
            ],
          },
          orderBy: { validFrom: "desc" },
        },
        priceTiers: {
          where: {
            minimumQuantity: { lte: quantity },
            validFrom: { lte: at },
            OR: [
              { maximumQuantity: null },
              { maximumQuantity: { gte: quantity } },
            ],
            AND: [{ OR: [{ validTo: null }, { validTo: { gte: at } }] }],
          },
        },
        contractPrices: {
          where: {
            ...(buyerOrganizationId ? { buyerOrganizationId } : { id: { in: [] } }),
            status: "ACTIVE",
            minimumQuantity: { lte: quantity },
            validFrom: { lte: at },
            OR: [{ validTo: null }, { validTo: { gte: at } }],
          },
        },
        inventoryBalances: {
          where: { freshnessStatus: "FRESH", ...(buyerOrganizationId ? {} : {
            warehouse: { status: "ACTIVE" }, OR: [{ freshnessExpiresAt: null }, { freshnessExpiresAt: { gt: at } }],
          }) },
          include: {
            warehouse: true,
            _count: { select: { lots: true } },
            lots: {
              where: {
                status: "ACTIVE",
                OR: [{ expirationDate: null }, { expirationDate: { gt: at } }],
              },
              orderBy: { expirationDate: { sort: "asc", nulls: "last" } },
            },
          },
          orderBy: [{ quantityAvailable: "desc" }, { warehouseId: "asc" }],
        },
      },
    });
    if (!offer)
      throw new NotFoundException("Published marketplace offer not found");
    await agreements.assertActive(offer.supplierOrganizationId);
    if (
      !quantityMatchesOffer(
        quantity,
        offer.minimumOrderQuantity.toString(),
        offer.orderIncrement.toString(),
      )
    )
      throw new BadRequestException(
        "Quantity does not match offer minimum and increment",
      );
    const allowedBuyerIds = offer.publication?.allowedBuyerIds;
    if (
      Array.isArray(allowedBuyerIds) &&
      allowedBuyerIds.length > 0 &&
      (!buyerOrganizationId || !allowedBuyerIds.includes(buyerOrganizationId))
    )
      throw new ForbiddenException("Offer is not available to this buyer");

    const decision = resolvePriceRules({
      quantity,
      at,
      contracts: (buyerOrganizationId ? offer.contractPrices : []).map((rule) => ({
        id: rule.id,
        amountMinor: rule.amountMinor.toString(),
        currency: rule.currency,
        minimumQuantity: rule.minimumQuantity.toString(),
        validFrom: rule.validFrom,
        validTo: rule.validTo,
        priority: rule.priority,
      })),
      tiers: offer.priceTiers.map((rule) => ({
        id: rule.id,
        amountMinor: rule.unitPriceMinor.toString(),
        currency: rule.currency,
        minimumQuantity: rule.minimumQuantity.toString(),
        maximumQuantity: rule.maximumQuantity?.toString(),
        validFrom: rule.validFrom,
        validTo: rule.validTo,
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
    if (
      decision.source === "UNAVAILABLE" ||
      !decision.amountMinor ||
      !decision.currency
    )
      throw new ConflictException(
        "No active price applies to the requested quantity",
      );
    if (expectedCurrency && decision.currency !== expectedCurrency)
      throw new ConflictException("Offer currency differs from cart currency");
    const availableQuantity = offer.inventoryBalances.reduce(
      (sum, candidate) => sum.plus(candidate.quantityAvailable),
      new Prisma.Decimal(0),
    );
    const selected =
      offer.inventoryBalances
        .filter(
          ({ quantityAvailable }) => Number(quantityAvailable) >= quantity,
        )
        .map((balance) => ({
          balance,
          lot:
            balance.lots.find(
              ({ quantityAvailable }) => Number(quantityAvailable) >= quantity,
            ) ?? null,
        }))
        .find(
          ({ balance, lot }) => balance._count.lots === 0 || lot !== null,
        ) ?? null;
    const balance = selected?.balance ?? null;
    const lot = selected?.lot ?? null;
    const fulfillmentStatus = availableQuantity.lte(0)
      ? ("OUT_OF_STOCK" as const)
      : balance
        ? ("AVAILABLE" as const)
        : ("INSUFFICIENT_STOCK" as const);
    const promotion = await quoteOfferPromotion(db, { offerId, supplierOrganizationId: offer.supplierOrganizationId, buyerOrganizationId,
      source: decision.source, unitPriceMinor: decision.amountMinor, currency: decision.currency, quantity, balanceId: balance?.id ?? null, lotId: lot?.id ?? null });
    if (promotion) decision.amountMinor = promotion.snapshot.unitPriceMinor;
    const total = calculateLineTotal(decision.amountMinor, quantity);
    const taxDeclaration = storedVat(offer.prices[0]?.taxSnapshot);
    if (taxDeclaration) await assertVatCurrent(db, offer.supplierOrganizationId, taxDeclaration);
    const pricingSnapshot: CartLineSnapshot = {
      tax: taxDeclaration ? calculateVatLine(total.toString(), taxDeclaration) : null,
      resolvedAt: at.toISOString(),
      offerVersion: offer.version,
      source: decision.source,
      ruleId: decision.ruleId,
      unitPriceMinor: decision.amountMinor,
      quantity: String(quantity),
      totalPriceMinor: total.toString(),
      currency: decision.currency,
      minimumOrderQuantity: offer.minimumOrderQuantity.toString(),
      orderIncrement: offer.orderIncrement.toString(),
      commercialTerms: {
        saleUnitId: offer.saleUnitId,
        saleUnitName: offer.saleUnit?.nameRu ?? null,
        packagingId: offer.packagingId,
        packagingName: offer.packaging?.name ?? null,
        baseUnitsPerSaleUnit: offer.baseUnitsPerSaleUnit.toString(),
        packagingUnitId: offer.packaging?.unitId ?? null,
        packagingQuantity: offer.packaging?.quantityInBaseUnit.toString() ?? null,
        includesVat: offer.prices[0]?.includesVat ?? null,
        vatRate: offer.prices[0]?.vatRate?.toString() ?? null,
      },
      ...(promotion ? { promotion: promotion.snapshot } : {}),
      availableQuantity: availableQuantity.toString(),
      fulfillmentStatus,
    };
    return { offer, decision, balance, lot, total, pricingSnapshot, promotion };
}
