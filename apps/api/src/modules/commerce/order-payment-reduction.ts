import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { OrderWorkflowCommand } from "@marketplace/schemas";
import type { Order } from "./order-workflow.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { calculateLineTotal } from "./commerce-rules";
import { lotIsUsable } from "../inventory/lot-eligibility";
import { manualPaymentSummary } from "./manual-payment-rules";

type Line = { itemId: string; acceptedQuantity: string; previousQuantity: string; unitPriceMinor: string; totalPriceMinor: string };
type ReductionCommand = Extract<OrderWorkflowCommand, { action: "PROPOSE_PAYMENT_REDUCTION" | "DECIDE_PAYMENT_REDUCTION" }>;

export async function paymentReduction(tx: Prisma.TransactionClient, order: Order, input: ReductionCommand, context: SupplierActorContext) {
  if (order.paymentStatus !== "UNPAID" || order.status !== "AWAITING_PAYMENT" || order.paymentAllocation || order.transferClaims.some(claim => claim.status !== "CONFIRMED"))
    throw new ConflictException("Сначала завершите проверку всех переводов. Изменение доступно только до полной оплаты");
  if (BigInt(manualPaymentSummary(order.subtotalAmountMinor, order.transferClaims).confirmedAmountMinor) <= 0)
    throw new ConflictException("До заявления и подтверждения недоплаты используется обычное согласование состава");
  if (await tx.shipment.count({ where: { supplierOrderId: order.id } })) throw new ConflictException("У заказа уже есть поставка");

  if (input.action === "PROPOSE_PAYMENT_REDUCTION") {
    if (await tx.orderPaymentReduction.count({ where: { supplierOrderId: order.id, status: "PENDING" } })) throw new ConflictException("Предыдущее предложение ещё ожидает решения");
    if (new Set(input.items.map(item => item.itemId)).size !== input.items.length || input.items.length !== order.items.length)
      throw new ConflictException("Укажите каждую позицию заказа ровно один раз");
    const lines: Line[] = input.items.map(line => {
      const item = order.items.find(item => item.id === line.itemId);
      const quantity = new Prisma.Decimal(line.acceptedQuantity);
      if (!item || quantity.lt(0) || quantity.gt(item.acceptedQuantity)) throw new ConflictException("Можно только уменьшить согласованное количество");
      return { ...line, previousQuantity: item.acceptedQuantity.toString(), unitPriceMinor: item.unitPriceMinor.toString(),
        totalPriceMinor: calculateLineTotal(item.unitPriceMinor.toString(), line.acceptedQuantity).toString() };
    });
    const amount = lines.reduce((sum, line) => sum.plus(line.totalPriceMinor), new Prisma.Decimal(0));
    if (!amount.gt(0) || !amount.lt(order.subtotalAmountMinor)) throw new ConflictException("Новая сумма должна быть положительной и меньше прежней");
    await tx.orderPaymentReduction.create({ data: { supplierOrderId: order.id, proposedById: context.actorId,
      proposedByOrganizationId: context.organizationId, previousAmountMinor: order.subtotalAmountMinor,
      proposedAmountMinor: amount, itemsSnapshot: lines, reason: input.reason } });
    return {};
  }

  const reduction = await tx.orderPaymentReduction.findFirst({ where: { id: input.reductionId, supplierOrderId: order.id, status: "PENDING" } });
  if (!reduction) throw new ConflictException("Предложение уже рассмотрено или не найдено");
  if (reduction.proposedByOrganizationId === context.organizationId) throw new ForbiddenException("Изменение должна согласовать другая сторона заказа");
  if (input.accepted) {
    const lines = reduction.itemsSnapshot as unknown as Line[];
    if (!order.subtotalAmountMinor.eq(reduction.previousAmountMinor) || lines.some(line => {
      const item = order.items.find(item => item.id === line.itemId);
      return !item || !item.acceptedQuantity.eq(line.previousQuantity) || !item.unitPriceMinor.eq(line.unitPriceMinor);
    })) throw new ConflictException("Состав изменился после предложения. Создайте новую версию");
    for (const line of lines) {
      const item = order.items.find(item => item.id === line.itemId)!;
      const next = new Prisma.Decimal(line.acceptedQuantity);
      const release = item.acceptedQuantity.minus(next);
      if (release.gt(0)) {
        const reservation = item.reservation;
        if (!reservation || reservation.status !== "ACTIVE" || reservation.externalReservation || !reservation.quantity.eq(item.acceptedQuantity))
          throw new ConflictException("Для изменения нужен действующий локальный резерв");
        const restore = !reservation.inventoryLot || lotIsUsable(reservation.inventoryLot);
        const changed = await tx.inventoryBalance.updateMany({ where: { id: reservation.inventoryBalanceId, quantityReserved: { gte: release } },
          data: { quantityReserved: { decrement: release }, ...(restore ? { quantityAvailable: { increment: release } } : {}), version: { increment: 1 } } });
        if (changed.count !== 1) throw new ConflictException("Резерв изменился");
        const balance = await tx.inventoryBalance.findUniqueOrThrow({ where: { id: reservation.inventoryBalanceId } });
        await tx.inventoryBalance.update({ where: { id: balance.id }, data: { availabilityStatus: balance.quantityAvailable.gt(0) ? "IN_STOCK" : "OUT_OF_STOCK" } });
        if (reservation.inventoryLotId) {
          const changedLot = await tx.inventoryLot.updateMany({ where: { id: reservation.inventoryLotId, quantityReserved: { gte: release } },
            data: { quantityReserved: { decrement: release }, ...(restore ? { quantityAvailable: { increment: release } } : {}), version: { increment: 1 } } });
          if (changedLot.count !== 1) throw new ConflictException("Резерв партии изменился");
        }
        await tx.inventoryReservation.update({ where: { id: reservation.id }, data: next.isZero() ? { status: "RELEASED" } : { quantity: next } });
      }
      await tx.supplierOrderItem.update({ where: { id: item.id }, data: { acceptedQuantity: next, totalPriceMinor: line.totalPriceMinor,
        status: next.gt(0) ? "CONFIRMED" : "REJECTED", decisionReason: reduction.reason } });
    }
  }
  await tx.orderPaymentReduction.update({ where: { id: reduction.id }, data: {
    status: input.accepted ? "ACCEPTED" : "REJECTED", decidedAt: new Date(), decidedById: context.actorId,
  } });
  return input.accepted ? { subtotalAmountMinor: reduction.proposedAmountMinor, manualInvoiceDocumentId: null, status: "CONFIRMED" as const } : {};
}
