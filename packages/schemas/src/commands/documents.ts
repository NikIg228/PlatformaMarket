import { z } from "zod";
import { DOCUMENT_UPLOAD_MAX_BASE64_CHARACTERS } from "../document-upload-limits";

export const documentKindSchema = z.enum(["MARKETPLACE_SUPPLIER_AGREEMENT", "MARKETPLACE_BUYER_TERMS", "FRAMEWORK_SUPPLY_AGREEMENT", "CONTRACT_ADDENDUM", "ORDER_SPECIFICATION", "ORDER_CONFIRMATION", "INVOICE", "PAYMENT_PROOF", "PAYMENT_CONFIRMATION", "REFUND_CONFIRMATION", "WAYBILL", "ACCEPTANCE_ACT", "ACCOMPANYING_DOCUMENT", "TAX_CLOSING_DOCUMENT", "INSTALLATION_ACT", "TRAINING_ACT", "WARRANTY", "COMMISSIONING_ACT", "REGISTRATION_CERTIFICATE", "LICENSE", "CERTIFICATE", "OTHER"]);

export const documentFormatSchema = z.enum(["PDF", "DOCX"]);

export const documentCategorySchema = z.enum(["CONTRACT", "ORDER", "PAYMENT", "SHIPMENT", "CLOSING", "COMPLIANCE", "OTHER"]);

export const documentAccountingStatusSchema = z.enum(["NOT_APPLICABLE", "PENDING_REVIEW", "REVIEWED", "RECONCILED", "DISPUTED"]);

export const documentPartyRoleSchema = z.enum(["OWNER", "ISSUER", "RECIPIENT", "SIGNER", "PLATFORM"]);

const documentAmountMinorSchema = z.string().regex(/^\d+$/);

const documentMoneyFields = {
  amountMinor: documentAmountMinorSchema.nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
};

