import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { notificationEvents, type NotificationInboxItem, type notificationInboxQuerySchema } from "@marketplace/schemas";
import type { z } from "zod";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { workspacePage, workspaceOrderBy } from "../commerce/workspace-page";

const allEvents = Object.values(notificationEvents).flat();
const workflowCategories: Partial<Record<NotificationInboxItem["category"], string[]>> = {
  orders: ["ACCEPT_COMPOSITION", "CANCEL", "REORDER"],
  delivery: ["RECEIVE_SHIPMENT"],
  payments: ["ISSUE_INVOICE", "REPORT_TRANSFER", "CONFIRM_TRANSFER", "REQUEST_PAYMENT_DETAILS", "RECORD_TRANSFER_CHECK", "REQUEST_RETURN", "DECIDE_RETURN", "SEND_RETURN_GOODS", "RECEIVE_RETURN_GOODS", "SEND_MANUAL_REFUND", "RECEIVE_MANUAL_REFUND", "OPEN_PAYMENT_DISPUTE", "PROPOSE_PAYMENT_REDUCTION", "DECIDE_PAYMENT_REDUCTION"],
};
function categoryWhere(category: NotificationInboxItem["category"]): Prisma.NotificationWhereInput {
  return { OR: [
    { eventType: { in: notificationEvents[category].filter(event => event !== "OrderWorkflowChanged") } },
    ...(workflowCategories[category] ?? []).map(action => ({ eventType: "OrderWorkflowChanged", payload: { path: ["action"], equals: action } })),
  ] };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const select = { id: true, eventType: true, aggregateType: true, aggregateId: true, payload: true,
  createdAt: true, readAt: true, recipientUserId: true } satisfies Prisma.NotificationSelect;
type Row = Prisma.NotificationGetPayload<{ select: typeof select }>;
const titles: Record<string, [string, string]> = {
  SupplierOrderCreated: ["Создан новый заказ", "Проверьте состав и условия заказа."],
  SupplierOrderConfirmed: ["Поставщик рассмотрел заказ", "Откройте заказ и проверьте подтверждённый состав."],
  OrderReservationExpired: ["Срок резерва заказа истёк", "Откройте заказ, чтобы проверить итоговый статус. Не используйте прежний счёт для оплаты."],
  OrderReceived: ["Получение заказа подтверждено", "Клиника подтвердила фактическое получение товаров."],
  ManualPaymentReviewRequired: ["Проверьте поступление оплаты", "Клиника заявила перевод. Квитанция ещё не подтверждает получение денег."],
  RefundCompleted: ["Возврат выполнен", "Проверьте подробности возврата по заказу."],
  ShipmentCreated: ["Создана отгрузка", "Поставщик подготовил данные поставки."],
  ShipmentStatusChanged: ["Статус доставки изменён", "Посмотрите текущее состояние поставки в заказе."],
  DocumentSigned: ["Документ подписан", "Подписанный документ доступен для просмотра."],
  DocumentGenerated: ["Документ готов", "Откройте документ, чтобы проверить его содержание."],
  DocumentUploaded: ["Добавлен документ", "Новый документ доступен в архиве."],
  OrganizationCredentialExpired: ["Срок действия документа истёк", "Проверьте документы организации и обновите сведения."],
  ConversationMessageSaved: ["Новое сообщение", "В переписке появилось новое сообщение."],
  SupportTicketCreated: ["Обращение принято", "Статус и ответы доступны в поддержке."],
  SupportTicketUpdated: ["Обращение обновлено", "Откройте обращение для просмотра ответа."],
  ComplianceBlocked: ["Операция ограничена", "Проверьте причину ограничения и необходимые действия."],
  ComplianceReviewRequired: ["Требуется проверка", "Проверьте сведения и статус рассмотрения."],
  ProductCandidateApproved: ["Заявка на товар одобрена", "Посмотрите результат рассмотрения заявки."],
  ProductCandidateRejected: ["Заявка на товар отклонена", "Посмотрите замечания к заявке."],
  ProductCorrectionApproved: ["Исправление карточки одобрено", "Результат доступен в истории исправлений."],
  ProductCorrectionRejected: ["Исправление карточки отклонено", "Посмотрите замечания к исправлению."],
  ImportBatchProcessed: ["Обработка файла завершена", "Проверьте результат загрузки и замечания к строкам."],
};
const actions: Record<string, [string, string]> = {
  ACCEPT_COMPOSITION: ["Состав заказа согласован", "Клиника согласовала изменения состава и суммы."],
  ISSUE_INVOICE: ["Счёт по заказу готов", "Поставщик выставил счёт на оплату."],
  REPORT_TRANSFER: ["Клиника сообщила о переводе", "Поступление денег ещё требует проверки поставщиком."],
  CONFIRM_TRANSFER: ["Поставщик подтвердил поступление", "Проверьте полученную сумму и остаток к оплате в заказе."],
  REQUEST_PAYMENT_DETAILS: ["Требуется уточнение оплаты", "Поставщик запросил дополнительные сведения о переводе."],
  RECORD_TRANSFER_CHECK: ["Перевод проверен: деньги не поступили", "В заказе указано время следующей проверки."],
  CANCEL: ["Заказ отменён", "Посмотрите причину отмены в заказе."],
  REQUEST_RETURN: ["Запрошен возврат по заказу", "Проверьте состав и причину обращения."],
  DECIDE_RETURN: ["Заявка на возврат рассмотрена", "Откройте заказ, чтобы посмотреть решение."],
  SEND_RETURN_GOODS: ["Товар отправлен обратно", "Проверьте сведения о возврате товара."],
  RECEIVE_RETURN_GOODS: ["Возвращённый товар получен", "Поставщик подтвердил получение товара."],
  SEND_MANUAL_REFUND: ["Поставщик сообщил об отправке возврата", "Получение денег ещё требует подтверждения клиники."],
  RECEIVE_MANUAL_REFUND: ["Получение возврата подтверждено", "Клиника подтвердила получение денег."],
  OPEN_PAYMENT_DISPUTE: ["Открыт спор по переводу", "Посмотрите подробности и необходимые действия."],
  PROPOSE_PAYMENT_REDUCTION: ["Предложено уменьшение заказа", "Проверьте новый состав и сумму до согласования."],
  DECIDE_PAYMENT_REDUCTION: ["Изменение суммы рассмотрено", "Проверьте актуальные условия заказа."],
  REORDER: ["Создана корзина для повторной закупки", "Перед оформлением проверьте актуальные цены и наличие."],
  RECEIVE_SHIPMENT: ["Обновлено получение поставки", "Проверьте фактически полученные количества."],
};
function payload(row: Row): Record<string, unknown> { return row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload as Record<string, unknown> : {}; }
export function inboxPresentation(row: Row): NotificationInboxItem {
  const values = payload(row);
  const category = (row.eventType === "OrderWorkflowChanged"
    ? Object.entries(workflowCategories).find(([, actions]) => actions?.includes(String(values.action)))?.[0] ?? "payments"
    : Object.entries(notificationEvents).find(([, events]) => events.includes(row.eventType))?.[0]) as NotificationInboxItem["category"] | undefined;
  const [title, description] = row.eventType === "OrderWorkflowChanged" ? actions[String(values.action)] ?? ["Заказ обновлён", "Проверьте актуальные условия заказа."] : titles[row.eventType] ?? ["Рабочее событие", "Проверьте связанные сведения."];
  let target: NotificationInboxItem["target"] = null;
  const id = row.aggregateId && uuid.test(row.aggregateId) ? row.aggregateId : null;
  const orderId = typeof values.supplierOrderId === "string" && uuid.test(values.supplierOrderId) ? values.supplierOrderId : null;
  if (row.aggregateType === "SupplierOrder" && id) target = { type: "order", id, label: "Открыть заказ" };
  if (row.aggregateType === "Shipment" && orderId) target = { type: "order", id: orderId, label: "Посмотреть доставку" };
  if (row.aggregateType === "BusinessConversation" && id) target = { type: "conversation", id, label: "Открыть диалог" };
  if (row.aggregateType === "SupportTicket" && id) target = { type: "support", id, label: "Открыть обращение" };
  if (row.aggregateType === "Document" && id) target = { type: "document", id, label: "Открыть документ" };
  if (category === "organization" || row.eventType === "OrganizationCredentialExpired") target = { type: "organization", id: id ?? row.id, label: "Проверить сведения" };
  if (category === "products" && id) target = { type: "products", id, section: row.eventType.startsWith("ProductCorrection") ? "corrections" : row.eventType === "ImportBatchProcessed" ? "import" : "proposals", label: "Открыть раздел товаров" };
  return { id: row.id, category: category ?? "orders", title, description, target, context: null,
    createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null, readScope: row.recipientUserId ? "personal" : "organization" };
}

export class NotificationInboxReader {
  constructor(private readonly db: PrismaService) {}
  private scope(context: SupplierActorContext): Prisma.NotificationWhereInput {
    return { recipientOrganizationId: context.organizationId, OR: [{ recipientUserId: null }, { recipientUserId: context.actorId }], channel: "IN_APP", eventType: { in: allEvents }, status: { not: "CANCELLED" } };
  }
  async read(context: SupplierActorContext, query: z.output<typeof notificationInboxQuerySchema>) {
    const page = workspacePage(["notifications", context.organizationId, context.actorId, query.category, query.unreadOnly, query.limit], query.cursor);
    const base = this.scope(context);
    const asOf = new Date().toISOString();
    const [rows, unreadCount] = await Promise.all([
      this.db.notification.findMany({ where: { ...base, AND: [...page.where.AND, ...(query.category ? [categoryWhere(query.category)] : [])], ...(query.unreadOnly ? { readAt: null } : {}) }, select, orderBy: [...workspaceOrderBy], take: query.limit + 1 }),
      this.db.notification.count({ where: { ...base, readAt: null, createdAt: { lte: new Date(asOf) } } }),
    ]);
    const result = page.finish(rows, query.limit);
    const items = result.items.map(inboxPresentation);
    const orderIds = items.flatMap(item => item.target?.type === "order" ? [item.target.id] : []);
    const orders = orderIds.length ? await this.db.supplierOrder.findMany({ where: { id: { in: orderIds }, OR: [{ supplierOrganizationId: context.organizationId }, { buyerOrganizationId: context.organizationId }] }, select: { id: true, orderNumber: true, supplierOrganizationId: true, supplier: { select: { displayName: true } }, buyer: { select: { displayName: true } } } }) : [];
    for (const item of items) {
      if (item.target?.type !== "order") continue;
      const order = orders.find(order => order.id === item.target!.id);
      if (order) item.context = `${order.orderNumber} · ${order.supplierOrganizationId === context.organizationId ? order.buyer.displayName : order.supplier.displayName}`;
      else item.target = null;
    }
    return { items, nextCursor: result.nextCursor, unreadCount, asOf };
  }
  async readAll(context: SupplierActorContext, before: string) {
    const date = new Date(before);
    if (date.getTime() > Date.now() + 1000) throw new BadRequestException("Нельзя отметить будущие события прочитанными");
    // Explicitly bounded by the last fetched snapshot; new arrivals stay unread.
    return this.db.notification.updateMany({ where: { ...this.scope(context), createdAt: { lte: date }, readAt: null }, data: { readAt: new Date() } });
  }
}
