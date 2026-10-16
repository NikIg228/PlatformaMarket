import { z } from "zod";

const version = z.number().int().positive();
const quantity = z.string().regex(/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/);
export const resupplyDocumentKindSchema = z.enum(["TRANSFER", "SETTLEMENT"]);
export const prepareResupplyDocumentSchema = z.object({
  kind: resupplyDocumentKindSchema, expectedOrderVersion: version, expectedShipmentVersion: version,
  expectedExceptionVersion: version, expectedResupplyVersion: version,
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict();
export const resupplyDocumentSnapshotSchema = z.object({
  templateVersion: z.literal("PM_RESUPPLY_WORKING_DRAFT_V1"), kind: resupplyDocumentKindSchema,
  orderId: z.uuid(), orderNumber: z.string(), discrepancyId: z.uuid(), exceptionVersion: version,
  supplier: z.object({ id: z.uuid(), name: z.string() }).strict(), buyer: z.object({ id: z.uuid(), name: z.string() }).strict(),
  sourceShipmentId: z.uuid(), sourceShipmentNumber: z.string(),
  sourceDocumentId: z.uuid().nullable(), sourceDocumentVersion: version.nullable(), sourceDocumentChecksum: z.string().nullable(),
  resupplyShipmentId: z.uuid(), resupplyShipmentNumber: z.string(), resupplyVersion: version,
  dispatchedAt: z.string().nullable(), deliveredAt: z.string().nullable(), carrierName: z.string().nullable(), trackingNumber: z.string().nullable(),
  reason: z.string(), number: z.string(), version, preparedAt: z.iso.datetime(),
  preparedBy: z.object({ id: z.uuid(), name: z.string() }).strict(),
  lines: z.array(z.object({ orderItemId: z.uuid(), name: z.string(), uom: z.string(),
    originalQuantity: quantity, originalReceivedQuantity: quantity, resupplyQuantity: quantity, receivedQuantity: quantity }).strict()).min(1),
}).strict();
export const resupplyDocumentViewSchema = z.object({
  documentId: z.uuid(), version, status: z.enum(["PREVIEW", "STALE"]), checksum: z.string(), snapshot: resupplyDocumentSnapshotSchema,
}).strict();
export const resupplyDocumentsResponseSchema = z.object({
  orderId: z.uuid(), discrepancyId: z.uuid(), party: z.enum(["BUYER", "SUPPLIER"]),
  orderVersion: version, shipmentVersion: version, exceptionVersion: version, resupplyVersion: version.nullable(),
  canPrepare: z.boolean(), canPrepareSettlement: z.boolean(), issues: z.array(z.string()), settlementIssues: z.array(z.string()),
  documents: z.array(resupplyDocumentViewSchema),
}).strict();
export type PrepareResupplyDocumentInput = z.infer<typeof prepareResupplyDocumentSchema>;
export type ResupplyDocumentSnapshot = z.infer<typeof resupplyDocumentSnapshotSchema>;
export type ResupplyDocumentView = z.infer<typeof resupplyDocumentViewSchema>;
export type ResupplyDocumentsResponse = z.infer<typeof resupplyDocumentsResponseSchema>;
