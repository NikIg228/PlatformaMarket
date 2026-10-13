import { feedbackErrorMessage } from "./feedback-error";

export function formatDate(
  value: string | Date | null | undefined,
  withTime = false,
) {
  if (!value) return "Нет данных";
  return new Intl.DateTimeFormat(
    "ru-KZ",
    withTime
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" },
  ).format(new Date(value));
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Активно",
  AUTHORIZED: "Авторизовано",
  ARCHIVED: "В архиве",
  ASSEMBLING: "Собирается",
  AWAITING_CONFIRMATION: "Ждёт подтверждения",
  AWAITING_SIGNATURE: "Ждёт подписи",
  BLOCKED: "Заблокировано",
  CANCELLED: "Отменено",
  CALCULATED: "Рассчитано",
  CAPTURED: "Оплачено",
  CLOSED: "Закрыто",
  COMPLETED: "Завершено",
  CONFIRMED: "Подтверждено",
  DEAD: "Исчерпаны попытки",
  DELIVERED: "Доставлено",
  DRAFT: "Черновик",
  EXPIRED: "Истёк срок",
  FAILED: "Ошибка",
  FRESH: "Актуально",
  GENERATED: "Сформировано",
  HIDDEN: "Скрыто",
  IN_PROGRESS: "В работе",
  IN_TRANSIT: "В пути",
  MAPPED: "Сопоставлено",
  MATCHED: "Сопоставлено",
  OPEN: "Открыто",
  PARTIAL: "Частично готово",
  PARTIALLY_FULFILLED: "Частично исполнено",
  PARTIALLY_REFUNDED: "Частичный возврат",
  PAUSED: "Приостановлено",
  PARTIALLY_CONFIRMED: "Частично подтверждено",
  PARTIALLY_DELIVERED: "Доставлено частично",
  PARTIALLY_SIGNED: "Частично подписано",
  PASSED: "Проверка пройдена",
  PENDING: "Ожидает",
  PROCESSING: "Обрабатывается",
  PUBLISHED: "Опубликовано",
  READY: "Готово",
  READY_TO_SHIP: "Готово к отправке",
  RECALLED: "Отозвано",
  RECONCILIATION: "На сверке",
  REJECTED: "Отклонено",
  RESTRICTED: "С ограничениями",
  REVIEW_REQUIRED: "Нужна проверка",
  REVOKED: "Отозвано",
  SENT: "Отправлено",
  SHIPPED: "Отправлено",
  DISPATCHED: "Передано перевозчику",
  PACKING: "Собирается",
  PLANNED: "Запланировано",
  RETURNED: "Возвращено",
  RETURN_DISPUTE: "Спор по возврату",
  SIGNED: "Подписано",
  STALE: "Устарело",
  RUNNING: "Выполняется",
  SUPERSEDED: "Заменено версией",
  UNDER_REVIEW: "На проверке",
  UNKNOWN: "Неизвестно",
  VERIFIED: "Проверено",
};

export function formatStatus(value: string | null | undefined) {
  if (!value) return "Нет статуса";
  return (
    statusLabels[value] ?? value.toLocaleLowerCase("ru").replaceAll("_", " ")
  );
}

export function errorMessage(error: unknown) {
  return feedbackErrorMessage(error);
}
