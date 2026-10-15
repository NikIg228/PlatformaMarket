import { z } from "zod";
import { organizationRequisitesRevisionSchema } from "./organization-requisites";
import { orderInvoiceSnapshotSchema } from "./order-invoice";

export const prepareShipmentWaybillSchema = z.object({
  expectedOrderVersion: z.number().int().positive(),
  expectedShipmentVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(160),
}).strict();
export const shipmentWaybillSnapshotSchema = z.object({
  templateVersion: z.literal("PM_WAYBILL_PREVIEW_V1"),
  orderId: z.uuid(), orderNumber: z.string(), orderVersion: z.number().int().positive(),
  shipmentId: z.uuid(), shipmentNumber: z.string(), shipmentVersion: z.number().int().positive(),
  number: z.string(), version: z.number().int().positive(), date: z.iso.date(),
  supplier: organizationRequisitesRevisionSchema, buyer: organizationRequisitesRevisionSchema,
  warehouse: z.object({ id: z.uuid(), name: z.string(), address: z.string() }).strict(),
  recipient: z.object({ name: z.string(), address: z.string() }).strict(),
  carrierName: z.string().nullable(), trackingNumber: z.string().nullable(),
  preparedBy: z.object({ id: z.uuid(), name: z.string() }).strict(),
  lines: z.array(orderInvoiceSnapshotSchema.shape.lines.element.extend({
    shipmentItemId: z.uuid(), orderedQuantity: z.string(),
  })).min(1),
  currency: z.literal("KZT"), totalMinor: orderInvoiceSnapshotSchema.shape.totalMinor,
  baseMinor: orderInvoiceSnapshotSchema.shape.baseMinor, vatMinor: orderInvoiceSnapshotSchema.shape.vatMinor,
}).strict();
export const shipmentWaybillViewSchema = z.object({
  documentId: z.uuid(), number: z.string(), version: z.number().int().positive(),
  status: z.enum(["PREVIEW", "STALE", "GENERATING", "FAILED"]),
  checksum: z.string().nullable(), snapshot: shipmentWaybillSnapshotSchema,
}).strict();
export const shipmentWaybillsResponseSchema = z.object({
  orderId: z.uuid(), shipmentId: z.uuid(), orderVersion: z.number().int().positive(), shipmentVersion: z.number().int().positive(),
  canPrepare: z.boolean(), issues: z.array(z.string()), waybills: z.array(shipmentWaybillViewSchema),
  deliveryDocuments: z.array(z.object({ id: z.uuid(), title: z.string(), status: z.string() }).strict()),
}).strict();
export type PrepareShipmentWaybillInput = z.infer<typeof prepareShipmentWaybillSchema>;
export type ShipmentWaybillSnapshot = z.infer<typeof shipmentWaybillSnapshotSchema>;
export type ShipmentWaybillView = z.infer<typeof shipmentWaybillViewSchema>;
export type ShipmentWaybillsResponse = z.infer<typeof shipmentWaybillsResponseSchema>;
