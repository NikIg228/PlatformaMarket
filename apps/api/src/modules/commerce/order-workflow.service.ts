import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import type { OrderWorkflowCommand, OrderWorkflowResult } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { lockInventoryBalances, lotIsUsable, usableLotWhere } from "../inventory/lot-eligibility";
import { orderReservationState } from "../inventory/reservation-lifecycle";
import { manualPaymentSummary, maxMinorAmount } from "./manual-payment-rules";
import { paymentPolicy } from "./supplier-payment-policy.service";
import { createPaymentDispute, notifyPaymentReview } from "./payment-review.service";
import { paymentReduction } from "./order-payment-reduction";
import { refreshFulfillmentStatus } from "../logistics/order-fulfillment-state";
import { manualReturn, manualReturnActions } from "./order-manual-return";
import { reorder } from "./order-reorder";
import { metricFact, receivedGoodsSnapshot, recordReceiptMetrics } from "./commerce-metric-facts";

const include = { items: { include: { reservation: { include: { externalReservation: true, inventoryLot: true } } } }, transferClaims: { orderBy: { createdAt: "asc" as const } }, paymentAllocation: true };
export type Order = Prisma.SupplierOrderGetPayload<{ include: typeof include }>;
const manualPaymentStatuses: string[] = ["AWAITING_PAYMENT", "PAID", "ASSEMBLING", "READY_TO_SHIP", "SHIPPED", "IN_TRANSIT", "PARTIALLY_FULFILLED", "DELIVERED"];

