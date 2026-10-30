import { z } from "zod";
import { offerVatInputSchema } from "../vat";

export const createSupplierOfferSchema = z.object({
  productVariantId: z.uuid(),
  saleUnitId: z.uuid().nullable().optional(),
  packagingId: z.uuid().nullable().optional(),
  sourceId: z.uuid().nullable().optional(),
  supplierSku: z.string().trim().max(120).nullable().optional(),
  baseUnitsPerSaleUnit: z.number().positive().default(1),
  minimumOrderQuantity: z.number().positive().default(1),
  orderIncrement: z.number().positive().default(1),
  confirmationMode: z.enum(["AUTO", "MANUAL"]).default("MANUAL"),
  sourceType: z.enum(["MANUAL", "IMPORT", "API", "ERP"]).default("MANUAL"),
  externalId: z.string().trim().max(160).nullable().optional(),
});

export const setOfferPriceSchema = z.object({
  amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().trim().regex(/^[A-Z]{3}$/),
  includesVat: z.boolean().default(true),
  vatRate: z.number().min(0).max(100).nullable().optional(),
  tax: offerVatInputSchema.optional(),
  source: z.enum(["MANUAL", "IMPORT", "API", "ERP"]).default("MANUAL"),
  reason: z.string().trim().max(240).nullable().optional(),
});

export const setOfferPublicationSchema = z.object({
  status: z.enum(["DRAFT", "UNDER_REVIEW", "PUBLISHED", "HIDDEN", "BLOCKED", "PAUSED", "RESTRICTED"]),
  marketplaceVisible: z.boolean(),
  blockedReason: z.string().trim().max(240).nullable().optional(),
  expectedVersion: z.number().int().positive().optional(),
  decisionReason: z.string().trim().min(5).max(500).optional(),
}).refine((value) => !value.marketplaceVisible || value.status === "PUBLISHED" || value.status === "RESTRICTED", {
  message: "Marketplace visibility requires a published or restricted status",
});

export const supplierOfferPublicationResponseSchema = z.object({
  offerId: z.uuid(),
  productId: z.uuid(),
  offerStatus: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "BLOCKED", "ARCHIVED"]),
  offerVersion: z.number().int().positive(),
  status: z.enum(["DRAFT", "UNDER_REVIEW", "PUBLISHED", "HIDDEN", "BLOCKED", "PAUSED", "RESTRICTED"]),
  marketplaceVisible: z.boolean(),
  publishedAt: z.iso.datetime().nullable(),
  blockedReason: z.string().nullable(),
});

export type CreateSupplierOfferInput = z.infer<typeof createSupplierOfferSchema>;

export type SetOfferPriceInput = z.infer<typeof setOfferPriceSchema>;

export type SetOfferPublicationInput = z.infer<typeof setOfferPublicationSchema>;

export type SupplierOfferPublicationResponse = z.infer<typeof supplierOfferPublicationResponseSchema>;
