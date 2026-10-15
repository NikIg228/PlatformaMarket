import type { OperatorCapabilities, OperatorCapability, OperatorCount } from "@marketplace/schemas";

const numbers = new Intl.NumberFormat("ru-KZ");
export const formatOperatorCount = (value: OperatorCount) => value.status === "AVAILABLE" ? numbers.format(value.value) : "Нет данных";
export const formatObservedAt = (value: string) => new Date(value).toLocaleString("ru-KZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const capabilityNames: Record<OperatorCapability["id"], string> = {
  AI_ASSISTANT: "AI-помощник", TRUST: "Доверие и отзывы", PROMOTIONS: "Акции", BILLING: "Тарифные планы", RECOMMENDATIONS: "Рекомендации", AI_MODEL: "Внешняя AI-модель", PAYMENT_CONNECTOR: "Подключение платёжного сервиса",
};
export const capabilityStates: Record<OperatorCapability["status"], { label: string; tone: "success" | "neutral" | "warning" | "danger" }> = {
  AVAILABLE: { label: "Включено в профиле", tone: "success" },
  DISABLED_BY_PROFILE: { label: "Отключено профилем", tone: "neutral" },
  NOT_CONFIGURED: { label: "Не настроено", tone: "warning" },
  EXTERNAL_CONFIRMATION_REQUIRED: { label: "Нужна внешняя проверка", tone: "warning" },
  UNAVAILABLE: { label: "Нет данных", tone: "danger" },
};
export const capabilityReasons: Record<OperatorCapability["reason"], string> = {
  PROFILE_ENABLED: "Функция включена в текущем профиле. Доступ зависит от прав и условий организации.",
  PROFILE_DISABLED: "Функция отключена в текущем профиле.",
  EXTERNAL_CONFIG_MISSING: "Обязательные настройки внешнего подключения не заполнены.",
  EXTERNAL_VERIFICATION_MISSING: "Настройки есть. Работа с внешним сервисом не подтверждена этой проверкой.",
  EXTERNAL_PROVIDER_MISSING: "Активный внешний платёжный провайдер не зарегистрирован.",
  SOURCE_UNAVAILABLE: "Не удалось проверить состояние. Повторите загрузку.",
};
export const capabilityLinks = { imports: "Подключения и загрузка", orders: "Заказы и договоры", security: "Контроль и аудит", catalog: "Каталог" } as const;
export function capabilityProjectionPartial(data: OperatorCapabilities) {
  return data.connectors.status === "UNAVAILABLE" || data.activePaymentProviders.status === "UNAVAILABLE" || data.activeComplianceRules.status === "UNAVAILABLE" || data.capabilities.some(item => item.status === "UNAVAILABLE");
}
