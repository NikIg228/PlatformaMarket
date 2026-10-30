import { z } from "zod";
import { vatSelectionSchema } from "../vat";
import { IMPORT_UPLOAD_MAX_BASE64_CHARACTERS } from "../document-upload-limits";

export const supplierColumnMappingSchema = z.object({
  externalId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  supplierSku: z.string().trim().min(1).max(120).optional(),
  gtin: z.string().trim().min(1).max(120).optional(),
  brand: z.string().trim().min(1).max(120).optional(),
  manufacturer: z.string().trim().min(1).max(120).optional(),
  unit: z.string().trim().min(1).max(120).optional(),
  priceMinor: z.string().trim().min(1).max(120).optional(),
  priceUnit: z.enum(["MAJOR", "MINOR"]).optional(),
  vatMode: z.string().trim().min(1).max(120).optional(),
  vatRate: z.string().trim().min(1).max(120).optional(),
  vatBasis: z.string().trim().min(1).max(120).optional(),
  priceIncludesVat: z.boolean().optional(),
  defaultVat: vatSelectionSchema.optional(),
  expectedRequisitesVersion: z.number().int().positive().optional(),
  taxAcknowledged: z.literal(true).optional(),
  currency: z.string().trim().min(1).max(120).optional(),
  quantityOnHand: z.string().trim().min(1).max(120).optional(),
  lotNumber: z.string().trim().min(1).max(120).optional(),
  expirationDate: z.string().trim().min(1).max(120).optional(),
});

const rawImportCellSchema = z.union([z.string().max(4_000), z.number(), z.boolean(), z.null()]);

const rawImportRowSchema = z.record(z.string().max(200), rawImportCellSchema).refine((row) => Object.keys(row).length <= 100, "Import rows cannot contain more than 100 columns");

export const supplierImportPreviewInputSchema = z.object({ fileName: z.string().trim().min(1).max(240), fileType: z.enum(["CSV", "EXCEL"]), contentBase64: z.string().min(4).max(IMPORT_UPLOAD_MAX_BASE64_CHARACTERS) });

export const supplierImportPreviewSchema = z.object({ headers: z.array(z.string()).max(100), rows: z.array(z.object({ rowNumber: z.number().int().positive(), rawData: rawImportRowSchema })).max(5000) });

export type SupplierImportPreviewInput = z.infer<typeof supplierImportPreviewInputSchema>;

export type SupplierImportPreview = z.infer<typeof supplierImportPreviewSchema>;

export const supplierImportTaxPreviewInputSchema = z.object({
  columnMapping: supplierColumnMappingSchema,
  rows: z.array(z.object({ rowNumber: z.number().int().positive(), rawData: rawImportRowSchema })).min(1).max(5000),
});

export const supplierImportTaxPreviewSchema = z.object({
  previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  counts: z.object({ inherited: z.number().int(), individual: z.number().int(), unchanged: z.number().int(), errors: z.number().int(), unknown: z.number().int() }),
  items: z.array(z.object({ rowNumber: z.number().int(), kind: z.enum(["INHERITED", "INDIVIDUAL", "UNCHANGED", "ERROR", "UNKNOWN"]),
    amountMinor: z.string().nullable(), selection: vatSelectionSchema.nullable(), issue: z.string().nullable(),
    offerId: z.uuid().nullable(), offerVersion: z.number().int().nullable(), priceId: z.uuid().nullable(), variantId: z.uuid().nullable(),
  })).max(5000),
});

export type SupplierImportTaxPreviewInput = z.infer<typeof supplierImportTaxPreviewInputSchema>;

export type SupplierImportTaxPreview = z.infer<typeof supplierImportTaxPreviewSchema>;

export const createImportBatchSchema = z.object({
  taxPreviewHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  sourceId: z.uuid(),
  fileName: z.string().trim().min(1).max(240),
  fileType: z.enum(["MANUAL", "CSV", "EXCEL", "PDF"]),
  columnMapping: supplierColumnMappingSchema,
  rows: z.array(rawImportRowSchema).min(1).max(5_000).optional(),
  contentBase64: z.string().min(4).max(IMPORT_UPLOAD_MAX_BASE64_CHARACTERS).optional(),
}).refine((value) => value.rows !== undefined || value.contentBase64 !== undefined, {
  message: "Rows or file content must be provided",
});

