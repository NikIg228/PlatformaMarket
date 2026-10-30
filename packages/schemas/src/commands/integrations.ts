import { z } from "zod";
import { integrationPriceTaxSchema } from "../integration-tax";

export const integrationProviderSchema = z.enum(["MOYSKLAD", "ONE_C", "CUSTOM_API", "MOCK"]);

export const integrationConnectionModeSchema = z.enum(["API", "AGENT", "WEBHOOK", "HYBRID"]);

export const integrationDataTypeSchema = z.enum(["CATALOG", "PRICE", "INVENTORY", "ORDER", "RESERVATION", "SHIPMENT", "RETURN", "IMAGE"]);

export const integrationEntityTypeSchema = z.enum(["PRODUCT", "VARIANT", "WAREHOUSE", "PRICE_TYPE", "COUNTERPARTY", "ORDER_STATE"]);

export const integrationJobTypeSchema = z.enum(["TEST_CONNECTION", "DISCOVER", "FULL_SYNC", "INCREMENTAL_SYNC", "CATALOG_SYNC", "PRICE_SYNC", "INVENTORY_SYNC", "ORDER_EXPORT", "RESERVATION_CREATE", "RESERVATION_RELEASE", "WEBHOOK_PROCESS", "RECONCILIATION"]);

const integrationConfigurationSchema = z.record(z.string().trim().min(1).max(120), z.unknown());

const integrationCredentialsSchema = z.record(z.string().trim().min(1).max(120), z.string().min(1).max(8_192));

export const createIntegrationConnectionSchema = z.object({
  provider: integrationProviderSchema,
  mode: integrationConnectionModeSchema,
  displayName: z.string().trim().min(2).max(160),
  credentials: integrationCredentialsSchema.optional(),
  configuration: integrationConfigurationSchema.nullable().optional(),
  enableWebhook: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.provider === "MOYSKLAD") {
    if (!value.credentials?.accessToken) context.addIssue({ code: "custom", message: "MySklad accessToken is required", path: ["credentials", "accessToken"] });
    if (!(["API", "HYBRID"] as const).includes(value.mode as "API" | "HYBRID")) context.addIssue({ code: "custom", message: "MySklad requires API or HYBRID mode", path: ["mode"] });
  }
  if (value.provider === "ONE_C" && !(["AGENT", "HYBRID"] as const).includes(value.mode as "AGENT" | "HYBRID")) {
    context.addIssue({ code: "custom", message: "1C requires AGENT or HYBRID mode", path: ["mode"] });
  }
  if (value.provider === "ONE_C" && value.credentials && Object.keys(value.credentials).length > 0) {
    context.addIssue({ code: "custom", message: "1C agent credentials are enrolled separately", path: ["credentials"] });
  }
  if (value.provider === "CUSTOM_API" && !value.configuration?.baseUrl) {
    context.addIssue({ code: "custom", message: "Custom API baseUrl is required", path: ["configuration", "baseUrl"] });
  }
});

export const updateIntegrationConnectionSchema = z.object({
  version: z.number().int().positive(),
  displayName: z.string().trim().min(2).max(160).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "REVOKED"]).optional(),
  credentials: integrationCredentialsSchema.optional(),
  configuration: integrationConfigurationSchema.nullable().optional(),
}).refine(({ version: _version, ...changes }) => Object.values(changes).some((value) => value !== undefined), "At least one connection field must be changed");

export const createIntegrationBindingSchema = z.object({
  priceTax: integrationPriceTaxSchema.optional(),
  dataType: integrationDataTypeSchema,
  warehouseId: z.uuid().nullable().optional(),
  offerId: z.uuid().nullable().optional(),
  priority: z.number().int().min(0).max(10_000).default(100),
  configuration: integrationConfigurationSchema.nullable().optional(),
}).refine((value) => !(value.warehouseId && value.offerId), "Only one binding scope may be selected")
  .refine(value => !value.priceTax || value.dataType === "PRICE", "Налоговые условия применимы только к цене");

export const upsertIntegrationMappingSchema = z.object({
  entityType: integrationEntityTypeSchema,
  externalId: z.string().trim().min(1).max(500),
  internalId: z.uuid().nullable().optional(),
  mappingData: integrationConfigurationSchema.nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ERROR"]).default("ACTIVE"),
}).superRefine((value, context) => {
  if (["PRODUCT", "VARIANT", "WAREHOUSE", "COUNTERPARTY"].includes(value.entityType) && !value.internalId) {
    context.addIssue({ code: "custom", message: `${value.entityType} mapping requires internalId`, path: ["internalId"] });
  }
  if (!value.internalId && !value.mappingData) {
    context.addIssue({ code: "custom", message: "internalId or mappingData is required", path: ["mappingData"] });
  }
});

