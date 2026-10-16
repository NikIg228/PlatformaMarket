import { formatStatus } from "@marketplace/ui/format";

const labels: Record<string, string> = {
  UNPAID: "Не оплачено", PAID: "Оплачено", AWAITING_PAYMENT: "Ожидает оплаты", RESERVED: "Зарезервировано", REFUNDED: "Деньги возвращены",
  NEEDS_INFORMATION: "Требуется уточнение", NOT_RECEIVED: "Не получено", DISPUTED: "Оспаривается",
  REQUESTED: "Запрошено", AGREED: "Согласовано", GOODS_SENT: "Товар отправлен обратно", GOODS_RECEIVED: "Товар возвращён",
  REFUND_SENT: "Возврат денег отправлен", REFUND_RECEIVED: "Возврат денег получен",
  SUBMITTED: "Подано", RESOLUTION_PROPOSED: "Предложено урегулирование", RESUPPLY: "Допоставка", REDUCTION: "Уменьшение заказа",
  RETURN: "Возврат", CORRECTION: "Исправление", OTHER: "Другое", NOT_SELECTED: "Не выбран",
  PICKUP: "Самовывоз", DELIVERY: "Доставка", INSTALLATION: "Установка", TRAINING: "Обучение", SERVICE: "Обслуживание", SCHEDULED: "Запланировано",
};

export function orderStatusLabel(value: string | null | undefined) {
  return value ? labels[value] ?? formatStatus(value) : formatStatus(value);
}