@Injectable()
export class OrderWorkflowService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService) {}

  private async visible(orderId: string, context: SupplierActorContext, operatorRead = false) {
    if (!context.actorId || !context.organizationId) throw new ForbiddenException("Требуется активная организация");
    const operator = operatorRead && Boolean(await this.prisma.organizationCapability.findUnique({ where: { organizationId_capability: { organizationId: context.organizationId, capability: "MARKETPLACE_OPERATOR" } } })) && await this.access.hasAll(context.actorId, context.organizationId, ["order.confirm"]);
    const permitted = operator || await this.access.hasAll(context.actorId, context.organizationId, ["order.create"]) || await this.access.hasAll(context.actorId, context.organizationId, ["order.confirm"]);
    if (!permitted) throw new ForbiddenException("Недостаточно прав для просмотра заказа");
    const order = await this.prisma.supplierOrder.findFirst({ where: { id: orderId, ...(operator ? {} : { OR: [{ buyerOrganizationId: context.organizationId }, { supplierOrganizationId: context.organizationId }] }) }, select: { id: true } });
    if (!order) throw new NotFoundException("Заказ не найден");
  }

  async get(orderId: string, context: SupplierActorContext) {
    await this.visible(orderId, context, true);
    const order = await this.prisma.supplierOrder.findUniqueOrThrow({ where: { id: orderId }, include: { paymentAllocation: true, items: { include: { reservation: { include: { externalReservation: true } }, offer: { include: { productVariant: { include: { product: true } } } }, warehouse: true } }, buyer: true, supplier: true, shipments: { include: { items: true, fulfillmentSteps: true, warehouse: true } }, transferClaims: { orderBy: { createdAt: "asc" } }, workflowEvents: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, action: true, actorId: true, organizationId: true, createdAt: true, details: true } } } });
    const { transferClaims, workflowEvents, paymentAllocation, items, ...detail } = order;
    const [policy, reductions, returns] = await Promise.all([paymentPolicy(this.prisma, order.supplierOrganizationId),
      this.prisma.orderPaymentReduction.findMany({ where: { supplierOrderId: order.id }, orderBy: { createdAt: "asc" } }),
      this.prisma.orderManualReturn.findMany({ where: { supplierOrderId: order.id }, orderBy: { createdAt: "asc" } })]);
    return { orderId: order.id, order: { ...detail, items: items.map(({ reservation, ...item }) => item) }, version: order.version, status: order.status, paymentStatus: order.paymentStatus, invoiceDocumentId: order.manualInvoiceDocumentId,
      claims: transferClaims.map(({ reviewPolicySnapshot, reviewStartedAt, reportedById, remindedAt, backupNotifiedAt, ...claim }) => claim),
      events: workflowEvents, reservationState: orderReservationState(order),
      paymentSummary: manualPaymentSummary(order.subtotalAmountMinor, transferClaims), paymentReviewConfigured: Boolean(policy.policy),
      reductions: reductions.map(({ itemsSnapshot, ...value }) => ({ ...value, items: itemsSnapshot })),
      returns: returns.map(({ itemsSnapshot, ...value }) => ({ ...value, items: itemsSnapshot })) };
  }

  async execute(orderId: string, input: OrderWorkflowCommand, context: SupplierActorContext) {
    await this.visible(orderId, context);
    const bilateral = ["OPEN_PAYMENT_DISPUTE", "PROPOSE_PAYMENT_REDUCTION", "DECIDE_PAYMENT_REDUCTION"].includes(input.action);
    const supplierActions = ["ISSUE_INVOICE", "REQUEST_PAYMENT_DETAILS", "CONFIRM_TRANSFER", "RECORD_TRANSFER_CHECK", "DECIDE_RETURN", "RECEIVE_RETURN_GOODS", "SEND_MANUAL_REFUND"];
    const permission = ["CONFIRM_TRANSFER", "SEND_MANUAL_REFUND"].includes(input.action) ? "payment.transfer.confirm" : input.action === "REORDER" ? "order.create" : supplierActions.includes(input.action) ? "order.confirm" : "order.approve";
    if (!bilateral && !await this.access.hasAll(context.actorId, context.organizationId, [permission])) throw new ForbiddenException("Недостаточно прав для действия с заказом");
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SupplierOrder" WHERE id = ${orderId}::uuid FOR UPDATE`;
      let order = await tx.supplierOrder.findUniqueOrThrow({ where: { id: orderId }, include });
      const supplierAction = supplierActions.includes(input.action);
      if (bilateral) {
        const partyPermission = context.organizationId === order.supplierOrganizationId ? "order.confirm" : context.organizationId === order.buyerOrganizationId ? "order.approve" : null;
        if (!partyPermission || !await this.access.hasAll(context.actorId, context.organizationId, [partyPermission])) throw new ForbiddenException("Действие недоступно этой стороне заказа");
      } else if ((supplierAction ? order.supplierOrganizationId : order.buyerOrganizationId) !== context.organizationId) throw new ForbiddenException("Действие недоступно этой стороне заказа");
      const previous = await tx.orderWorkflowEvent.findUnique({ where: { supplierOrderId_organizationId_idempotencyKey: { supplierOrderId: orderId, organizationId: context.organizationId, idempotencyKey: input.idempotencyKey } } });
      if (previous) {
        if (previous.requestHash !== requestHash || previous.actorId !== context.actorId) throw new ConflictException("Ключ повтора уже использован для другого действия");
        return previous.result as unknown as OrderWorkflowResult;
      }
      if (order.version !== input.expectedVersion) throw new ConflictException("Заказ изменился. Обновите страницу и проверьте условия");
      if (["ACCEPT_COMPOSITION", "ISSUE_INVOICE", "REPORT_TRANSFER"].includes(input.action) && orderReservationState(order).status === "DUE")
        throw new ConflictException("Срок резерва истёк до заявления оплаты. Не переводите деньги по этому счёту; обновите заказ.");
      if (input.action === "CONFIRM_TRANSFER" || input.action === "CANCEL" || input.action === "DECIDE_PAYMENT_REDUCTION") {
        await lockInventoryBalances(tx, order.items.flatMap(item => item.reservation ? [item.reservation.inventoryBalanceId] : []));
        order = await tx.supplierOrder.findUniqueOrThrow({ where: { id: orderId }, include });
      }
      const cartId = input.action === "REORDER" ? await reorder(tx, order, context) : undefined;
      const receiptBefore = ["RECEIVE_SHIPMENT", "RECEIVE_RETURN_GOODS"].includes(input.action) ? await receivedGoodsSnapshot(tx, orderId) : null;
      const changes = input.action === "REORDER" ? {} : await this.apply(tx, order, input, context);
      const updated = await tx.supplierOrder.update({ where: { id: orderId }, data: { ...changes, version: { increment: 1 } } });
      const eventId = randomUUID();
      if (receiptBefore) await recordReceiptMetrics(tx, orderId, eventId, receiptBefore, input.action === "RECEIVE_SHIPMENT" ? "RECEIVED" : "RETURNED");
      if (updated.status === "CANCELLED" && order.status !== "CANCELLED") await metricFact(tx, orderId, `cancelled:${orderId}`, "CANCELLED");
      const result = { orderId, version: updated.version, status: updated.status, paymentStatus: updated.paymentStatus, eventId, ...(cartId ? { cartId } : {}) };
      const { expectedVersion: _version, idempotencyKey: _key, ...details } = input;
      await tx.orderWorkflowEvent.create({ data: { id: eventId, supplierOrderId: orderId, ...context, action: input.action, idempotencyKey: input.idempotencyKey, requestHash, details, result } });
      await tx.auditLog.create({ data: { ...context, action: `order.workflow.${input.action.toLowerCase()}`, entityType: "SupplierOrder", entityId: orderId, after: { ...result, ...details } } });
      await tx.outboxEvent.create({ data: { aggregateType: "SupplierOrder", aggregateId: orderId, eventType: "OrderWorkflowChanged", payload: { ...result, action: input.action, buyerOrganizationId: order.buyerOrganizationId, supplierOrganizationId: order.supplierOrganizationId } } });
      return result;
    }, { timeout: 15000 });
  }

  private unpaid(order: Order) {
    if (order.paymentStatus !== "UNPAID" || order.paymentAllocation) throw new ConflictException("Оплата уже обрабатывается или подтверждена");
  }

  private async document(tx: Prisma.TransactionClient, order: Order, id: string, ownerId: string, kind: "INVOICE" | "PAYMENT_PROOF") {
    const doc = await tx.document.findFirst({ where: { id, ownerOrganizationId: ownerId, supplierOrderId: order.id, kind, status: { in: ["GENERATED", "SIGNED", "AWAITING_SIGNATURE"] }, immutableAt: { not: null }, storageKey: { not: null } } });
    if (!doc || doc.paymentIntentId || doc.refundId || doc.shipmentId || (doc.checkoutId && doc.checkoutId !== order.checkoutId)) throw new ConflictException("Нужен действующий документ этого заказа");
    const asset = await tx.uploadAsset.findFirst({ where: { storageKey: doc.storageKey!, organizationId: ownerId, status: "CLEAN", checksumSha256: doc.checksumSha256 ?? "" } });
    if (!asset || doc.source !== "UPLOADED") throw new ConflictException("Загрузите проверенный файл документа");
    return doc;
  }

  private async apply(tx: Prisma.TransactionClient, order: Order, input: OrderWorkflowCommand, context: SupplierActorContext): Promise<Prisma.SupplierOrderUpdateInput> {
    if (manualReturnActions.includes(input.action)) return manualReturn(tx, order, input, context);
    if (["CONFIRM_TRANSFER", "REPORT_TRANSFER", "PROPOSE_PAYMENT_REDUCTION", "DECIDE_PAYMENT_REDUCTION"].includes(input.action) &&
        await tx.orderManualReturn.count({ where: { supplierOrderId: order.id, status: { notIn: ["REJECTED", "REFUND_RECEIVED"] } } })) throw new ConflictException("Сначала завершите согласованный возврат.");
    if (input.action === "RECEIVE_SHIPMENT") return this.receive(tx, order, input);
    if (input.action === "PROPOSE_PAYMENT_REDUCTION" || input.action === "DECIDE_PAYMENT_REDUCTION") {
      const changes = await paymentReduction(tx, order, input, context);
      if (input.action === "DECIDE_PAYMENT_REDUCTION" && input.accepted && "subtotalAmountMinor" in changes) {
        const refreshed = await tx.supplierOrder.findUniqueOrThrow({ where: { id: order.id }, include });
        const summary = manualPaymentSummary(changes.subtotalAmountMinor!, refreshed.transferClaims);
        if (summary.remainingAmountMinor === "0") {
          await this.consume(tx, refreshed);
          return { ...changes, status: "PAID", paymentStatus: "PAID" };
        }
      }
      return changes;
    }
    if (input.action === "OPEN_PAYMENT_DISPUTE") {
      const claim = order.transferClaims.find(claim => claim.id === input.claimId);
      if (!claim || claim.status === "CONFIRMED") throw new ConflictException("Для подтверждённых денег используется отдельная процедура возврата");
      await createPaymentDispute(tx, order, claim, context.actorId, input.reason);
      await tx.orderTransferClaim.update({ where: { id: claim.id }, data: { status: "DISPUTED" } });
      return {};
    }
    if (input.action === "CONFIRM_TRANSFER") {
      if (order.paymentAllocation || !["UNPAID", "PAID"].includes(order.paymentStatus) || !manualPaymentStatuses.includes(order.status)) throw new ConflictException("Ручной перевод сейчас недоступен");
      const claim = order.transferClaims.find(({ id }) => id === input.claimId);
      if (!claim || claim.status === "CONFIRMED") throw new ConflictException("Заявка на оплату недоступна для подтверждения");
      const received = new Prisma.Decimal(input.receivedAmountMinor ?? claim.amountMinor.toString());
      const before = manualPaymentSummary(order.subtotalAmountMinor, order.transferClaims);
      if (!received.gt(0) || !received.isInteger() || BigInt(before.confirmedAmountMinor) + BigInt(received.toString()) > maxMinorAmount) throw new ConflictException("Недопустимая подтверждённая сумма");
      const paid = new Prisma.Decimal(before.confirmedAmountMinor).plus(received).gte(order.subtotalAmountMinor);
      if (paid && order.paymentStatus === "UNPAID") await this.consume(tx, order);
      if (paid) await tx.orderPaymentReduction.updateMany({ where: { supplierOrderId: order.id, status: "PENDING" },
        data: { status: "SUPERSEDED", decidedAt: new Date() } });
      await tx.orderTransferClaim.update({ where: { id: claim.id }, data: { status: "CONFIRMED", receivedAmountMinor: received, confirmedAt: new Date(), confirmedById: context.actorId, nextCheckAt: null } });
      return paid && order.paymentStatus === "UNPAID" ? { paymentStatus: "PAID", status: "PAID" } : {};
    }
    if (!["REPORT_TRANSFER", "ISSUE_INVOICE", "RECORD_TRANSFER_CHECK", "REQUEST_PAYMENT_DETAILS"].includes(input.action) || order.paymentStatus !== "PAID") this.unpaid(order);
    if (input.action === "ACCEPT_COMPOSITION") {
      if (order.status !== "PARTIALLY_CONFIRMED") throw new ConflictException("Нет изменений состава для согласования");
      return { status: "CONFIRMED" };
    }
    if (input.action === "ISSUE_INVOICE") {
      const replacementAfterReduction = !order.manualInvoiceDocumentId && order.transferClaims.length > 0 && order.transferClaims.every(claim => claim.status === "CONFIRMED");
      if (!(["CONFIRMED", "AWAITING_PAYMENT"].includes(order.status) || (order.status === "PAID" && replacementAfterReduction)) || (order.transferClaims.length > 0 && !replacementAfterReduction)) throw new ConflictException("Сначала согласуйте состав; заявленный перевод блокирует замену счёта");
      const doc = await this.document(tx, order, input.documentId, order.supplierOrganizationId, "INVOICE");
      if (!doc.amountMinor?.eq(order.subtotalAmountMinor) || doc.currency !== order.currency) throw new ConflictException("Сумма и валюта счёта должны совпадать с заказом");
      return { manualInvoiceDocumentId: doc.id, status: order.paymentStatus === "PAID" ? order.status : "AWAITING_PAYMENT" };
    }
    if (input.action === "REPORT_TRANSFER") {
      if (!manualPaymentStatuses.includes(order.status) || order.paymentAllocation || order.manualInvoiceDocumentId !== input.invoiceDocumentId) throw new ConflictException("Счёт изменился или ещё не выставлен");
      if (new Date(input.paidAt).getTime() > Date.now() + 60000) throw new ConflictException("Дата перевода не может быть в будущем");
      const proof = await this.document(tx, order, input.documentId, order.buyerOrganizationId, "PAYMENT_PROOF");
      if (!proof.amountMinor?.eq(input.amountMinor) || proof.currency !== order.currency) throw new ConflictException("Сумма и валюта квитанции должны совпадать с заявленным переводом");
      if (order.transferClaims.some(({ documentId }) => documentId === input.documentId)) throw new ConflictException("Эта квитанция уже приложена");
      const policy = await paymentPolicy(tx, order.supplierOrganizationId);
      const claim = await tx.orderTransferClaim.create({ data: { supplierOrderId: order.id, invoiceDocumentId: input.invoiceDocumentId, documentId: input.documentId, amountMinor: input.amountMinor, currency: order.currency, paidAt: new Date(input.paidAt), comment: input.comment,
        reportedById: context.actorId, reviewPolicySnapshot: policy.policy ? policy.policy as Prisma.InputJsonValue : Prisma.DbNull } });
      await notifyPaymentReview(tx, order, claim, policy.policy?.primaryUserId ?? null, "REPORTED");
      return {};
    }
    if (input.action === "REQUEST_PAYMENT_DETAILS") {
      if (!order.transferClaims.some(claim => claim.status !== "CONFIRMED") || !manualPaymentStatuses.includes(order.status)) throw new ConflictException("Нет заявленного перевода для уточнения");
      await tx.orderTransferClaim.updateMany({ where: { supplierOrderId: order.id, status: "PENDING" }, data: { status: "NEEDS_INFORMATION" } });
      return {};
    }
    if (input.action === "RECORD_TRANSFER_CHECK") {
      const claim = order.transferClaims.find(({ id }) => id === input.claimId);
      const next = new Date(input.nextCheckAt);
      if (!claim || claim.status === "CONFIRMED" || next <= new Date() || next.getTime() > Date.now() + 7 * 86400_000) throw new ConflictException("Укажите следующую проверку в течение ближайших7 дней");
      await tx.orderTransferClaim.update({ where: { id: claim.id }, data: { status: claim.status === "DISPUTED" ? "DISPUTED" : "NOT_RECEIVED", checkedAt: new Date(), nextCheckAt: next,
        reviewStartedAt: next, remindedAt: null, backupNotifiedAt: null } });
      return {};
    }
    if (!["AWAITING_CONFIRMATION", "CONFIRMED", "PARTIALLY_CONFIRMED", "AWAITING_PAYMENT"].includes(order.status) || order.transferClaims.length || await tx.shipment.count({ where: { supplierOrderId: order.id } })) throw new ConflictException("Автоматическая отмена недоступна. Обратитесь в поддержку");
    for (const item of order.items) {
      const reservation = item.reservation;
      if (!reservation || reservation.status !== "ACTIVE") continue;
      if (reservation.externalReservation) throw new ConflictException("Внешний резерв требует отдельного согласования отмены");
      const quantity = reservation.quantity;
      const restore = !reservation.inventoryLot || lotIsUsable(reservation.inventoryLot);
      const balance = await tx.inventoryBalance.updateMany({ where: { id: reservation.inventoryBalanceId, quantityReserved: { gte: quantity } }, data: { quantityReserved: { decrement: quantity }, ...(restore ? { quantityAvailable: { increment: quantity } } : {}), version: { increment: 1 } } });
      if (balance.count !== 1) throw new ConflictException("Резерв изменился; отмена не выполнена");
      const updated = await tx.inventoryBalance.findUniqueOrThrow({ where: { id: reservation.inventoryBalanceId } });
      await tx.inventoryBalance.update({ where: { id: updated.id }, data: { availabilityStatus: updated.quantityAvailable.gt(0) ? "IN_STOCK" : "OUT_OF_STOCK" } });
      if (reservation.inventoryLotId) {
        const lot = await tx.inventoryLot.updateMany({ where: { id: reservation.inventoryLotId, quantityReserved: { gte: quantity } }, data: { quantityReserved: { decrement: quantity }, ...(restore ? { quantityAvailable: { increment: quantity } } : {}), version: { increment: 1 } } });
        if (lot.count !== 1) throw new ConflictException("Резерв партии изменился");
      }
      await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: "RELEASED" } });
    }
    await tx.supplierOrderItem.updateMany({ where: { supplierOrderId: order.id }, data: { status: "CANCELLED" } });
    return { status: "CANCELLED" };
  }

  private async consume(tx: Prisma.TransactionClient, order: Order) {
    for (const item of order.items.filter(({ acceptedQuantity }) => acceptedQuantity.gt(0))) {
      const reservation = item.reservation;
      if (!reservation || reservation.status !== "ACTIVE" || !reservation.quantity.eq(item.acceptedQuantity)) throw new ConflictException("Активный резерв заказа изменился");
      if (reservation.externalReservation) throw new ConflictException("Внешние складские резервы не входят во внутреннюю схему оплаты");
      const quantity = reservation.quantity;
      const balance = await tx.inventoryBalance.updateMany({ where: { id: reservation.inventoryBalanceId, quantityReserved: { gte: quantity }, quantityOnHand: { gte: quantity } }, data: { quantityReserved: { decrement: quantity }, quantityOnHand: { decrement: quantity }, version: { increment: 1 } } });
      if (balance.count !== 1) throw new ConflictException("Недостаточный резерв для подтверждения оплаты");
      if (reservation.inventoryLotId) {
        const lot = await tx.inventoryLot.updateMany({ where: { id: reservation.inventoryLotId, supplierOrganizationId: order.supplierOrganizationId,
          inventoryBalanceId: reservation.inventoryBalanceId, warehouseId: item.warehouseId, ...usableLotWhere(),
          quantityReserved: { gte: quantity }, quantityOnHand: { gte: quantity } }, data: { quantityReserved: { decrement: quantity }, quantityOnHand: { decrement: quantity }, version: { increment: 1 } } });
        if (lot.count !== 1) throw new ConflictException("Партия отозвана, просрочена или резерв изменился. Подтверждение остановлено; обратитесь в поддержку.");
        await tx.inventoryLot.updateMany({ where: { id: reservation.inventoryLotId, status: "ACTIVE", quantityOnHand: 0 }, data: { status: "DEPLETED", quantityAvailable: 0 } });
      }
      await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: "CONSUMED" } });
    }
  }

  private async receive(tx: Prisma.TransactionClient, order: Order, input: Extract<OrderWorkflowCommand, { action: "RECEIVE_SHIPMENT" }>): Promise<Prisma.SupplierOrderUpdateInput> {
    if (order.paymentStatus !== "PAID" || ["CANCELLED", "REJECTED", "RETURN_DISPUTE"].includes(order.status)) throw new ConflictException("Получение сейчас недоступно");
    const shipment = await tx.shipment.findFirst({ where: { id: input.shipmentId, supplierOrderId: order.id }, include: { items: true, fulfillmentSteps: true } });
    if (!shipment || !["DISPATCHED", "IN_TRANSIT", "PARTIALLY_DELIVERED"].includes(shipment.status)) throw new ConflictException("Подтвердить можно только отправленную поставку");
    if (new Set(input.items.map(item => item.shipmentItemId)).size !== input.items.length) throw new ConflictException("Позиции получения не должны повторяться");
    for (const received of input.items) {
      const item = shipment.items.find(item => item.id === received.shipmentItemId);
      const quantity = new Prisma.Decimal(received.deliveredQuantity);
      if (!item || quantity.lt(item.deliveredQuantity) || quantity.gt(item.quantity)) throw new ConflictException("Количество должно быть не меньше уже полученного и не больше отправленного");
      await tx.shipmentItem.update({ where: { id: item.id }, data: { deliveredQuantity: quantity } });
    }
    const items = await tx.shipmentItem.findMany({ where: { shipmentId: shipment.id } });
    if (!items.some(item => item.deliveredQuantity.gt(0))) throw new ConflictException("Укажите полученное количество");
    const full = items.every(item => item.deliveredQuantity.eq(item.quantity));
    if (full) await tx.fulfillmentStep.updateMany({ where: { shipmentId: shipment.id, type: { in: ["DELIVERY", "PICKUP"] }, status: { not: "COMPLETED" } }, data: { status: "COMPLETED", completedAt: new Date() } });
    const pendingSteps = await tx.fulfillmentStep.count({ where: { shipmentId: shipment.id, status: { notIn: ["COMPLETED", "CANCELLED"] } } });
    await tx.shipment.update({ where: { id: shipment.id }, data: { status: full && !pendingSteps ? "DELIVERED" : "PARTIALLY_DELIVERED", deliveredAt: full ? new Date() : undefined, version: { increment: 1 } } });
    return { status: await refreshFulfillmentStatus(tx, order.id) };
  }
}
