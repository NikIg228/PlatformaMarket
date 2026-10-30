import { z } from "zod";
import { organizationContactSchema } from "../organization-profile.js";
import { decimalStringSchema, currencySchema, nullableDateTimeSchema, dateTimeSchema } from "./primitives.js";

export const publicCitySchema = z.object({
  id: z.uuid(),
  nameRu: z.string(),
  region: z.object({ nameRu: z.string() }),
});

export const publicCityListResponseSchema = z.array(publicCitySchema);

export const catalogVariantSchema = z.object({
  id: z.uuid(),
  sku: z.string().nullable(),
  gtin: z.string().nullable(),
  label: z.string(),
  attributes: z.record(z.string(), z.unknown()),
});

export const catalogMediaSchema = z.object({
  id: z.uuid(),
  sourceUrl: z.string().nullable(),
  securePath: z.string().nullable(),
  normalizedStorageKey: z.string().nullable(),
  altText: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  metadata: z.unknown().nullable(),
});

export const catalogSearchOfferSchema = z.object({
  id: z.uuid(),
  variantId: z.uuid(),
  supplier: z.object({ id: z.uuid(), name: z.string(), publicContact: organizationContactSchema.nullable().optional() }),
  priceMinor: decimalStringSchema.nullable(),
  currency: currencySchema.nullable(),
  normalizedPriceMinor: decimalStringSchema.nullable(),
  packaging: z.object({
    name: z.string().nullable(),
    quantityInBaseUnit: decimalStringSchema,
    unit: z.string().nullable(),
  }),
  available: z.boolean(),
  freshness: z.array(
    z.object({
      status: z.string(),
      updatedAt: nullableDateTimeSchema,
      cityId: z.uuid(),
    }),
  ),
  confirmationMode: z.string(),
  deliveryMethods: z.array(z.string()),
  promotion: z
    .object({
      label: z.string(),
      percentage: z.number(),
      endsAt: dateTimeSchema,
    })
    .nullable(),
});

export const reviewSummarySchema = z.object({
  count: z.number().int().nonnegative(),
  averageRating: z.number().nullable(),
});

export const catalogSearchProductSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  catalogName: z.string().nullable().optional(),
  manufacturerSku: z.string().nullable().optional(),
  description: z.string().nullable(),
  descriptionSources: z.unknown().nullable(),
  brand: z.string().nullable(),
  manufacturer: z.string().nullable(),
  productType: z.string(),
  regulatoryClass: z.string().nullable(),
  media: z.array(catalogMediaSchema),
  categories: z.array(z.object({ id: z.uuid(), name: z.string() })),
  minNormalizedPriceMinor: decimalStringSchema.nullable(),
  maxNormalizedPriceMinor: decimalStringSchema.nullable(),
  isAvailable: z.boolean(),
  reviewSummary: reviewSummarySchema,
  rank: z.number(),
  variants: z.array(catalogVariantSchema),
  offers: z.array(catalogSearchOfferSchema),
});

export const catalogFacetSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  count: z.number().int().nonnegative(),
});

export const updatedCatalogProductSchema = z.object({
  id: z.uuid(), canonicalName: z.string(), catalogName: z.string().nullable(),
  manufacturerSku: z.string().nullable(), version: z.number().int().positive(), status: z.string(),
}).passthrough();

export type UpdatedCatalogProduct = z.infer<typeof updatedCatalogProductSchema>;

export const catalogFilterOptionsSchema = z.object({
  categories: z.array(z.object({ id: z.uuid(), name: z.string(), parentId: z.uuid().nullable() })),
  brands: z.array(z.object({ id: z.uuid(), name: z.string() })),
  manufacturers: z.array(z.object({ id: z.uuid(), name: z.string() })),
  suppliers: z.array(z.object({ id: z.uuid(), name: z.string() })),
  packaging: z.array(z.string()),
  attributes: z.array(z.object({ code: z.string(), name: z.string(), values: z.array(z.union([z.string(), z.number(), z.boolean()])) })),
});

export const catalogSearchResponseSchema = z.object({
  query: z.string(),
  interpretedQuery: z.array(z.string()).optional(),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  items: z.array(catalogSearchProductSchema),
  filterOptions: catalogFilterOptionsSchema.optional(),
  facets: z.object({
    categories: z.array(catalogFacetSchema),
    suppliers: z.array(catalogFacetSchema),
  }),
});

export const comparedOfferSchema = z.object({
  offerId: z.uuid(),
  variantId: z.uuid(),
  supplier: z.object({ organizationId: z.uuid(), name: z.string(), publicContact: organizationContactSchema.nullable().optional() }),
  supplierSku: z.string().nullable(),
  price: z.object({
    amountMinor: decimalStringSchema,
    currency: currencySchema,
    source: z.string(),
    normalizedPriceMinor: decimalStringSchema,
    baseUnits: decimalStringSchema,
    normalizedUnit: z.string(),
  }),
  packaging: z
    .object({
      id: z.uuid().optional(),
      name: z.string(),
      level: z.string().optional(),
      quantityInBaseUnit: decimalStringSchema,
      unit: z.string().nullable(),
    })
    .passthrough(),
  minimumOrderQuantity: decimalStringSchema,
  orderIncrement: decimalStringSchema,
  availability: z.array(
    z.object({
      warehouseId: z.uuid(),
      warehouse: z.string(),
      cityId: z.uuid(),
      quantityAvailable: decimalStringSchema,
      updatedAt: nullableDateTimeSchema,
      freshnessExpiresAt: nullableDateTimeSchema,
    }),
  ),
  delivery: z.array(
    z.object({
      method: z.string(),
      priceType: z.string(),
      fixedAmountMinor: decimalStringSchema.nullable(),
      freeFromAmountMinor: decimalStringSchema.nullable().optional(),
      currency: z.string().optional(),
      minLeadTimeHours: z.number().int(),
      maxLeadTimeHours: z.number().int().nullable(),
      temperatureControlled: z.boolean(),
      installationRequired: z.boolean(),
    }),
  ),
  markers: z.object({
    verifiedDocuments: z.boolean(),
    complianceRisk: z.string().nullable(),
    officialDistributor: z.boolean(),
    supplierWarranty: z.boolean(),
    requiresConfirmation: z.boolean(),
  }),
});

export const offerComparisonResponseSchema = z.object({
  product: z.object({
    id: z.uuid(),
    name: z.string(),
    brand: z.string().nullable(),
    manufacturer: z.string().nullable(),
    baseUnit: z
      .object({
        id: z.uuid(),
        code: z.string(),
        nameRu: z.string(),
        nameKk: z.string(),
        symbol: z.string(),
      })
      .passthrough()
      .nullable(),
  }),
  reviewSummary: reviewSummarySchema,
  variants: z.array(catalogVariantSchema),
  selectedVariantId: z.uuid().nullable(),
  offers: z.array(comparedOfferSchema),
  comparisonAttributes: z.array(
    z
      .object({
        scope: z.enum(["PRODUCT", "VARIANT"]),
        variantId: z.uuid().optional(),
        code: z.string(),
        name: z.string(),
        value: z.unknown(),
      })
      .passthrough(),
  ),
});

export type CatalogSearchResponse = z.infer<typeof catalogSearchResponseSchema>;

export type OfferComparisonResponse = z.infer<
  typeof offerComparisonResponseSchema
>;
