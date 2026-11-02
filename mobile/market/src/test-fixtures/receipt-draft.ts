import { shipmentResponseSchema } from "../../../../packages/schemas/src/core-api";
import { cancellationWorkflow, cancellationScope, cancellationId } from "./cancellation-draft";
export const receiptScope = cancellationScope, receiptId = cancellationId;
export function receiptWorkflow(two = false) {
  const value = cancellationWorkflow(); value.status = value.order.status = "SHIPPED"; value.paymentStatus = value.order.paymentStatus = "PAID";
  const item = value.order.items[0]!, shipmentId = receiptId(9600), date = "2026-10-29T01:02:03.000Z";
  if (two) value.order.items.push({ ...item, id: receiptId(9602) });
  value.order.shipments = [shipmentResponseSchema.parse({ id: shipmentId, supplierOrderId: value.orderId, warehouseId: item.warehouseId, shipmentNumber: "SYNTHETIC receipt shipment", method: "CARRIER", status: "PARTIALLY_DELIVERED", trackingNumber: null, carrierName: null, pickup: false, deliveryWindowStart: null, deliveryWindowEnd: null, recipientName: "SYNTHETIC private recipient", recipientPhone: null, dispatchedAt: date, deliveredAt: null, failureReason: null, version: 2,
    items: [{ id: receiptId(9601), shipmentId, supplierOrderItemId: item.id, quantity: "2.5", deliveredQuantity: "0.5", resupplyQuantity: "0" }, ...(two ? [{ id: receiptId(9603), shipmentId, supplierOrderItemId: receiptId(9602), quantity: "10", deliveredQuantity: "0", resupplyQuantity: "0" }] : [])], fulfillmentSteps: [], createdAt: date, updatedAt: date })];
  return value;
}
