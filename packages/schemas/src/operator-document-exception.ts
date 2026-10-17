import { z } from "zod";
import { discrepancyKindSchema, discrepancyResolutionSchema, orderDiscrepancyResultSchema } from "./order-discrepancy";

const party = z.strictObject({ id: z.uuid(), name: z.string() });
const quantity = z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/);
export const operatorExceptionReviewSchema = z.strictObject({
  expectedOrderVersion: z.number().int().positive(), expectedShipmentVersion: z.number().int().positive(),
  expectedExceptionVersion: z.number().int().positive(), idempotencyKey: z.uuid(),
  reason: z.string().trim().min(10).max(3000), nextStep: z.string().trim().min(3).max(1000),
});
export const operatorExceptionReviewResultSchema = orderDiscrepancyResultSchema.extend({ reviewStatus: z.literal("REVIEWED") });
export type OperatorExceptionReview = z.infer<typeof operatorExceptionReviewSchema>;
export type OperatorExceptionReviewResult = z.infer<typeof operatorExceptionReviewResultSchema>;
/** Explicit operator projection: no private draft, attachment or document snapshot. */
export const operatorDocumentExceptionSchema = z.strictObject({
  id: z.uuid(), version: z.number().int().positive(), status: orderDiscrepancyResultSchema.shape.status.exclude(["DRAFT"]),
  kind: discrepancyKindSchema, reason: z.string(), resolution: discrepancyResolutionSchema.nullable(),
  order: z.strictObject({ id: z.uuid(), number: z.string(), version: z.number().int().positive() }),
  shipment: z.strictObject({ id: z.uuid(), number: z.string(), version: z.number().int().positive(), status: z.string() }),
  buyer: party, supplier: party,
  sourceDocument: z.strictObject({ id: z.uuid(), version: z.number().int().positive() }).nullable(),
  canViewDocuments: z.boolean(), canViewSupport: z.boolean(), canPublish: z.boolean(), reviewStatus: z.enum(["PENDING", "REVIEWED"]),
  lines: z.array(z.strictObject({ id: z.uuid(), name: z.string(), uom: z.string(), sentQuantity: quantity,
    reportedQuantity: quantity, damagedQuantity: quantity, receivedQuantity: quantity })),
  events: z.array(z.strictObject({ id: z.uuid(), action: z.string(), at: z.iso.datetime(), version: z.number().int().positive(),
    reason: z.string().nullable(), nextStep: z.string().nullable(), decision: z.string().nullable(), accepted: z.boolean().nullable() })),
  tickets: z.array(z.strictObject({ id: z.uuid(), number: z.string(), subject: z.string(), status: z.string() })),
});
export type OperatorDocumentException = z.infer<typeof operatorDocumentExceptionSchema>;
