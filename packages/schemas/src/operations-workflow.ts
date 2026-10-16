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
export const operationPrioritySchema = z.enum(["CRITICAL", "HIGH", "NORMAL", "LOW"]);
export const operationWorkQueueQuerySchema = z.object({
  q: z.string().trim().max(200).regex(/^[^\u0000-\u001f\u007f]*$/).default(""),
  kind: z.enum(["ALL", ...operationQueueTypeSchema.options]).default("ALL"),
  priority: operationPrioritySchema.optional(),
  assignment: z.enum(["ALL", "MINE", "UNASSIGNED", "ASSIGNED"]).default("ALL"),
  due: z.enum(["ALL", "OVERDUE", "SCHEDULED", "UNSCHEDULED"]).default("ALL"),
  sort: z.enum(["queue", "oldest", "recent"]).default("queue"),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();
/** One case is (queueType, source id); distinct reasons on one order remain distinct. */
export const operationQueueItemSchema = z.object({
  id: z.uuid(), caseKey: z.string(), queueType: operationQueueTypeSchema,
  title: z.string(), organizations: z.array(z.object({ id: z.uuid(), name: z.string() })),
  openedAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
  priority: operationPrioritySchema, dueAt: z.iso.datetime().nullable(), isOverdue: z.boolean(),
  reason: z.string(), href: z.string(), assignment: operationAssignmentResultSchema.nullable(),
}).strict();
export const operationWorkQueueSchema = z.object({
  generatedAt: z.iso.datetime(), operatorOrganizationId: z.uuid(),
  totalOpenItems: z.number().int().nonnegative(), total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(), limit: z.number().int().positive(), hasMore: z.boolean(),
  items: z.array(operationQueueItemSchema),
}).strict();
export type OperationQueueType = z.infer<typeof operationQueueTypeSchema>;
export type OperationObject = z.infer<typeof operationObjectSchema>;
export type OperationAssignment = z.infer<typeof operationAssignmentSchema>;
export type OperationAssignmentResult = z.infer<typeof operationAssignmentResultSchema>;
export type OperationWorkQueue = z.infer<typeof operationWorkQueueSchema>;
export type OperationWorkQueueQuery = z.infer<typeof operationWorkQueueQuerySchema>;
export type OperationQueueItem = z.infer<typeof operationQueueItemSchema>;
export type OperationHistory = z.infer<typeof operationHistorySchema>;
