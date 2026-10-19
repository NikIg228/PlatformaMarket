import { z } from "zod";

const offset = z.preprocess(value => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(0).max(1_000_000).default(0));
export const operatorTrustQuerySchema = z.strictObject({ incidentOffset: offset, supplierOffset: offset });
export const operatorTrustEventsQuerySchema = z.strictObject({ offset });
const count = z.number().int().nonnegative();
const date = z.iso.datetime();
const appeal = z.strictObject({ id: z.uuid(), status: z.string(), reason: z.string(), decision: z.string().nullable(), createdAt: date, decidedAt: date.nullable(), hasEvidence: z.boolean() });
export const operatorTrustIncidentSchema = z.strictObject({
  id: z.uuid(), version: z.number().int().positive(), organizationId: z.uuid().nullable(), organizationName: z.string().nullable(),
  subjectType: z.string(), subjectId: z.string(), type: z.string(), severity: z.string(), status: z.string(), reasonCode: z.string(),
  explanation: z.string(), actionType: z.string(), actionExpiresAt: date.nullable(), remediation: z.string(), restorationCondition: z.string(),
  hardBlockReason: z.string().nullable(), resolution: z.string().nullable(), createdAt: date,
  sourceEntityType: z.string().nullable(), sourceEntityId: z.string().nullable(),
  appeals: z.array(appeal), appealCount: count,
});
const supplier = z.strictObject({
  id: z.uuid(), name: z.string(), snapshot: z.strictObject({ status: z.string(), score: z.string().nullable(), confidence: z.string(), eventCount: count, computedAt: date, formulaVersion: z.string(), windowDays: count }).nullable(),
  appeals: z.array(appeal), appealCount: count,
});
const source = <T extends z.ZodType>(data: T) => z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("AVAILABLE"), data }),
  z.strictObject({ status: z.enum(["UNAVAILABLE", "FORBIDDEN"]), data: z.null() }),
]);
export const operatorTrustSchema = z.strictObject({
  observedAt: date, automaticFlow: z.literal("NOT_VERIFIED"), canResolve: z.boolean(),
  incidents: source(z.strictObject({ items: z.array(operatorTrustIncidentSchema), total: count, open: count, hardBlocks: count, pendingAppeals: count, offset: count, limit: count })),
  suppliers: source(z.strictObject({ items: z.array(supplier), total: count, offset: count, limit: count })),
  warehouses: source(z.strictObject({ total: count, verified: count })),
});
export const operatorTrustEventsSchema = z.strictObject({
  items: z.array(z.strictObject({ id: z.uuid(), metricCode: z.string(), value: z.string(), occurredAt: date, sourceEntityType: z.string(), sourceEntityId: z.string(),
    origin: z.enum(["MANUAL_RECORDED", "UNVERIFIED"]), disputed: z.boolean(), excludedAt: date.nullable() })),
  total: count, offset: count, limit: count, automaticFlow: z.literal("NOT_VERIFIED"),
});
export const operatorTrustResolveSchema = z.strictObject({ version: z.number().int().positive(), resolution: z.string().trim().min(5).max(2000) });
export const operatorTrustResolvedSchema = z.strictObject({ id: z.uuid(), version: z.number().int().positive(), status: z.literal("RESOLVED") });
export type OperatorTrustQuery = z.infer<typeof operatorTrustQuerySchema>;
export type OperatorTrust = z.infer<typeof operatorTrustSchema>;
export type OperatorTrustIncident = z.infer<typeof operatorTrustIncidentSchema>;
export type OperatorTrustEvents = z.infer<typeof operatorTrustEventsSchema>;
export type OperatorTrustResolve = z.infer<typeof operatorTrustResolveSchema>;
export type OperatorTrustResolved = z.infer<typeof operatorTrustResolvedSchema>;
