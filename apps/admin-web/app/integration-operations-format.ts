export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4012/api";

export const dataTypes = [
  "CATALOG",
  "PRICE",
  "INVENTORY",
  "ORDER",
  "RESERVATION",
  "SHIPMENT",
  "RETURN",
  "IMAGE",
];

export const jobTypes = [
  "TEST_CONNECTION",
  "DISCOVER",
  "CATALOG_SYNC",
  "INCREMENTAL_SYNC",
  "PRICE_SYNC",
  "INVENTORY_SYNC",
  "RECONCILIATION",
];

export const dataTypeLabels: Record<string, string> = {
  CATALOG: "Каталог",
  PRICE: "Цены",
  INVENTORY: "Остатки",
  ORDER: "Заказы",
  RESERVATION: "Резервы",
  SHIPMENT: "Отгрузки",
  RETURN: "Возвраты",
  IMAGE: "Изображения",
};

export function providerLabel(provider: string) {
  return provider === "ONE_C"
    ? "1С"
    : provider === "MOYSKLAD"
      ? "МойСклад"
      : provider === "MOCK"
        ? "Тестовое подключение"
        : provider;
}

export const jobTypeLabels: Record<string, string> = {
  TEST_CONNECTION: "Проверка подключения",
  DISCOVER: "Поиск доступных данных",
  CATALOG_SYNC: "Обновление каталога",
  INCREMENTAL_SYNC: "Обновление изменений",
  PRICE_SYNC: "Обновление цен",
  INVENTORY_SYNC: "Обновление остатков",
  RECONCILIATION: "Сверка данных",
};

export const triggerLabels: Record<string, string> = { MANUAL: "Вручную", SCHEDULE: "По расписанию", WEBHOOK: "По уведомлению" };

export function dateTime(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("ru-KZ", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "Нет данных";
}
