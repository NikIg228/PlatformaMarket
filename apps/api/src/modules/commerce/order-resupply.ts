import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { OrderDiscrepancyCommand } from "@marketplace/schemas";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { refreshFulfillmentStatus } from "../logistics/order-fulfillment-state";
import { resupplyView, type ResupplySource } from "./order-resupply.rules";
import { consumeResupplyInventory } from "./order-resupply-inventory";

/** Caller holds the supplier-order lock and owns the version/idempotency/event transaction. */
export async function dispatchResupply(tx: Prisma.TransactionClient, order: Prisma.SupplierOrderGetPayload<object>,
  claim: Prisma.OrderDiscrepancyGetPayload<object>, source: ResupplySource,
  command: Extract<OrderDiscrepancyCommand, { action: "DISPATCH_RESUPPLY" }>, context: SupplierActorContext) {
  const plan = resupplyView(order, claim, source);
  if (!plan?.canDispatch) throw new ConflictException({ code: "ORDER_DISCREPANCY_CONFLICT",
    message: plan?.issues.join(" ") || "Допоставка доступна только по согласованной недостаче." });
  if (source.method === "CARRIER" && !command.trackingNumber)
    throw new ConflictException("Укажите новый трек-номер допоставки.");
  if (await tx.orderManualReturn.count({ where: { supplierOrderId: order.id, status: { not: "REJECTED" } } }))
    throw new ConflictException("По заказу оформлен возврат. Сначала согласуйте единый способ урегулирования.");
  const id = randomUUID(), at = new Date();
  const items = await consumeResupplyInventory(tx, source, plan.lines, id, claim.id, context);
  const replacement = await tx.shipment.create({ data: { id, supplierOrderId: order.id, warehouseId: source.warehouseId,
    shipmentNumber: `RS-${id}`, status: "DISPATCHED", dispatchedAt: at,
    resupplyDiscrepancyId: claim.id, resupplySourceShipmentId: source.id,
    method: source.method, pickup: source.pickup, recipientName: source.recipientName, recipientPhone: source.recipientPhone,
    destinationAddress: source.destinationAddress === null ? Prisma.JsonNull : source.destinationAddress,
    carrierName: command.carrierName, trackingNumber: command.trackingNumber,
    items: { create: items }, fulfillmentSteps: { create: { type: source.pickup ? "PICKUP" : "DELIVERY", sequence: 1 } },
  } });
  for (const line of plan.lines) await tx.shipmentItem.update({ where: { id: line.shipmentItemId }, data: { resupplyQuantity: line.quantity } });
  // This closes the delivery attempt with an exception, never as full receipt of the original waybill.
  await tx.fulfillmentStep.updateMany({ where: { shipmentId: source.id, type: { in: ["DELIVERY", "PICKUP"] }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    data: { status: "CANCELLED", notes: `Недостача передана в допоставку ${replacement.shipmentNumber}; заявление ${claim.id}` } });
  await tx.shipment.update({ where: { id: source.id }, data: { version: { increment: 1 } } });
  await tx.supplierOrder.update({ where: { id: order.id }, data: { status: await refreshFulfillmentStatus(tx, order.id), version: { increment: 1 } } });
  return { shipmentId: id, shipmentNumber: replacement.shipmentNumber, sourceShipmentId: source.id, documentStatus: "INCOMPLETE",
    lines: plan.lines.map(line => ({ shipmentItemId: line.shipmentItemId, orderItemId: line.orderItemId, quantity: line.quantity })) };
}
