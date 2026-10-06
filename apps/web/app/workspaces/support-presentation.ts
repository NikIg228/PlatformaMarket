import type { SupportTicketSummary } from "@marketplace/schemas";

export const supportStatuses: Record<SupportTicketSummary["status"], string> = {
  OPEN: "Новое", IN_PROGRESS: "В работе", WAITING_CUSTOMER: "Нужен ваш ответ", RESOLVED: "Решено", CLOSED: "Закрыто",
};
export const supportCategories: Record<string, string> = {
  GENERAL: "Общий вопрос", ORDER: "Заказ и доставка", PAYMENT: "Оплата и документы", PRODUCT: "Товары и остатки", TECHNICAL: "Ошибка в работе сервиса",
};
export const supportDate = (value: string) => new Intl.DateTimeFormat("ru-KZ", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
export const emptySupportDraft = { category: "GENERAL", subject: "", description: "" };
export type SupportDraft = typeof emptySupportDraft;
