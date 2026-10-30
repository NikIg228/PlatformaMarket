import { z } from "zod";

export const approveProductCandidateSchema = z.object({
  canonicalName: z.string().trim().min(3).max(240),
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{2,159}$/),
  productType: z.string().trim().min(2).max(80),
  regulatoryClass: z.string().trim().max(80).nullable().optional(),
  industryIds: z.array(z.uuid()).min(1).max(20),
  categoryIds: z.array(z.uuid()).min(1).max(20),
  saleUnitId: z.uuid(),
  packageQuantity: z.number().positive().max(999999.999999).refine(value => /^\d{1,6}(?:\.\d{1,6})?$/.test(String(value)), "Use at most six decimal places").default(1),
});

export const approveImportProductCandidateSchema = approveProductCandidateSchema.extend({
  saleUnitId: z.uuid(),
  decisionReason: z.string().trim().min(5).max(500),
});

const importReviewResultSchema = z.object({
  product: z.object({ id: z.uuid(), name: z.string(), status: z.string() }),
  variant: z.object({ id: z.uuid(), status: z.string() }),
  offer: z.object({
    id: z.uuid(),
    status: z.string(),
    version: z.number().int().positive(),
    publicationStatus: z.string(),
    marketplaceVisible: z.boolean(),
    publishedAt: z.iso.datetime().nullable(),
    priceMinor: z.string().nullable(),
    currency: z.string().nullable(),
    quantityAvailable: z.string().nullable(),
    readinessBlockers: z.array(z.string()),
  }),
});

export const catalogImportReviewSchema = z.object({
  id: z.uuid(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ROLLED_BACK"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  supplier: z.object({ organizationId: z.uuid(), displayName: z.string() }),
  proposed: z.object({
    name: z.string(),
    sku: z.string().nullable(),
    gtin: z.string().nullable(),
    brand: z.string().nullable(),
  }),
  source: z.object({
    externalItemId: z.uuid(),
    externalId: z.string(),
    fileName: z.string(),
    batchId: z.uuid(),
    rowNumber: z.number().int().positive(),
    normalizedData: z.record(z.string(), z.unknown()).nullable(),
    complianceStatus: z.string(),
    complianceReasons: z.array(z.string()),
  }),
  suggestedMatches: z.array(z.object({
    variantId: z.uuid(),
    productId: z.uuid(),
    productName: z.string(),
    sku: z.string().nullable(),
    score: z.string(),
    reasons: z.array(z.string()),
  })),
  decision: z.object({
    decidedAt: z.iso.datetime().nullable(),
    rejectionReason: z.string().nullable(),
  }).nullable(),
  result: importReviewResultSchema.nullable(),
});

export const catalogImportReviewQueueResponseSchema = z.object({
  items: z.array(catalogImportReviewSchema),
  options: z.object({
    industries: z.array(z.object({ id: z.uuid(), name: z.string() })),
    categories: z.array(z.object({ id: z.uuid(), name: z.string(), industryId: z.uuid() })),
    units: z.array(z.object({ id: z.uuid(), name: z.string(), symbol: z.string() })),
  }),
});

export const rejectProductCandidateSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const productCorrectionFieldSchema = z.enum([
  "CANONICAL_NAME",
  "DESCRIPTION",
  "MANUFACTURER_SKU",
  "GTIN",
  "PRODUCT_TYPE",
  "REGULATORY_CLASS",
]);

export const submitProductCorrectionSchema = z.object({
  productId: z.uuid(),
  field: productCorrectionFieldSchema,
  proposedValue: z.string().trim().min(1).max(5_000),
  reason: z.string().trim().min(10).max(1_000),
  evidenceUrl: z.url().max(2_000).nullable().optional(),
  evidence: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const decideProductCorrectionSchema = z.object({
  acceptedValue: z.string().trim().min(1).max(5_000).optional(),
  moderatorComment: z.string().trim().min(3).max(1_000),
});

export type ApproveProductCandidateInput = z.infer<typeof approveProductCandidateSchema>;

export type ApproveImportProductCandidateInput = z.infer<typeof approveImportProductCandidateSchema>;

export type CatalogImportReview = z.infer<typeof catalogImportReviewSchema>;

export type CatalogImportReviewQueueResponse = z.infer<typeof catalogImportReviewQueueResponseSchema>;

export type RejectProductCandidateInput = z.infer<typeof rejectProductCandidateSchema>;

export type SubmitProductCorrectionInput = z.infer<typeof submitProductCorrectionSchema>;

export type DecideProductCorrectionInput = z.infer<typeof decideProductCorrectionSchema>;

export const productCandidateHistoryQuerySchema = z.object({ cursor: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(20), q: z.string().trim().max(160).optional(), status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional() });

export const productCandidateSummarySchema = z.object({
  id: z.uuid(), proposedName: z.string(), proposedSku: z.string().nullable(),
  description: z.string().nullable().optional(),
  proposedGtin: z.string().nullable(), proposedBrand: z.string().nullable(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]), rejectionReason: z.string().nullable(),
  approvedProductId: z.uuid().nullable(), approvedVariantId: z.uuid().nullable(),
  offerId: z.uuid().nullable().optional(),
  createdAt: z.iso.datetime(), decidedAt: z.iso.datetime().nullable(),
});

export const productCandidateHistoryResponseSchema = z.object({ items: z.array(productCandidateSummarySchema), nextCursor: z.uuid().nullable() });

export const manualProductReviewQueueSchema = z.object({
  items: z.array(productCandidateSummarySchema.extend({ description: z.string().nullable(), supplier: z.object({ organizationId: z.uuid(), displayName: z.string() }) })),
  nextCursor: z.uuid().nullable(), options: catalogImportReviewQueueResponseSchema.shape.options,
});

export const approveProductCandidateResponseSchema = z.object({ candidate: z.object({ id: z.uuid(), status: z.string() }), product: z.object({ id: z.uuid() }), variant: z.object({ id: z.uuid() }), offer: z.object({ id: z.uuid(), version: z.number().int() }) });

export type ProductCandidateHistoryQuery = z.input<typeof productCandidateHistoryQuerySchema>;

export type ProductCandidateHistoryResponse = z.infer<typeof productCandidateHistoryResponseSchema>;

export type ProductCandidateSummary = z.infer<typeof productCandidateSummarySchema>;

export type ManualProductReviewQueue = z.infer<typeof manualProductReviewQueueSchema>;

export type ApproveProductCandidateResponse = z.infer<typeof approveProductCandidateResponseSchema>;
