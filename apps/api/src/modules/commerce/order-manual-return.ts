import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { returnLineSchema } from "@marketplace/schemas";
import type { OrderWorkflowCommand } from "@marketplace/schemas";
import type { Order } from "./order-workflow.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { manualPaymentSummary } from "./manual-payment-rules";
import { lockInventoryBalances, lotIsUsable } from "../inventory/lot-eligibility";

export const manualReturnActions = ["REQUEST_RETURN", "DECIDE_RETURN", "SEND_RETURN_GOODS", "RECEIVE_RETURN_GOODS", "SEND_MANUAL_REFUND", "RECEIVE_MANUAL_REFUND"];
const lines = returnLineSchema.array();
const zero = () => new Prisma.Decimal(0);
function fail(message: string): never { throw new ConflictException(message); }

// Cumulative rounding makes several partial refunds sum to the original line.
export function returnedLineAmount(total: Prisma.Decimal, accepted: Prisma.Decimal, previous: Prisma.Decimal, quantity: Prisma.Decimal) {
  const scaled = (q: Prisma.Decimal) => BigInt(q.toFixed(6).replace(".", ""));
  const denominator = scaled(accepted);
  const value = (q: Prisma.Decimal) => (BigInt(total.toFixed(0)) * scaled(q) * 2n + denominator) / (2n * denominator);
  return new Prisma.Decimal((value(previous.plus(quantity)) - value(previous)).toString());
}

async function stopUnshippedOrder(tx: Prisma.TransactionClient, order: Order) {
  const dispatched = await tx.shipment.count({ where: { supplierOrderId: order.id, OR: [
    { dispatchedAt: { not: null } }, { status: { in: ["DISPATCHED", "IN_TRANSIT", "PARTIALLY_DELIVERED", "DELIVERED", "FAILED", "RETURNED"] } },
    { items: { some: { deliveredQuantity: { gt: 0 } } } },
  ] } });
  if (dispatched) fail("Товар уже отправлен. Согласуйте возврат товара вместо отмены.");
  await lockInventoryBalances(tx, order.items.flatMap(item => item.reservation ? [item.reservation.inventoryBalanceId] : []));
  for (const item of order.items) {
    if (!item.reservation) continue;
    const reservation = await tx.inventoryReservation.findUniqueOrThrow({ where: { id: item.reservation.id }, include: { inventoryLot: true, externalReservation: true } });
    if (reservation.externalReservation) fail("Внешний резерв требует отдельного согласования.");
    if (!["ACTIVE", "CONSUMED"].includes(reservation.status)) continue;
    const consumed = reservation.status === "CONSUMED";
    const quantity = reservation.quantity;
    const usable = !reservation.inventoryLot || lotIsUsable(reservation.inventoryLot, new Date(), consumed);
    const changed = await tx.inventoryBalance.updateMany({ where: { id: reservation.inventoryBalanceId,
      ...(consumed ? {} : { quantityReserved: { gte: quantity } }) }, data: {
      ...(consumed ? { quantityOnHand: { increment: quantity } } : { quantityReserved: { decrement: quantity } }),
      ...(usable ? { quantityAvailable: { increment: quantity } } : {}), version: { increment: 1 },
    } });
    if (changed.count !== 1) fail("Резерв изменился. Отмена не выполнена.");
    if (reservation.inventoryLotId) {
      const changedLot = await tx.inventoryLot.updateMany({ where: { id: reservation.inventoryLotId,
        ...(consumed ? {} : { quantityReserved: { gte: quantity } }) }, data: {
        ...(consumed ? { quantityOnHand: { increment: quantity } } : { quantityReserved: { decrement: quantity } }),
        ...(usable ? { quantityAvailable: { increment: quantity }, status: "ACTIVE" } : {}), version: { increment: 1 },
      } });
      if (changedLot.count !== 1) fail("Резерв партии изменился. Отмена не выполнена.");
    }
    const balance = await tx.inventoryBalance.findUniqueOrThrow({ where: { id: reservation.inventoryBalanceId } });
    await tx.inventoryBalance.update({ where: { id: balance.id }, data: { availabilityStatus: balance.quantityAvailable.gt(0) ? "IN_STOCK" : "OUT_OF_STOCK" } });
    await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: "RELEASED" } });
  }
  await tx.fulfillmentStep.updateMany({ where: { shipment: { supplierOrderId: order.id }, status: { notIn: ["COMPLETED", "CANCELLED"] } }, data: { status: "CANCELLED" } });
  await tx.shipment.updateMany({ where: { supplierOrderId: order.id, status: { not: "CANCELLED" } }, data: { status: "CANCELLED", version: { increment: 1 } } });
}

