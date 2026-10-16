import { Prisma } from "@prisma/client";
import { discrepancySourceSchema, discrepancyStatementSchema, type DiscrepancyResupply } from "@marketplace/schemas";

export const resupplyInclude = {
  warehouse: true, fulfillmentSteps: true,
  resupplyShipment: { include: { items: true } },
  items: { include: { supplierOrderItem: { include: { reservation: { include: { externalReservation: true } } } } } },
} satisfies Prisma.ShipmentInclude;
export type ResupplySource = Prisma.ShipmentGetPayload<{ include: typeof resupplyInclude }>;
type Claim = { id: string; status: string; resolution: string | null; statement: Prisma.JsonValue; source: Prisma.JsonValue };
type Order = { paymentStatus: string; status: string; supplierOrganizationId: string };

/** A projection of the agreed quantities; stock is checked again under locks at dispatch. */
export function resupplyView(order: Order, claim: Claim, shipment: ResupplySource): DiscrepancyResupply | null {
  const statement = discrepancyStatementSchema.parse(claim.statement), source = discrepancySourceSchema.parse(claim.source);
  if (claim.status !== "AGREED" || claim.resolution !== "RESUPPLY" || statement.kind !== "SHORTAGE") return null;
  const replacement = shipment.resupplyShipment;
  const issues: string[] = [];
  if (replacement) issues.push("Допоставка по исходной партии уже зарегистрирована.");
  if (shipment.resupplyDiscrepancyId) issues.push("Повторная недостача в допоставке требует отдельного урегулирования.");
  if (order.paymentStatus !== "PAID" || ["CANCELLED", "REJECTED", "DELIVERED", "RETURN_DISPUTE"].includes(order.status))
    issues.push("Отправка допоставки сейчас недоступна по состоянию заказа.");
  if (!["DISPATCHED", "IN_TRANSIT", "PARTIALLY_DELIVERED", "FAILED"].includes(shipment.status))
    issues.push("Исходная партия должна быть отправлена и иметь недостачу.");
  if (shipment.warehouse.status !== "ACTIVE" || shipment.warehouse.supplierOrganizationId !== order.supplierOrganizationId)
    issues.push("Исходный склад недоступен для допоставки.");
  if (shipment.fulfillmentSteps.some(step => !["DELIVERY", "PICKUP"].includes(step.type) && !["COMPLETED", "CANCELLED"].includes(step.status)))
    issues.push("Завершите предыдущие этапы исходного отправления.");
  const lines = source.lines.map(original => {
    const agreed = statement.lines.find(line => line.shipmentItemId === original.shipmentItemId);
    const item = shipment.items.find(line => line.id === original.shipmentItemId);
    const actual = new Prisma.Decimal(agreed?.actualQuantity ?? "0"), sent = new Prisma.Decimal(original.sentQuantity);
    const shortage = sent.minus(actual);
    if (!agreed || !item || item.supplierOrderItemId !== original.orderItemId || !item.quantity.eq(sent) ||
        !item.supplierOrderItem.unitPriceMinor.eq(original.unitPriceMinor)) issues.push("Исходные позиции изменились. Требуется новое согласование.");
    if (shortage.lt(0) || new Prisma.Decimal(agreed?.damagedQuantity ?? "0").gt(0))
      issues.push("Эта операция исполняет только недостачу без излишка или повреждённого товара.");
    if (item && !item.deliveredQuantity.eq(actual)) issues.push("Клиника должна подтвердить фактическое получение по исходной партии в согласованном количестве.");
    const reservation = item?.supplierOrderItem.reservation;
    if (shortage.gt(0) && (!reservation || reservation.status !== "CONSUMED")) issues.push("Не подтверждено исходное складское списание. Требуется сверка резерва.");
    if (shortage.gt(0) && reservation?.externalReservation) issues.push("Внешний складской резерв требует исполнения через подключённую учётную систему.");
    if (!replacement && item?.resupplyQuantity.gt(0)) issues.push("Недостача этой строки уже передана в допоставку.");
    const delivered = replacement?.items.find(line => line.supplierOrderItemId === original.orderItemId)?.deliveredQuantity ?? new Prisma.Decimal(0);
    return { shipmentItemId: original.shipmentItemId, orderItemId: original.orderItemId, name: original.name, uom: original.uom,
      originalReceivedQuantity: actual.toString(), quantity: Prisma.Decimal.max(shortage, 0).toString(), deliveredQuantity: delivered.toString() };
  }).filter(line => new Prisma.Decimal(line.quantity).gt(0));
  if (source.lines.length !== shipment.items.length || statement.lines.length !== source.lines.length || !lines.length)
    issues.push("Согласованные строки не определяют недостающий товар.");
  return { canDispatch: !issues.length, issues: [...new Set(issues)], documentStatus: "INCOMPLETE",
    warehouseName: shipment.warehouse.name, recipientName: shipment.recipientName, method: shipment.method, lines,
    shipment: replacement ? { id: replacement.id, number: replacement.shipmentNumber, status: replacement.status,
      dispatchedAt: replacement.dispatchedAt?.toISOString() ?? null, deliveredAt: replacement.deliveredAt?.toISOString() ?? null,
      carrierName: replacement.carrierName, trackingNumber: replacement.trackingNumber } : null };
}