export const enqueueIntegrationJobSchema = z.object({
  type: integrationJobTypeSchema,
  idempotencyKey: z.string().trim().min(8).max(160),
  payload: integrationConfigurationSchema.nullable().optional(),
  maxAttempts: z.number().int().min(1).max(20).default(5),
});

export const enrollConnectorAgentSchema = z.object({
  enrollmentToken: z.string().min(32).max(512),
  version: z.string().trim().min(1).max(40),
  capabilities: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
});

export const connectorAgentHeartbeatSchema = z.object({
  version: z.string().trim().min(1).max(40),
  capabilities: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  lastError: z.string().trim().max(2_000).nullable().optional(),
});

export const completeIntegrationJobSchema = z.object({
  result: integrationConfigurationSchema.nullable().optional(),
  cursor: integrationConfigurationSchema.nullable().optional(),
});

export const failIntegrationJobSchema = z.object({
  error: z.string().trim().min(1).max(4_000),
  retryable: z.boolean().default(true),
});

export const reconciliationQuerySchema = z.object({
  status: z.enum(["MATCHED", "MISMATCH", "MISSING_EXTERNAL", "MISSING_INTERNAL", "RESOLVED"]).optional(),
  kind: z.enum(["CATALOG", "PRICE", "INVENTORY", "ORDER", "RESERVATION"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const resolveReconciliationSchema = z.object({
  resolution: z.string().trim().min(3).max(2_000),
  expectedUpdatedAt: z.iso.datetime().optional(),
});

export const resolvedReconciliationSchema = z.object({ id: z.uuid(), status: z.literal("RESOLVED"), resolution: z.string(), resolvedAt: z.iso.datetime() });

export type ResolvedReconciliation = z.infer<typeof resolvedReconciliationSchema>;

export const connectorReadinessDirectionSchema = z.enum(["CATALOG", "PRICE", "STOCK", "LOT", "ORDER", "RESERVATION", "SHIPMENT", "DOCUMENT"]);

export const updateConnectorReadinessSchema = z.object({
  displayName: z.string().trim().min(2).max(160).optional(),
  readinessStatus: z.enum(["READY", "PARTIAL", "BLOCKED"]).optional(),
  goLiveStatus: z.enum(["INTERNAL_READY", "CONNECTOR_NEEDED", "PILOT", "LIVE_VERIFIED", "BLOCKED"]).optional(),
  environment: z.enum(["LOCAL", "SANDBOX", "REAL"]).optional(),
  directions: z.record(connectorReadinessDirectionSchema, z.enum(["NONE", "READ", "WRITE", "READ_WRITE"])).optional(),
  supportsRead: z.boolean().optional(),
  supportsWrite: z.boolean().optional(),
  credentialsRequired: z.boolean().optional(),
  externalConnectorRequired: z.boolean().optional(),
  supportedVersions: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  limitations: z.array(z.string().trim().min(1).max(500)).max(50).optional(),
  evidence: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
  runbookPath: z.string().trim().max(500).nullable().optional(),
  owner: z.string().trim().min(2).max(160).optional(),
  lastVerifiedAt: z.iso.datetime().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one readiness field must be changed");

export type CreateIntegrationConnectionInput = z.infer<typeof createIntegrationConnectionSchema>;

export type UpdateIntegrationConnectionInput = z.infer<typeof updateIntegrationConnectionSchema>;

export type CreateIntegrationBindingInput = z.infer<typeof createIntegrationBindingSchema>;

export type UpsertIntegrationMappingInput = z.infer<typeof upsertIntegrationMappingSchema>;

export type EnqueueIntegrationJobInput = z.infer<typeof enqueueIntegrationJobSchema>;

export type EnrollConnectorAgentInput = z.infer<typeof enrollConnectorAgentSchema>;

export type ConnectorAgentHeartbeatInput = z.infer<typeof connectorAgentHeartbeatSchema>;

export type CompleteIntegrationJobInput = z.infer<typeof completeIntegrationJobSchema>;

export type FailIntegrationJobInput = z.infer<typeof failIntegrationJobSchema>;

export type ReconciliationQueryInput = z.infer<typeof reconciliationQuerySchema>;

export type ResolveReconciliationInput = z.infer<typeof resolveReconciliationSchema>;

export type UpdateConnectorReadinessInput = z.infer<typeof updateConnectorReadinessSchema>;