export const createDocumentTemplateSchema = z.object({
  code: z.string().trim().min(2).max(120).regex(/^[A-Z0-9_.-]+$/),
  version: z.number().int().positive(),
  kind: documentKindSchema,
  name: z.string().trim().min(2).max(240),
  format: documentFormatSchema.default("PDF"),
  locale: z.string().trim().min(2).max(16).default("ru-KZ"),
  templateBody: z.string().min(1).max(200_000),
  requiredSignatureCount: z.number().int().nonnegative().max(20).default(0),
  signatureMethods: z.array(z.enum(["EDS", "EGOV_QR", "SIMPLE", "EXTERNAL", "MOCK"])).max(5).default(["MOCK"]),
  effectiveFrom: z.iso.datetime().optional(),
  effectiveTo: z.iso.datetime().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).refine((value) => !value.effectiveTo || !value.effectiveFrom || value.effectiveTo >= value.effectiveFrom, "Template effectiveTo must not precede effectiveFrom");

export const createGeneratedDocumentSchema = z.object({
  ownerOrganizationId: z.uuid(),
  templateId: z.uuid(),
  checkoutId: z.uuid().nullable().optional(),
  supplierOrderId: z.uuid().nullable().optional(),
  shipmentId: z.uuid().nullable().optional(),
  paymentIntentId: z.uuid().nullable().optional(),
  paymentTransactionId: z.uuid().nullable().optional(),
  refundId: z.uuid().nullable().optional(),
  baseAgreementDocumentId: z.uuid().nullable().optional(),
  category: documentCategorySchema.optional(),
  accountingStatus: documentAccountingStatusSchema.optional(),
  title: z.string().trim().min(2).max(240),
  documentNumber: z.string().trim().min(1).max(120),
  documentDate: z.iso.datetime().optional(),
  ...documentMoneyFields,
  data: z.record(z.string(), z.unknown()),
  expiresAt: z.iso.datetime().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).superRefine((value, context) => {
  if ((value.amountMinor == null) !== (value.currency == null)) context.addIssue({ code: "custom", message: "Document amount and currency must be provided together" });
});

export const uploadDocumentSchema = z.object({
  ownerOrganizationId: z.uuid(),
  kind: documentKindSchema,
  format: documentFormatSchema,
  checkoutId: z.uuid().nullable().optional(),
  supplierOrderId: z.uuid().nullable().optional(),
  shipmentId: z.uuid().nullable().optional(),
  paymentIntentId: z.uuid().nullable().optional(),
  paymentTransactionId: z.uuid().nullable().optional(),
  refundId: z.uuid().nullable().optional(),
  baseAgreementDocumentId: z.uuid().nullable().optional(),
  category: documentCategorySchema.optional(),
  accountingStatus: documentAccountingStatusSchema.optional(),
  title: z.string().trim().min(2).max(240),
  documentNumber: z.string().trim().min(1).max(120),
  documentDate: z.iso.datetime().optional(),
  ...documentMoneyFields,
  fileName: z.string().trim().min(1).max(255),
  contentBase64: z.string().min(4).max(DOCUMENT_UPLOAD_MAX_BASE64_CHARACTERS),
  requiredSignatureCount: z.number().int().nonnegative().max(20).default(0),
  expiresAt: z.iso.datetime().nullable().optional(),
  externalId: z.string().trim().max(240).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).superRefine((value, context) => {
  if ((value.amountMinor == null) !== (value.currency == null)) context.addIssue({ code: "custom", message: "Document amount and currency must be provided together" });
});

export const createDocumentVersionSchema = z.object({
  templateId: z.uuid().optional(),
  data: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(2).max(1_000),
});

export const createSignatureSessionSchema = z.object({
  method: z.enum(["EDS", "EGOV_QR", "SIMPLE", "EXTERNAL", "MOCK"]),
  signerOrganizationId: z.uuid().nullable().optional(),
  signerUserId: z.uuid().nullable().optional(),
  signerName: z.string().trim().max(240).nullable().optional(),
  expiresInMinutes: z.number().int().min(5).max(10_080).default(60),
});

export const completeDocumentSignatureSchema = z.object({
  status: z.enum(["SIGNED", "REJECTED", "FAILED"]),
  externalSignatureId: z.string().trim().max(240).nullable().optional(),
  signatureHash: z.string().trim().max(512).nullable().optional(),
  rejectionReason: z.string().trim().max(1_000).nullable().optional(),
  evidence: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const documentQuerySchema = z.object({
  ownerOrganizationId: z.uuid().optional(),
  supplierOrderId: z.uuid().optional(),
  checkoutId: z.uuid().optional(),
  status: z.enum(["DRAFT", "GENERATING", "GENERATED", "AWAITING_SIGNATURE", "PARTIALLY_SIGNED", "SIGNED", "REJECTED", "EXPIRED", "SUPERSEDED", "ARCHIVED", "FAILED"]).optional(),
  kind: documentKindSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const updateDocumentAccountingStatusSchema = z.object({
  status: documentAccountingStatusSchema.exclude(["NOT_APPLICABLE"]),
  reason: z.string().trim().min(2).max(1_000),
  expectedUpdatedAt: z.iso.datetime(),
});

export type CreateDocumentTemplateInput = z.infer<typeof createDocumentTemplateSchema>;

export type CreateGeneratedDocumentInput = z.infer<typeof createGeneratedDocumentSchema>;

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export type CreateDocumentVersionInput = z.infer<typeof createDocumentVersionSchema>;

export type CreateSignatureSessionInput = z.infer<typeof createSignatureSessionSchema>;

export type CompleteDocumentSignatureInput = z.infer<typeof completeDocumentSignatureSchema>;

export type DocumentQueryInput = z.infer<typeof documentQuerySchema>;

export type UpdateDocumentAccountingStatusInput = z.infer<typeof updateDocumentAccountingStatusSchema>;
