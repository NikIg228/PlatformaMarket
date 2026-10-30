import { z } from "zod";
import { DOCUMENT_UPLOAD_MAX_BASE64_CHARACTERS } from "../document-upload-limits";

export const organizationCredentialTypeSchema = z.enum(["BUSINESS_LICENSE", "MEDICAL_LICENSE", "WHOLESALE_LICENSE", "MEDICAL_DEVICE_SALE_NOTIFICATION", "REGISTRATION_CERTIFICATE", "DISTRIBUTOR_AUTHORIZATION", "QUALITY_CERTIFICATE", "OTHER"]);

export const createOrganizationCredentialSchema = z.object({
  type: organizationCredentialTypeSchema,
  number: z.string().trim().min(1).max(160),
  issuer: z.string().trim().max(240).nullable().optional(),
  validFrom: z.iso.datetime().nullable().optional(),
  validTo: z.iso.datetime().nullable().optional(),
  fileName: z.string().trim().max(255).nullable().optional(),
  contentBase64: z.string().min(4).max(DOCUMENT_UPLOAD_MAX_BASE64_CHARACTERS).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).refine((value) => Boolean(value.fileName) === Boolean(value.contentBase64), "fileName and contentBase64 must be provided together").refine((value) => !value.validFrom || !value.validTo || value.validTo >= value.validFrom, "Credential validity window is invalid");

export const reviewOrganizationCredentialSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED", "REVOKED"]),
  reason: z.string().trim().max(1_000).nullable().optional(),
}).refine((value) => value.status === "VERIFIED" || Boolean(value.reason), "A reason is required when rejecting or revoking a credential");

export const complianceRiskLevelSchema = z.enum(["GREEN", "YELLOW", "ORANGE", "RED"]);

export const complianceDecisionSchema = z.enum(["ALLOWED", "ALLOWED_WITH_DISCLOSURE", "MANUAL_REVIEW", "BLOCKED"]);

export const createComplianceRuleSchema = z.object({
  code: z.string().trim().min(2).max(120).regex(/^[A-Z0-9_.-]+$/),
  version: z.number().int().positive(),
  name: z.string().trim().min(2).max(240),
  industryCode: z.string().trim().max(120).nullable().optional(),
  categoryId: z.uuid().nullable().optional(),
  productType: z.string().trim().max(120).nullable().optional(),
  regulatoryClass: z.string().trim().max(120).nullable().optional(),
  riskLevel: complianceRiskLevelSchema,
  decision: complianceDecisionSchema,
  priority: z.number().int().min(0).max(10_000).default(100),
  conditions: z.record(z.string(), z.unknown()).default({}),
  requiredCredentialTypes: z.array(organizationCredentialTypeSchema).max(20).default([]),
  disclosureText: z.string().trim().max(2_000).nullable().optional(),
  effectiveFrom: z.iso.datetime(),
  effectiveTo: z.iso.datetime().nullable().optional(),
  supersedesRuleId: z.uuid().nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
}).refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, "Compliance rule effective window is invalid");

export const complianceEvaluationSchema = z.object({
  sellerOrganizationId: z.uuid(),
  buyerOrganizationId: z.uuid().nullable().optional(),
  offerId: z.uuid().nullable().optional(),
  warehouseId: z.uuid().nullable().optional(),
  inventoryLotId: z.uuid().nullable().optional(),
  supplierOrderId: z.uuid().nullable().optional(),
  at: z.iso.datetime().optional(),
});

export const reviewComplianceCheckSchema = z.object({
  decision: z.enum(["ALLOWED", "ALLOWED_WITH_DISCLOSURE", "BLOCKED"]),
  comment: z.string().trim().min(2).max(2_000),
});

export type CreateOrganizationCredentialInput = z.infer<typeof createOrganizationCredentialSchema>;

export type ReviewOrganizationCredentialInput = z.infer<typeof reviewOrganizationCredentialSchema>;

export type CreateComplianceRuleInput = z.infer<typeof createComplianceRuleSchema>;

export type ComplianceEvaluationInput = z.infer<typeof complianceEvaluationSchema>;

export type ReviewComplianceCheckInput = z.infer<typeof reviewComplianceCheckSchema>;
