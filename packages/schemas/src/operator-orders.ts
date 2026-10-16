import { z } from "zod";
import { orderWorkflowResponseSchema } from "./order-workflow";
import { orderDiscrepancyViewSchema } from "./order-discrepancy";
import { operatorOrderStatuses, operatorOrderPaymentStatuses } from "./operator-order-status";

export const operatorOrderStatusSchema = z.enum(operatorOrderStatuses);
export const operatorOrderPaymentStatusSchema = z.enum(operatorOrderPaymentStatuses);
const text = z.string().max(200).regex(/^[^\u0000-\u001f\u007f]*$/).trim();
const integer = (max: number, fallback: number, min = 0) => z.preprocess(value => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value, z.number().int().min(min).max(max).default(fallback));
export const operatorOrdersQuerySchema = z.strictObject({
  q: text.optional(), buyer: text.optional(), supplier: text.optional(),
  status: operatorOrderStatusSchema.optional(), paymentStatus: operatorOrderPaymentStatusSchema.optional(),
  dateFrom: z.iso.date().optional(), dateTo: z.iso.date().optional(),
  offset: integer(1_000_000, 0), limit: integer(100, 25, 1),
}).refine(value => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, { message: "Invalid date range", path: ["dateTo"] });
const party = z.strictObject({ id: z.uuid(), displayName: z.string(), legalName: z.string(), bin: z.string() });
export const operatorOrderSchema = z.strictObject({
  id: z.uuid(), orderNumber: z.string(), buyer: party, supplier: party,
  status: operatorOrderStatusSchema, paymentStatus: operatorOrderPaymentStatusSchema,
  subtotalAmountMinor: z.string().regex(/^\d+$/), currency: z.string().length(3),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), version: z.number().int().positive(),
});
export const operatorOrdersSchema = z.strictObject({ items: z.array(operatorOrderSchema), total: z.number().int().nonnegative(), offset: z.number().int().nonnegative(), limit: z.number().int().positive() });
// Published operational facts only. Private buyer drafts and attachments are not projected.
export const operatorOrderDiscrepancySchema = orderDiscrepancyViewSchema.pick({ id: true, shipmentId: true, version: true, status: true, previousDiscrepancyId: true, resolution: true, createdAt: true, updatedAt: true, resupply: true, events: true }).extend({
  kind: z.string(), reason: z.string(), sourceDocumentId: z.uuid().nullable(), sourceDocumentVersion: z.number().int().positive().nullable(),
});
export const operatorOrderDetailSchema = z.strictObject({
  workflow: orderWorkflowResponseSchema, canWrite: z.literal(false), canViewDocuments: z.boolean(), canViewSupport: z.boolean(),
  discrepancies: z.array(operatorOrderDiscrepancySchema),
  tickets: z.array(z.strictObject({ id: z.uuid(), number: z.string(), subject: z.string(), status: z.string(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() })),
});
export type OperatorOrdersQuery = z.infer<typeof operatorOrdersQuerySchema>;
export type OperatorOrder = z.infer<typeof operatorOrderSchema>;
export type OperatorOrders = z.infer<typeof operatorOrdersSchema>;
export type OperatorOrderDetail = z.infer<typeof operatorOrderDetailSchema>;
