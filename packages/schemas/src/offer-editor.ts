import { z } from "zod";

export const offerOptionsQuerySchema = z.object({
  q: z.string().trim().max(160).default(""),
  cursor: z.uuid().optional(),
  variantId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const offerOptionSchema = z.object({
  id: z.uuid(), productId: z.uuid(), name: z.string(), sku: z.string().nullable(),
  gtin: z.string().nullable(),
  imageUrl: z.string().nullable().optional(),
  packagings: z.array(z.object({
    id: z.uuid(), name: z.string(), unitId: z.uuid(), unit: z.string(), quantityInBaseUnit: z.string(),
  })),
});
export const offerOptionsResponseSchema = z.object({ items: z.array(offerOptionSchema), nextCursor: z.uuid().nullable() });
export const supplierWarehouseListSchema = z.array(z.object({ id: z.uuid(), name: z.string(), status: z.string() }));
export const supplierOfferCreatedSchema = z.object({ id: z.uuid(), version: z.number().int().positive() });
export const productCandidateSubmittedSchema = z.object({
  candidate: z.object({ id: z.uuid(), status: z.string() }),
  duplicateSuggestions: z.array(z.object({ id: z.uuid(), canonicalName: z.string() })),
});
export type OfferOptionsQuery = z.input<typeof offerOptionsQuerySchema>;
export type OfferOptionsResponse = z.infer<typeof offerOptionsResponseSchema>;
export type OfferOption = z.infer<typeof offerOptionSchema>;
export type SupplierWarehouseList = z.infer<typeof supplierWarehouseListSchema>;
export type SupplierOfferCreated = z.infer<typeof supplierOfferCreatedSchema>;
export type ProductCandidateSubmitted = z.infer<typeof productCandidateSubmittedSchema>;
