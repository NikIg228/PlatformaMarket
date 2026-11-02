import { z } from "zod";
import { orderWorkflowEventSchema, orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { supplierOrderResponseSchema } from "../../../packages/schemas/src/core-api";
const header = orderWorkflowResponseSchema.pick({ orderId: true, version: true, status: true, paymentStatus: true }).strip().extend({ order: supplierOrderResponseSchema.pick({ id: true, buyerOrganizationId: true, version: true, status: true, paymentStatus: true }).strip() });
// A private display projection, not a replacement shared response or an audit export.
const records = z.object({ events: z.array(orderWorkflowEventSchema.pick({ id: true, action: true, createdAt: true }).strip()) }).strip();
export type OrderHistoryRow = Readonly<z.infer<typeof records>["events"][number]>;
export type OrderHistory = Readonly<{ state: "ready"; rows: readonly OrderHistoryRow[] } | { state: "unavailable" }>;
const unavailable: OrderHistory = Object.freeze({ state: "unavailable" });
export function projectOrderHistory(body: unknown, organizationId: string, expectedOrderId: string): OrderHistory {
  const context = header.safeParse(body); if (!context.success) return unavailable;
  const w = context.data;
  if (w.orderId !== expectedOrderId || w.order.id !== expectedOrderId || w.order.buyerOrganizationId !== organizationId || w.version !== w.order.version || w.status !== w.order.status || w.paymentStatus !== w.order.paymentStatus) return unavailable;
  const parsed = records.safeParse(body); if (!parsed.success || new Set(parsed.data.events.map(row => row.id)).size !== parsed.data.events.length) return unavailable;
  return Object.freeze({ state: "ready", rows: Object.freeze(parsed.data.events.map(row => Object.freeze(row))) });
}
