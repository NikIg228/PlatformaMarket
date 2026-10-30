import { z } from "zod";
import { nullableDateTimeSchema, dateTimeSchema, decimalStringSchema, currencySchema } from "./primitives.js";

export const orderDocumentKindSchema = z.enum([
  "ORDER_SPECIFICATION",
  "INVOICE",
  "WAYBILL",
]);

export const generateOrderDocumentPackSchema = z.object({
  shipmentId: z.uuid(),
});

export const orderDocumentResponseSchema = z
  .object({
    id: z.uuid(),
    supplierOrderId: z.uuid(),
    shipmentId: z.uuid(),
    kind: orderDocumentKindSchema,
    format: z.enum(["PDF", "DOCX"]),
    status: z.string(),
    title: z.string(),
    documentNumber: z.string(),
    version: z.number().int().positive(),
    fileName: z.string().nullable(),
    checksumSha256: z.string().nullable(),
    generatedAt: nullableDateTimeSchema,
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
  })
  .passthrough();

export const orderDocumentPackResponseSchema = z.object({
  supplierOrderId: z.uuid(),
  shipmentId: z.uuid(),
  documents: z.array(orderDocumentResponseSchema).length(3),
});

export const preparedOrderDocumentsResponseSchema = z.object({
  supplierOrderId: z.uuid(),
  documents: z.array(orderDocumentResponseSchema).length(2),
});

export const documentArchiveCategorySchema = z.enum([
  "CONTRACT",
  "ORDER",
  "PAYMENT",
  "SHIPMENT",
  "CLOSING",
  "COMPLIANCE",
  "OTHER",
]);

export const documentArchiveKindSchema = z.enum([
  "MARKETPLACE_SUPPLIER_AGREEMENT",
  "MARKETPLACE_BUYER_TERMS",
  "FRAMEWORK_SUPPLY_AGREEMENT",
  "CONTRACT_ADDENDUM",
  "ORDER_SPECIFICATION",
  "ORDER_CONFIRMATION",
  "INVOICE",
  "PAYMENT_PROOF",
  "PAYMENT_CONFIRMATION",
  "REFUND_CONFIRMATION",
  "WAYBILL",
  "ACCEPTANCE_ACT",
  "ACCOMPANYING_DOCUMENT",
  "TAX_CLOSING_DOCUMENT",
  "INSTALLATION_ACT",
  "TRAINING_ACT",
  "WARRANTY",
  "COMMISSIONING_ACT",
  "REGISTRATION_CERTIFICATE",
  "LICENSE",
  "CERTIFICATE",
  "OTHER",
]);

export const documentArchiveAccountingStatusSchema = z.enum([
  "NOT_APPLICABLE",
  "PENDING_REVIEW",
  "REVIEWED",
  "RECONCILED",
  "DISPUTED",
]);

export const documentArchiveQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  view: z.enum(["AWAITING_SIGNATURE", "ATTENTION", "ARCHIVED"]).optional(),
  category: documentArchiveCategorySchema.optional(),
  kind: documentArchiveKindSchema.optional(),
  status: z.enum(["DRAFT", "GENERATING", "GENERATED", "AWAITING_SIGNATURE", "PARTIALLY_SIGNED", "SIGNED", "REJECTED", "EXPIRED", "SUPERSEDED", "ARCHIVED", "FAILED"]).optional(),
  accountingStatus: documentArchiveAccountingStatusSchema.optional(),
  counterpartyOrganizationId: z.uuid().optional(),
  supplierOrderId: z.uuid().optional(),
  dateFrom: dateTimeSchema.optional(),
  dateTo: dateTimeSchema.optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
  message: "dateFrom must not be after dateTo",
  path: ["dateTo"],
});

export const documentArchiveParticipantSchema = z.object({
  organizationId: z.uuid(),
  role: z.enum(["OWNER", "ISSUER", "RECIPIENT", "SIGNER", "PLATFORM"]),
  organization: z.object({
    id: z.uuid(),
    displayName: z.string(),
    legalName: z.string(),
    bin: z.string(),
  }),
});

export const documentArchiveSignatureSchema = z.object({
  id: z.uuid(),
  signerOrganizationId: z.uuid().nullable(),
  signerName: z.string().nullable(),
  method: z.enum(["EDS", "EGOV_QR", "SIMPLE", "EXTERNAL", "MOCK"]),
  status: z.enum(["PENDING", "SESSION_CREATED", "SIGNED", "REJECTED", "EXPIRED", "FAILED"]),
  signedAt: nullableDateTimeSchema,
});

