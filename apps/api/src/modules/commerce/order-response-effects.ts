import { Prisma, type SupplierOrder } from "@prisma/client";

export type ResponseStage = "REMINDER" | "OVERDUE" | "ESCALATED";
const eventTypes: Record<ResponseStage, string> = {
  REMINDER: "SupplierResponseReminder", OVERDUE: "SupplierResponseOverdue", ESCALATED: "SupplierResponseEscalated",
};
const messages: Record<ResponseStage, [string, string]> = {
  REMINDER: ["Заказ ожидает ответа 45 рабочих минут", "Подтвердите заказ, предложите конкретные изменения или откажите с причиной. Просмотр и сообщение о задержке не продлевают срок."],
  OVERDUE: ["Срок ответа поставщика истёк", "Содержательный ответ пока не получен. Просрочка не означает согласие и не отменяет заказ."],
  ESCALATED: ["Ожидание ответа передано оператору", "Создано одно обращение по задержке ответа поставщика. Оператор не принимает условия за стороны."],
};

export async function responseStageEffect(tx: Prisma.TransactionClient, order: SupplierOrder, stage: ResponseStage, now: Date) {
  const eventType = eventTypes[stage];
  const [subject, body] = messages[stage];
  const recipients = stage === "REMINDER" ? [order.supplierOrganizationId] : [order.supplierOrganizationId, order.buyerOrganizationId];
  for (const recipientOrganizationId of new Set(recipients)) {
    const idempotencyKey = `order-response:${order.id}:${stage}:${recipientOrganizationId}`;
    await tx.notification.upsert({ where: { idempotencyKey }, update: {}, create: {
      recipientOrganizationId, eventType, channel: "IN_APP", priority: stage === "REMINDER" ? "NORMAL" : "HIGH",
      subject: `${subject} · ${order.orderNumber}`, body, aggregateType: "SupplierOrder", aggregateId: order.id,
      idempotencyKey, scheduledAt: now, payload: { orderId: order.id, stage },
    } });
  }
  await tx.auditLog.create({ data: { actorId: null, organizationId: order.supplierOrganizationId,
    action: `order.response.${stage.toLowerCase()}`, entityType: "SupplierOrder", entityId: order.id,
    after: { stage, evaluatedAt: now.toISOString(), deadlineAt: order.responseDeadlineAt!.toISOString() } } });
}

export async function responseSupportCase(tx: Prisma.TransactionClient, order: SupplierOrder, requesterId: string, now: Date) {
  const description = "Поставщик не дал содержательный ответ за 120 рабочих минут. Свяжитесь со сторонами; не подтверждайте и не отменяйте заказ вместо них.";
  const ticket = await tx.supportTicket.create({ data: {
    number: `RESPONSE-${order.id}`, organizationId: order.buyerOrganizationId, requesterId,
    category: "ORDER_RESPONSE", priority: "HIGH", subject: `Нет ответа по заказу ${order.orderNumber}`, description,
    createdAt: now,
  } });
  await tx.supportLink.create({ data: { ticketId: ticket.id, entityType: "SupplierOrder", entityId: order.id, label: order.orderNumber } });
  const operators = await tx.organizationCapability.findMany({ where: { capability: "MARKETPLACE_OPERATOR" }, select: { organizationId: true } });
  await tx.outboxEvent.create({ data: { aggregateType: "SupportTicket", aggregateId: ticket.id, eventType: "SupportTicketCreated",
    payload: { ticketId: ticket.id, orderId: order.id, buyerOrganizationId: order.buyerOrganizationId,
      ...Object.fromEntries(operators.map((operator, index) => [`support${index}OrganizationId`, operator.organizationId])) },
  } });
  return ticket.id;
}
