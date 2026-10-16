import { z } from "zod";

const quantity = z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/);
export const discrepancyKindSchema = z.enum(["SHORTAGE", "DAMAGED", "NOT_RECEIVED", "EXCESS", "WRONG_GOODS", "RECEIPT_ERROR"]);
export const discrepancyResolutionSchema = z.enum(["RESUPPLY", "REDUCTION", "RETURN", "CORRECTION", "OTHER"]);
export const discrepancyStatementSchema = z.object({
  kind: discrepancyKindSchema,
  reason: z.string().trim().min(3).max(3000),
  requestedResolution: discrepancyResolutionSchema,
  lines: z.array(z.object({ shipmentItemId: z.uuid(), actualQuantity: quantity, damagedQuantity: quantity }).strict()).min(1).max(200),
  attachmentIds: z.array(z.uuid()).max(10),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.lines.map(line => line.shipmentItemId)).size !== value.lines.length)
    ctx.addIssue({ code: "custom", path: ["lines"], message: "Строки не должны повторяться" });
  if (new Set(value.attachmentIds).size !== value.attachmentIds.length)
    ctx.addIssue({ code: "custom", path: ["attachmentIds"], message: "Вложения не должны повторяться" });
});
const commandBase = z.object({
  expectedOrderVersion: z.number().int().positive(), expectedShipmentVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(160),
});
const existing = commandBase.extend({ discrepancyId: z.uuid(), expectedExceptionVersion: z.number().int().positive() });
export const orderDiscrepancyCommandSchema = z.discriminatedUnion("action", [
  commandBase.extend({ action: z.literal("CREATE"), shipmentId: z.uuid(), sourceDocumentId: z.uuid().nullable(),
    sourceDocumentVersion: z.number().int().positive().nullable(), sourceDocumentChecksum: z.string().nullable(),
    previousDiscrepancyId: z.uuid().nullable(), sourceReceiptEventId: z.uuid().nullable(), statement: discrepancyStatementSchema }).strict(),
  existing.extend({ action: z.literal("SAVE"), statement: discrepancyStatementSchema }).strict(),
  existing.extend({ action: z.literal("SUBMIT") }).strict(),
  existing.extend({ action: z.literal("RESPOND"), decision: z.enum(["AGREE", "REJECT", "COUNTER"]),
    resolution: discrepancyResolutionSchema, reason: z.string().trim().min(3).max(3000) }).strict(),
  existing.extend({ action: z.literal("DECIDE"), accepted: z.boolean(), reason: z.string().trim().min(3).max(3000) }).strict(),
  existing.extend({ action: z.literal("DISPATCH_RESUPPLY"), acknowledged: z.literal(true),
    carrierName: z.string().trim().min(1).max(200).nullable(), trackingNumber: z.string().trim().min(1).max(160).nullable() }).strict(),
]);
export const orderDiscrepancyResultSchema = z.object({ orderId: z.uuid(), discrepancyId: z.uuid(), version: z.number().int().positive(),
  status: z.enum(["DRAFT", "SUBMITTED", "RESOLUTION_PROPOSED", "REJECTED", "AGREED"]), eventId: z.uuid() }).strict();
const sourceLine = z.object({ shipmentItemId: z.uuid(), orderItemId: z.uuid(), name: z.string(), uom: z.string(),
  sentQuantity: quantity, recordedReceivedQuantity: quantity, unitPriceMinor: z.string(), taxSnapshot: z.unknown(), isGift: z.boolean() }).strict();
export const discrepancySourceSchema = z.object({ orderVersion: z.number().int().positive(), shipmentVersion: z.number().int().positive(),
  shipmentNumber: z.string(), documentId: z.uuid().nullable(), documentVersion: z.number().int().positive().nullable(), documentChecksum: z.string().nullable(),
  documentSnapshot: z.unknown(), lines: z.array(sourceLine), sourceReceiptEventId: z.uuid().nullable() }).strict();
const attachment = z.object({ id: z.uuid(), name: z.string(), mimeType: z.string(), sizeBytes: z.number().int().positive() }).strict();
export const discrepancyResupplySchema = z.object({
  canDispatch: z.boolean(), issues: z.array(z.string()), documentStatus: z.literal("INCOMPLETE"),
  warehouseName: z.string(), recipientName: z.string(), method: z.string(),
  lines: z.array(z.object({ shipmentItemId: z.uuid(), orderItemId: z.uuid(), name: z.string(), uom: z.string(),
    originalReceivedQuantity: quantity, quantity, deliveredQuantity: quantity }).strict()),
  shipment: z.object({ id: z.uuid(), number: z.string(), status: z.string(), dispatchedAt: z.string().nullable(),
    deliveredAt: z.string().nullable(), carrierName: z.string().nullable(), trackingNumber: z.string().nullable() }).strict().nullable(),
}).strict();
export const orderDiscrepancyViewSchema = z.object({
  id: z.uuid(), shipmentId: z.uuid(), version: z.number().int().positive(), status: orderDiscrepancyResultSchema.shape.status,
  previousDiscrepancyId: z.uuid().nullable(), statement: discrepancyStatementSchema, source: discrepancySourceSchema,
  resolution: discrepancyResolutionSchema.nullable(), createdAt: z.string(), updatedAt: z.string(),
  attachments: z.array(attachment),
  resupply: discrepancyResupplySchema.nullable(),
  events: z.array(z.object({ id: z.uuid(), version: z.number().int().positive(), action: z.string(), actorId: z.uuid(),
    organizationId: z.uuid(), createdAt: z.string(), details: z.unknown() }).strict()),
}).strict();
export const orderDiscrepanciesResponseSchema = z.object({ orderId: z.uuid(), orderVersion: z.number().int().positive(),
  party: z.enum(["BUYER", "SUPPLIER"]), canWrite: z.boolean(),
  shipments: z.array(z.object({ id: z.uuid(), version: z.number().int().positive(), number: z.string(), eligible: z.boolean(),
    lines: z.array(sourceLine), documents: z.array(z.object({ id: z.uuid(), version: z.number().int().positive(), checksum: z.string().nullable(), title: z.string() }).strict()) }).strict()),
  discrepancies: z.array(orderDiscrepancyViewSchema),
}).strict();
export const discrepancyUploadSchema = z.object({ fileName: z.string().min(1).max(240), contentBase64: z.string().min(1).max(7_000_000) }).strict();
export const discrepancyAttachmentSchema = attachment;
export const discrepancyDownloadSchema = z.object({ fileName: z.string(), mimeType: z.string(), contentBase64: z.string() }).strict();
export type DiscrepancyStatement = z.infer<typeof discrepancyStatementSchema>;
export type DiscrepancySource = z.infer<typeof discrepancySourceSchema>;
export type OrderDiscrepancyCommand = z.infer<typeof orderDiscrepancyCommandSchema>;
export type OrderDiscrepancyResult = z.infer<typeof orderDiscrepancyResultSchema>;
export type OrderDiscrepanciesResponse = z.infer<typeof orderDiscrepanciesResponseSchema>;
export type OrderDiscrepancyView = z.infer<typeof orderDiscrepancyViewSchema>;
export type DiscrepancyResupply = z.infer<typeof discrepancyResupplySchema>;
