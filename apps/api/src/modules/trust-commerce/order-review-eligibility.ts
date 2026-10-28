import { Prisma } from "@prisma/client";

type ReceivedOrder = {
  items: { id: string; acceptedQuantity: Prisma.Decimal }[];
  shipments: { status: string; items: { supplierOrderItemId: string; deliveredQuantity: Prisma.Decimal }[] }[];
};
/** Receipt quantities are written by the buyer's receipt command. A carrier's
 * status, invoice, signature or unfinished installation is not proof of receipt.
 * Later returns do not erase the historic receipt or an earned right to review. */
export function fullyReceived(order: ReceivedOrder): boolean {
  const accepted = order.items.filter(item => item.acceptedQuantity.gt(0));
  if (!accepted.length) return false;
  const quantities = new Map<string, Prisma.Decimal>();
  for (const shipment of order.shipments) {
    if (shipment.status === "CANCELLED") continue;
    for (const item of shipment.items) quantities.set(item.supplierOrderItemId,
      (quantities.get(item.supplierOrderItemId) ?? new Prisma.Decimal(0)).plus(item.deliveredQuantity));
  }
  return accepted.every(item => quantities.get(item.id)?.eq(item.acceptedQuantity));
}
