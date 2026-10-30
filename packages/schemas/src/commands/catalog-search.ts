import { z } from "zod";

export const searchCatalogSchema = z.object({
  buyerOrganizationId: z.uuid(),
  q: z.string().trim().max(240).default(""),
  brandName: z.string().trim().max(240).optional(),
  categoryName: z.string().trim().max(240).optional(),
  categoryId: z.uuid().optional(),
  industryId: z.uuid().optional(),
  brandId: z.uuid().optional(),
  manufacturerId: z.uuid().optional(),
  supplierOrganizationId: z.uuid().optional(),
  cityId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  deliveryMethod: z.enum(["PICKUP", "SUPPLIER_CITY", "SELECTED_CITIES", "NATIONWIDE", "CARRIER", "MARKETPLACE_LOGISTICS", "PRICE_ON_REQUEST", "SPECIAL"]).optional(),
  unit: z.string().trim().max(24).optional(),
  packaging: z.string().trim().max(120).optional(),
  inStock: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  minNormalizedPriceMinor: z.coerce.number().nonnegative().optional(),
  maxNormalizedPriceMinor: z.coerce.number().nonnegative().optional(),
  priceBasis: z.enum(["NORMALIZED", "SALE_UNIT"]).optional(),
  minSalePriceMinor: z.string().regex(/^\d{1,20}$/).optional(),
  maxSalePriceMinor: z.string().regex(/^\d{1,20}$/).optional(),
  includeFilterOptions: z.enum(["true", "false"]).optional(),
  attributeFilters: z.string().max(8_000).optional(),
  sort: z.enum(["RELEVANCE", "PRICE_ASC", "PRICE_DESC", "NAME_ASC", "UPDATED_DESC"]).default("RELEVANCE"),
  offset: z.coerce.number().int().nonnegative().max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(24),
}).refine((value) => value.minNormalizedPriceMinor == null || value.maxNormalizedPriceMinor == null || value.minNormalizedPriceMinor <= value.maxNormalizedPriceMinor, "Search price range is inverted");

export const compareOffersSchema = z.object({
  buyerOrganizationId: z.uuid(),
  productId: z.uuid(),
  variantId: z.uuid().optional(),
  quantity: z.coerce.number().positive().default(1),
  cityId: z.uuid().optional(),
});

export type SearchCatalogInput = z.infer<typeof searchCatalogSchema>;

export type CompareOffersInput = z.infer<typeof compareOffersSchema>;

export type SearchCatalogRequest = z.input<typeof searchCatalogSchema>;

export type CompareOffersRequest = z.input<typeof compareOffersSchema>;