export const documentArchiveVersionSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  status: z.string(),
  documentDate: dateTimeSchema,
  createdAt: dateTimeSchema,
});

export const documentArchiveItemSchema = z.object({
  id: z.uuid(),
  ownerOrganizationId: z.uuid(),
  category: documentArchiveCategorySchema,
  kind: documentArchiveKindSchema,
  format: z.enum(["PDF", "DOCX"]),
  source: z.enum(["GENERATED", "UPLOADED", "INTEGRATION"]),
  status: z.enum(["DRAFT", "GENERATING", "GENERATED", "AWAITING_SIGNATURE", "PARTIALLY_SIGNED", "SIGNED", "REJECTED", "EXPIRED", "SUPERSEDED", "ARCHIVED", "FAILED"]),
  accountingStatus: documentArchiveAccountingStatusSchema,
  title: z.string(),
  documentNumber: z.string(),
  documentDate: dateTimeSchema,
  amountMinor: decimalStringSchema.nullable(),
  currency: currencySchema.nullable(),
  version: z.number().int().positive(),
  fileName: z.string().nullable(),
  checksumSha256: z.string().nullable(),
  immutableAt: nullableDateTimeSchema,
  generatedAt: nullableDateTimeSchema,
  expiresAt: nullableDateTimeSchema,
  baseAgreementDocumentId: z.uuid().nullable(),
  supplierOrder: z.object({
    id: z.uuid(),
    orderNumber: z.string(),
    paymentStatus: z.string(),
    buyerOrganizationId: z.uuid(),
    supplierOrganizationId: z.uuid(),
  }).nullable(),
  paymentIntent: z.object({ id: z.uuid(), status: z.string() }).nullable(),
  paymentTransaction: z.object({ id: z.uuid(), type: z.string(), status: z.string() }).nullable(),
  refund: z.object({ id: z.uuid(), status: z.string() }).nullable(),
  participants: z.array(documentArchiveParticipantSchema),
  signatures: z.array(documentArchiveSignatureSchema),
  versions: z.array(documentArchiveVersionSchema),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const documentArchivePageResponseSchema = z.object({
  items: z.array(documentArchiveItemSchema),
  nextCursor: z.uuid().nullable(),
});

export const uploadedDocumentSchema = documentArchiveItemSchema.omit({
  supplierOrder: true, paymentIntent: true, paymentTransaction: true, refund: true,
  participants: true, versions: true,
}).extend({
  templateId: z.uuid().nullable(), checkoutId: z.uuid().nullable(), supplierOrderId: z.uuid().nullable(),
  shipmentId: z.uuid().nullable(), paymentIntentId: z.uuid().nullable(), paymentTransactionId: z.uuid().nullable(),
  refundId: z.uuid().nullable(), previousVersionId: z.uuid().nullable(),
  storageKey: z.string().nullable(), contentType: z.string().nullable(), byteSize: z.number().int().nullable(),
  requiredSignatureCount: z.number().int().nonnegative(), externalId: z.string().nullable(), failureReason: z.string().nullable(),
  templateSnapshot: z.unknown(), dataSnapshot: z.unknown(), metadata: z.unknown(),
});

export type UploadedDocument = z.infer<typeof uploadedDocumentSchema>;

export const documentArchiveSummaryResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  awaitingSignature: z.number().int().nonnegative(),
  attention: z.number().int().nonnegative(),
  thisMonth: z.number().int().nonnegative(),
  byCategory: z.record(documentArchiveCategorySchema, z.number().int().nonnegative()),
});

export type GenerateOrderDocumentPackRequest = z.input<
  typeof generateOrderDocumentPackSchema
>;

export type OrderDocumentResponse = z.infer<typeof orderDocumentResponseSchema>;

export type OrderDocumentPackResponse = z.infer<
  typeof orderDocumentPackResponseSchema
>;

export type DocumentArchiveQuery = z.output<typeof documentArchiveQuerySchema>;

export type DocumentArchiveQueryInput = z.input<typeof documentArchiveQuerySchema>;

export type DocumentArchiveItem = z.infer<typeof documentArchiveItemSchema>;

export type DocumentArchivePageResponse = z.infer<typeof documentArchivePageResponseSchema>;

export type DocumentArchiveSummaryResponse = z.infer<typeof documentArchiveSummaryResponseSchema>;

export type PreparedOrderDocumentsResponse = z.infer<typeof preparedOrderDocumentsResponseSchema>;
