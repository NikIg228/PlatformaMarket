import { z } from "zod";

/** No tenant, filter, command or authority is accepted from this read URL. */
export const operatorDashboardQuerySchema = z.strictObject({});

export const operatorCountSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("AVAILABLE"), value: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }),
  z.strictObject({ status: z.literal("UNAVAILABLE"), value: z.null(), reason: z.literal("SOURCE_UNAVAILABLE") }),
]);

export const operatorDashboardSchema = z.strictObject({
  observedAt: z.iso.datetime(),
  scope: z.literal("PLATFORM_CURRENT_ALL_STATUSES"),
  organizations: operatorCountSchema,
  masterProducts: operatorCountSchema,
  effectivePermissions: operatorCountSchema,
});

export type OperatorCount = z.infer<typeof operatorCountSchema>;
export type OperatorDashboard = z.infer<typeof operatorDashboardSchema>;

export const operatorCapabilitySchema = z.strictObject({
  id: z.enum(["AI_ASSISTANT", "TRUST", "PROMOTIONS", "BILLING", "RECOMMENDATIONS", "AI_MODEL", "PAYMENT_CONNECTOR"]),
  status: z.enum(["AVAILABLE", "DISABLED_BY_PROFILE", "NOT_CONFIGURED", "EXTERNAL_CONFIRMATION_REQUIRED", "UNAVAILABLE"]),
  reason: z.enum(["PROFILE_ENABLED", "PROFILE_DISABLED", "EXTERNAL_CONFIG_MISSING", "EXTERNAL_VERIFICATION_MISSING", "EXTERNAL_PROVIDER_MISSING", "SOURCE_UNAVAILABLE"]),
  section: z.enum(["imports", "orders", "security", "catalog"]).nullable(),
});

const registryCountsSchema = z.strictObject({
  total: z.number().int().nonnegative(),
  readinessReady: z.number().int().nonnegative(),
  registeredLiveVerified: z.number().int().nonnegative(),
  externalDependencies: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
});
export const operatorConnectorSummarySchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("AVAILABLE"), counts: registryCountsSchema }),
  z.strictObject({ status: z.literal("UNAVAILABLE"), counts: z.null(), reason: z.literal("SOURCE_UNAVAILABLE") }),
]);
export const operatorCapabilitiesSchema = z.strictObject({
  observedAt: z.iso.datetime(),
  scope: z.literal("PLATFORM_CONFIGURATION"),
  profile: z.enum(["pilot", "go_live"]),
  capabilities: z.array(operatorCapabilitySchema).length(7),
  connectors: operatorConnectorSummarySchema,
  activePaymentProviders: operatorCountSchema,
  activeComplianceRules: operatorCountSchema,
});
export type OperatorCapability = z.infer<typeof operatorCapabilitySchema>;
export type OperatorConnectorSummary = z.infer<typeof operatorConnectorSummarySchema>;
export type OperatorCapabilities = z.infer<typeof operatorCapabilitiesSchema>;
