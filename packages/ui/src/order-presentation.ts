import type { OrderWorkflowResponse } from "@marketplace/schemas";
export type OrderTone = "neutral" | "info" | "success" | "warning" | "danger";
const statuses: Record<string, string> = {
  DRAFT: "Черновик", AWAITING_CONFIRMATION: "На согласовании", CONFIRMED: "Согласован", PARTIALLY_CONFIRMED: "Состав изменён",
  RESERVED: "Товары зарезервированы", AWAITING_PAYMENT: "Ожидает оплаты", PAID: "Оплата подтверждена", ASSEMBLING: "На сборке",
  READY_TO_SHIP: "Готов к отправке", SHIPPED: "Отправлен", IN_TRANSIT: "В пути", DELIVERED: "Выполнен",
  PARTIALLY_FULFILLED: "Частично получен", RETURN_DISPUTE: "Спор по возврату", REJECTED: "Отклонён", CANCELLED: "Отменён",
};
export function orderStatusLabel(status: string) { return statuses[status] ?? "Статус уточняется"; }
export function orderStatusTone(status: string): OrderTone {
  return status === "DELIVERED" ? "success" : ["CANCELLED", "REJECTED"].includes(status) ? "neutral"
    : ["AWAITING_CONFIRMATION", "PARTIALLY_CONFIRMED", "RETURN_DISPUTE"].includes(status) ? "warning" : "info";
}
export function orderPaymentPresentation(order: { status: string; paymentStatus: string; paymentReviewPending?: boolean; partiallyPaid?: boolean; hasOpenReturn?: boolean }): { label: string; tone: OrderTone } {
  if (order.hasOpenReturn) return { label: "Возврат в процессе", tone: "warning" };
  if (order.paymentStatus === "REFUNDED") return { label: "Оплата возвращена", tone: "neutral" };
  if (order.paymentStatus === "PARTIALLY_REFUNDED") return { label: "Частичный возврат", tone: "info" };
  if (order.paymentReviewPending) return { label: order.partiallyPaid ? "Доплата на проверке" : "Перевод на проверке", tone: "warning" };
  if (order.paymentStatus === "PAID") return { label: "Оплачено", tone: "success" };
  if (["CANCELLED", "REJECTED"].includes(order.status) && order.paymentStatus === "UNPAID" && !order.partiallyPaid) return { label: "Оплата не требуется", tone: "neutral" };
  if (order.partiallyPaid) return { label: "Частично оплачено", tone: "warning" };
  if (order.paymentStatus === "PROCESSING") return { label: "Оплата обрабатывается", tone: "info" };
  if (order.paymentStatus === "FAILED") return { label: "Ошибка оплаты", tone: "danger" };
  return { label: "Не оплачено", tone: "neutral" };
}
export function orderItemCount(count: number) { const tail = count % 100; return `${count} ${tail >= 11 && tail <= 14 ? "позиций" : count % 10 === 1 ? "позиция" : count % 10 >= 2 && count % 10 <= 4 ? "позиции" : "позиций"}`; }
export type OrderDetailTab = "payment" | "shipments" | "documents" | "history" | "returns";
export function orderOverview(data: OrderWorkflowResponse, supplier: boolean) {
  const terminal = ["CANCELLED", "REJECTED"].includes(data.status);
  const openReturn = data.returns?.some(item => !["REJECTED", "REFUND_RECEIVED"].includes(item.status)) ?? false;
  const pending = data.claims.some(item => item.status !== "CONFIRMED");
  const partial = data.paymentStatus === "UNPAID" && BigInt(data.paymentSummary?.confirmedAmountMinor ?? "0") > BigInt(0);
  const payment = orderPaymentPresentation({ ...data, hasOpenReturn: openReturn, paymentReviewPending: pending, partiallyPaid: partial });
  const paid = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(data.paymentStatus);
  const shipped = ["SHIPPED", "IN_TRANSIT", "PARTIALLY_FULFILLED", "DELIVERED"].includes(data.status);
  const assembling = ["ASSEMBLING", "READY_TO_SHIP"].includes(data.status);
  const agreed = !["DRAFT", "AWAITING_CONFIRMATION", "PARTIALLY_CONFIRMED", "REJECTED", "CANCELLED"].includes(data.status)
    || data.events.some(item => ["ACCEPT_COMPOSITION", "ISSUE_INVOICE"].includes(item.action));
  const index = !agreed ? 0 : !data.invoiceDocumentId && !paid ? 1 : !paid ? 2 : !shipped ? 3 : data.status === "DELIVERED" ? 6 : 4;
  const steps = ["Согласование", "Счёт", "Оплата", "Сборка", "Доставка", "Получение"].map((label, step) => ({ label,
    state: (terminal ? "stopped" : step < index ? "done" : step === index || index === 4 && step === 5 ? "current" : "future") as "stopped" | "done" | "current" | "future" }));
  let title = orderStatusLabel(data.status), description = "Актуальное состояние заказа и доступные действия.", action: string | null = null;
  let tab: OrderDetailTab = "payment";
  if (terminal) { title = data.status === "CANCELLED" ? "Заказ отменён" : "Заказ отклонён"; description = data.reservationState?.status === "EXPIRED" ? "Срок резерва истёк. Исполнение заказа остановлено." : "Исполнение заказа остановлено. Подробности сохранены в истории."; tab = "history"; }
  else if (data.status === "DELIVERED") { title = "Заказ выполнен"; description = "Получение товаров подтверждено. Документы и история доступны ниже."; tab = "documents"; }
  else if (data.status === "AWAITING_CONFIRMATION") { title = supplier ? "Подтвердите состав заказа" : "Ожидаем подтверждение поставщика"; description = supplier ? "Проверьте доступное количество и условия каждой позиции." : "Поставщик проверяет доступность товаров."; tab = "shipments"; }
  else if (data.status === "PARTIALLY_CONFIRMED") { title = supplier ? "Ожидаем согласование клиники" : "Согласуйте изменения заказа"; description = "Поставщик изменил состав. Новые условия требуют согласия клиники."; if (!supplier) action = "Посмотреть изменения"; }
  else if (data.reservationState?.status === "DUE" || data.reservationState?.status === "EXPIRED") { title = "Срок резерва истёк"; description = "Не используйте прежний счёт. Обновите заказ и проверьте его состояние."; }
  else if (pending) { title = supplier ? "Проверьте поступление оплаты" : "Перевод на проверке"; description = "Квитанция не подтверждает получение денег. Поставщик проверяет фактическое поступление."; action = supplier ? "Проверить перевод" : "Посмотреть перевод"; }
  else if (!paid && agreed && !data.invoiceDocumentId) { title = supplier ? "Выставьте счёт" : "Ожидаем счёт поставщика"; description = "Состав согласован. Следующий этап — выставление счёта."; action = supplier ? "Подготовить счёт" : null; }
  else if (!paid) { title = partial ? "Ожидается доплата" : "Ожидаем оплату клиники"; description = "Поступившие суммы и остаток к оплате указаны в расчёте."; action = supplier ? null : "Сообщить о переводе"; }
  else if (shipped) { title = data.status === "PARTIALLY_FULFILLED" ? "Заказ получен частично" : "Заказ отправлен"; description = "Следите за каждой отгрузкой. Получение подтверждает клиника."; tab = "shipments"; action = "Посмотреть отгрузки"; }
  else { title = assembling ? orderStatusLabel(data.status) : "Оплата подтверждена"; description = supplier ? "Подготовьте товары и укажите сведения об отгрузке." : "Поставщик готовит товары к отправке."; tab = "shipments"; action = supplier ? "Подготовить отгрузку" : "Посмотреть отгрузки"; }
  return { terminal, openReturn, payment, steps, title, description, action, tab };
}
