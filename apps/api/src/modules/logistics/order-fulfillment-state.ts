import { Prisma, type ShipmentStatus, type SupplierOrderStatus } from "@prisma/client";

type Shipment = { status: ShipmentStatus; items: { supplierOrderItemId: string; deliveredQuantity: Prisma.Decimal }[]; fulfillmentSteps: { status: string }[] };

/** Order progress depends on every shipment, never on the last edited shipment. */
export function fulfillmentOrderStatus(items: { id: string; acceptedQuantity: Prisma.Decimal }[], shipments: Shipment[]): SupplierOrderStatus {
  const active = shipments.filter(shipment => !["CANCELLED", "RETURNED"].includes(shipment.status));
  const delivered = new Map<string, Prisma.Decimal>();
  for (const shipment of active) for (const item of shipment.items)
    delivered.set(item.supplierOrderItemId, (delivered.get(item.supplierOrderItemId) ?? new Prisma.Decimal(0)).plus(item.deliveredQuantity));
  const accepted = items.filter(item => item.acceptedQuantity.gt(0));
  if (accepted.length && accepted.every(item => delivered.get(item.id)?.eq(item.acceptedQuantity)) &&
      active.every(shipment => shipment.fulfillmentSteps.every(step => ["COMPLETED", "CANCELLED"].includes(step.status)))) return "DELIVERED";
  if ([...delivered.values()].some(quantity => quantity.gt(0))) return "PARTIALLY_FULFILLED";
  if (shipments.some(shipment => shipment.status === "RETURNED")) return "RETURN_DISPUTE";
  if (active.some(shipment => ["IN_TRANSIT", "PARTIALLY_DELIVERED", "FAILED"].includes(shipment.status))) return "IN_TRANSIT";
  if (active.some(shipment => shipment.status === "DISPATCHED")) return "SHIPPED";
  if (active.some(shipment => shipment.status === "READY")) return "READY_TO_SHIP";
  if (active.some(shipment => shipment.status === "PACKING")) return "ASSEMBLING";
  return "PAID";
}

export async function refreshFulfillmentStatus(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.supplierOrder.findUniqueOrThrow({ where: { id: orderId }, include: {
    items: true, shipments: { include: { items: true, fulfillmentSteps: true } },
  } });
  const status = fulfillmentOrderStatus(order.items, order.shipments);
  // All callers hold the order lock. Completion can occur when a final
  // fulfillment step follows buyer receipt; record that path as well.
  if (status === "DELIVERED") await tx.commerceMetricEvent.upsert({ where: { sourceKey: `fulfilled:${orderId}` }, update: {},
    create: { sourceKey: `fulfilled:${orderId}`, supplierOrderId: orderId, kind: "FULFILLED", goodsAmountMinor: "0", commissionAmountMinor: "0" } });
  return status;
}