export const supplierImportBatchStatusSchema = z.enum([
  "UPLOADED",
  "MAPPED",
  "REVIEW_REQUIRED",
  "PROCESSING",
  "COMPLETED",
  "COMPLETED_WITH_ERRORS",
  "FAILED",
  "ROLLING_BACK",
  "ROLLED_BACK",
]);

export const supplierImportRowStatusSchema = z.enum([
  "RAW",
  "NORMALIZED",
  "MATCH_PENDING",
  "MATCHED",
  "REJECTED",
  "PUBLISHED",
  "ROLLED_BACK",
]);

export const supplierImportBatchResponseSchema = z
  .object({
    id: z.uuid(),
    supplierOrganizationId: z.uuid(),
    sourceId: z.uuid(),
    fileName: z.string(),
    fileType: z.enum(["MANUAL", "CSV", "EXCEL", "PDF", "API", "ERP"]),
    rows: z.array(z.object({
      id: z.uuid(),
      rowNumber: z.number().int().positive(),
      rawData: z.record(z.string(), rawImportCellSchema),
      status: supplierImportRowStatusSchema,
      errorCode: z.string().nullable(),
      errorMessage: z.string().nullable(),
    })).optional(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    status: supplierImportBatchStatusSchema,
    columnMapping: z.record(z.string(), z.unknown()).nullable(),
    extractionMetadata: z.record(z.string(), z.unknown()).nullable(),
    totalRows: z.number().int().nonnegative(),
    processedRows: z.number().int().nonnegative(),
    errorRows: z.number().int().nonnegative(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    rollbackReason: z.string().nullable(),
    rollbackEvidence: z.record(z.string(), z.unknown()).nullable(),
    rolledBackAt: z.iso.datetime().nullable(),
    rolledBackById: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .passthrough();

export const supplierImportHistoryQuerySchema = z.object({ cursor: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(50) });

export const supplierImportHistoryResponseSchema = z.array(supplierImportBatchResponseSchema);

export type SupplierImportHistoryQuery = z.input<typeof supplierImportHistoryQuerySchema>;

export const supplierImportConflictSchema = z.object({
  rowNumber: z.number().int().positive(),
  status: supplierImportRowStatusSchema,
  code: z.string().nullable(),
  message: z.string().nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
});

export const supplierImportDiagnosticsResponseSchema = z.object({
  batchId: z.uuid(),
  status: supplierImportBatchStatusSchema,
  totalRows: z.number().int().nonnegative(),
  processedRows: z.number().int().nonnegative(),
  errorRows: z.number().int().nonnegative(),
  byStatus: z.record(z.string(), z.number().int().nonnegative()),
  conflictCount: z.number().int().nonnegative(),
  conflicts: z.array(supplierImportConflictSchema),
  idempotency: z.string(),
});

export const confirmSupplierItemMatchSchema = z.object({ productVariantId: z.uuid() });

export const rollbackImportBatchSchema = z.object({
  reason: z.string().trim().min(10).max(500),
  expectedUpdatedAt: z.iso.datetime(),
});

export const supplierImportRollbackResponseSchema = z.object({
  batchId: z.uuid(),
  status: z.literal("ROLLED_BACK"),
  rolledBackAt: z.iso.datetime(),
  reason: z.string(),
  preserved: z.object({
    checksum: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    rawRows: z.number().int().nonnegative(),
    uploadAsset: z.boolean(),
  }),
  effects: z.object({
    rows: z.number().int().nonnegative(),
    externalItems: z.number().int().nonnegative(),
    offers: z.number().int().nonnegative(),
    prices: z.number().int().nonnegative(),
    inventoryBalances: z.number().int().nonnegative(),
    mappingMemories: z.number().int().nonnegative(),
    productCandidates: z.number().int().nonnegative(),
    products: z.number().int().nonnegative(),
  }),
});

export type SupplierColumnMappingInput = z.infer<typeof supplierColumnMappingSchema>;

export type CreateImportBatchInput = z.infer<typeof createImportBatchSchema>;

export type RollbackImportBatchInput = z.infer<typeof rollbackImportBatchSchema>;

export type SupplierImportBatchResponse = z.infer<
  typeof supplierImportBatchResponseSchema
>;

export type SupplierImportDiagnosticsResponse = z.infer<
  typeof supplierImportDiagnosticsResponseSchema
>;

export type SupplierImportRollbackResponse = z.infer<
  typeof supplierImportRollbackResponseSchema
>;

export type ConfirmSupplierItemMatchInput = z.infer<typeof confirmSupplierItemMatchSchema>;