export async function manualReturn(tx: Prisma.TransactionClient, order: Order, input: OrderWorkflowCommand, context: SupplierActorContext): Promise<Prisma.SupplierOrderUpdateInput> {
  if (order.paymentAllocation) fail("Возврат внешнего платёжного контура выполняется отдельно.");
  const summary = manualPaymentSummary(order.subtotalAmountMinor, order.transferClaims);
  const returns = await tx.orderManualReturn.findMany({ where: { supplierOrderId: order.id }, orderBy: { createdAt: "asc" } });
  const committed = returns.filter(value => value.status !== "REJECTED");
  const refunded = committed.reduce((sum, value) => sum.plus(value.amountMinor), zero());
  const confirmed = new Prisma.Decimal(summary.confirmedAmountMinor);
  if (input.action === "REQUEST_RETURN") {
    if (committed.some(value => value.status !== "REFUND_RECEIVED")) fail("Сначала завершите текущее обращение по возврату.");
    if (confirmed.lte(refunded) || order.transferClaims.some(claim => claim.status !== "CONFIRMED")) fail("Сначала завершите проверку заявленных переводов.");
    let amount = zero();
    if (input.kind === "CANCELLATION") {
      if (order.status === "CANCELLED" || committed.some(value => value.kind !== "OVERPAYMENT")) fail("Отмена этого заказа уже недоступна.");
      if (input.items.length) fail("Отмена до отправки относится ко всему заказу.");
      const sent = await tx.shipment.count({ where: { supplierOrderId: order.id, OR: [{ dispatchedAt: { not: null } }, { status: { in: ["DISPATCHED", "IN_TRANSIT", "PARTIALLY_DELIVERED", "DELIVERED", "FAILED", "RETURNED"] } }] } });
      if (sent) fail("После отправки оформите возврат товара.");
      amount = confirmed.minus(refunded);
    } else if (input.kind === "OVERPAYMENT") {
      if (input.items.length || order.status === "CANCELLED") fail("Для переплаты не выбирают товары.");
      amount = new Prisma.Decimal(summary.overpaidAmountMinor).minus(committed.filter(value => value.kind === "OVERPAYMENT").reduce((sum, value) => sum.plus(value.amountMinor), zero()));
    } else {
      if (order.paymentStatus !== "PAID" || !input.items.length || new Set(input.items.map(item => item.orderItemId)).size !== input.items.length) fail("Выберите неповторяющиеся позиции оплаченного заказа.");
      const shipments = await tx.shipment.findMany({ where: { supplierOrderId: order.id, dispatchedAt: { not: null }, status: { not: "CANCELLED" } }, include: { items: true } });
      for (const line of input.items) {
        const item = order.items.find(item => item.id === line.orderItemId);
        if (!item || !item.acceptedQuantity.gt(0)) fail("Позиция не принадлежит согласованному заказу.");
        const previous = committed.filter(value => value.kind === "GOODS").flatMap(value => lines.parse(value.itemsSnapshot)).filter(value => value.orderItemId === item.id).reduce((sum, value) => sum.plus(value.quantity), zero());
        const sent = shipments.flatMap(value => value.items).filter(value => value.supplierOrderItemId === item.id).reduce((sum, value) => sum.plus(value.quantity), zero());
        const quantity = new Prisma.Decimal(line.quantity);
        if (quantity.lte(0) || previous.plus(quantity).gt(sent) || previous.plus(quantity).gt(item.acceptedQuantity)) fail("Количество возврата превышает отправленный товар с учётом прошлых возвратов.");
        amount = amount.plus(returnedLineAmount(item.totalPriceMinor, item.acceptedQuantity, previous, quantity));
      }
    }
    if (amount.lte(0) || refunded.plus(amount).gt(confirmed)) fail("Нет доступной подтверждённой суммы для этого возврата.");
    await tx.orderManualReturn.create({ data: { supplierOrderId: order.id, kind: input.kind, reason: input.reason,
      amountMinor: amount, currency: order.currency, itemsSnapshot: input.items, requestedById: context.actorId } });
    return {};
  }
  if (!("returnId" in input)) fail("Неизвестное действие возврата.");
  const current = returns.find(value => value.id === input.returnId);
  if (!current) fail("Возврат не найден в этом заказе.");
  const now = new Date();
  if (input.action === "DECIDE_RETURN") {
    if (current.status !== "REQUESTED") fail("Заявка уже рассмотрена.");
    if (input.accepted && current.kind === "CANCELLATION") await stopUnshippedOrder(tx, order);
    await tx.orderManualReturn.update({ where: { id: current.id }, data: { status: input.accepted ? "AGREED" : "REJECTED", decisionReason: input.reason, decidedAt: now } });
    return input.accepted && current.kind === "CANCELLATION" ? { status: "CANCELLED" } : {};
  }
  if (input.action === "SEND_RETURN_GOODS") {
    if (current.kind !== "GOODS" || current.status !== "AGREED") fail("Отправка доступна после согласования возврата товара.");
    await tx.orderManualReturn.update({ where: { id: current.id }, data: { status: "GOODS_SENT", goodsSentAt: now } });
  } else if (input.action === "RECEIVE_RETURN_GOODS") {
    if (current.status !== "GOODS_SENT") fail("Сначала клиника должна подтвердить отправку товара.");
    // Receipt is evidence only. Quarantine/inspection determines later restocking.
    await tx.orderManualReturn.update({ where: { id: current.id }, data: { status: "GOODS_RECEIVED", goodsReceivedAt: now } });
  } else if (input.action === "SEND_MANUAL_REFUND") {
    if (current.status !== (current.kind === "GOODS" ? "GOODS_RECEIVED" : "AGREED")) fail("Возврат денег пока не согласован или товар не получен.");
    const doc = await tx.document.findFirst({ where: { id: input.documentId, supplierOrderId: order.id, ownerOrganizationId: order.supplierOrganizationId,
      kind: "PAYMENT_PROOF", source: "UPLOADED", status: { in: ["GENERATED", "SIGNED", "AWAITING_SIGNATURE"] }, immutableAt: { not: null }, storageKey: { not: null } } });
    if (!doc || doc.refundId || doc.paymentIntentId || doc.shipmentId || (doc.checkoutId && doc.checkoutId !== order.checkoutId) || !doc.amountMinor?.eq(current.amountMinor) || doc.currency !== order.currency) fail("Загрузите квитанцию поставщика на согласованную сумму возврата этого заказа.");
    if (!await tx.uploadAsset.findFirst({ where: { storageKey: doc.storageKey!, organizationId: order.supplierOrganizationId, checksumSha256: doc.checksumSha256 ?? "", status: "CLEAN" } })) fail("Файл квитанции не прошёл проверку.");
    if (returns.some(value => value.refundDocumentId === doc.id) || order.transferClaims.some(value => value.documentId === doc.id)) fail("Эта квитанция уже использована.");
    await tx.orderManualReturn.update({ where: { id: current.id }, data: { status: "REFUND_SENT", refundDocumentId: doc.id, refundSentAt: now } });
  } else if (input.action === "RECEIVE_MANUAL_REFUND") {
    if (current.status !== "REFUND_SENT") fail("Поставщик ещё не подтвердил отправку денег.");
    await tx.orderManualReturn.update({ where: { id: current.id }, data: { status: "REFUND_RECEIVED", refundReceivedAt: now } });
    if (order.status === "CANCELLED" && confirmed.eq(committed.filter(value => value.status === "REFUND_RECEIVED" || value.id === current.id).reduce((sum, value) => sum.plus(value.amountMinor), zero()))) return { paymentStatus: "REFUNDED" };
  } else fail("Недопустимое действие возврата.");
  return {};
}
