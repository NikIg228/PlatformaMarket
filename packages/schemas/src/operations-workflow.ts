import { z } from "zod";

export const operationQueueTypeSchema = z.enum(["ORGANIZATION_REVIEW", "PROMOTION_REVIEW", "CATALOG_REVIEW", "COMPLIANCE_REVIEW", "INTEGRATION_RECONCILIATION", "IMPORT_ATTENTION", "AGREEMENT_SIGNATURE", "SUPPLIER_CONFIRMATION", "STALE_INVENTORY"]);
export const operationAssignmentSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]),
  assigneeId: z.uuid().nullable(),
  dueAt: z.iso.datetime().nullable(),
  reason: z.string().trim().min(10).max(1_000),
  idempotencyKey: z.uuid(),
}).strict();
export const operationAssignmentResultSchema = z.object({ id: z.uuid(), version: z.number().int().positive(), priority: z.string(), assigneeId: z.uuid().nullable(), assigneeName: z.string().nullable(), dueAt: z.string().nullable(), reason: z.string(), updatedAt: z.string() });
export const operationHistorySchema = z.array(z.object({ id: z.uuid(), action: z.string(), actorId: z.uuid().nullable(), createdAt: z.string(), before: z.unknown(), after: z.unknown() }));
export const operationAssigneesSchema = z.array(z.object({ id: z.uuid(), displayName: z.string() }));
export const operationObjectSchema = z.object({ id: z.uuid(), queueType: operationQueueTypeSchema, title: z.string(), fields: z.array(z.object({ label: z.string(), value: z.string() })) });
export const operationQueueItemSchema = z.object({ id: z.uuid(), createdAt: z.string().optional(), updatedAt: z.string().optional(), detectedAt: z.string().optional(), evaluatedAt: z.string().optional(), proposedName: z.string().optional(), orderNumber: z.string().optional(), agreementNumber: z.string().optional(), fileName: z.string().optional(), reason: z.string(), href: z.string(), assignment: operationAssignmentResultSchema.nullable() }).passthrough();
export const operationWorkQueueSchema = z.object({ generatedAt: z.string(), operatorOrganizationId: z.uuid(), totalOpenItems: z.number().int(), sections: z.array(z.object({ type: operationQueueTypeSchema, priority: z.string(), count: z.number().int(), hasMore: z.boolean(), items: z.array(operationQueueItemSchema) })) });
export type OperationQueueType = z.infer<typeof operationQueueTypeSchema>;
export type OperationAssignment = z.infer<typeof operationAssignmentSchema>;
export type OperationAssignmentResult = z.infer<typeof operationAssignmentResultSchema>;
export type OperationWorkQueue = z.infer<typeof operationWorkQueueSchema>;
export type OperationHistory = z.infer<typeof operationHistorySchema>;
