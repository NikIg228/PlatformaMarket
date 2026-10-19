import { MarketplaceApiError } from "@marketplace/api-client";
import { NcalayerError } from "@marketplace/eds-client";

const messages: Record<string, string> = {
  INVALID_SIGNATURE: "Подпись не прошла проверку. Начните новое подтверждение и выберите действующую ЭЦП физического лица.",
  CERTIFICATE_EXPIRED: "Срок действия сертификата истёк. Используйте действующую ЭЦП.",
  CERTIFICATE_REVOKED: "Сертификат отозван. Используйте действующую ЭЦП.",
  IDENTITY_CONFLICT: "Личность уже связана с аккаунтом. Для исправления привязки обратитесь в поддержку.",
  VERIFIER_UNAVAILABLE: "Проверка временно недоступна. Принятая подпись сохранена; повтор проверки не требует нового подписания.",
  TRUST_INDETERMINATE: "Не удалось проверить доверие к сертификату. Принятая подпись сохранена; повторите проверку позже.",
  SESSION_EXPIRED: "Время подтверждения истекло. Начните новое подтверждение.",
  SESSION_CANCELLED: "Подтверждение отменено или доступ изменился. Личность не привязана.",
  SESSION_ALREADY_ACTIVE: "У вас уже есть незавершённое подтверждение. Восстановите его состояние.",
  VERSION_CONFLICT: "Состояние подтверждения изменилось. Восстановите актуальное состояние.",
  UNAUTHORIZED: "Сеанс входа завершён. Войдите в кабинет заново.",
};
export function identityReason(code: string) {
  return messages[code] ?? "Подтверждение не завершено. Восстановите состояние или обратитесь в поддержку.";
}
export function identityFailure(error: unknown) {
  if (error instanceof NcalayerError) return "Не удалось получить подпись. Запустите NCALayer, проверьте подключение и выбранную ЭЦП. Повторное подписание начнётся только по вашему нажатию.";
  if (error instanceof MarketplaceApiError && error.payload && typeof error.payload === "object" && "code" in error.payload) {
    const code = String(error.payload.code);
    if (["VERIFIER_UNAVAILABLE", "TRUST_INDETERMINATE"].includes(code)) return "Сервис проверки временно недоступен. Восстановите состояние перед повторным действием.";
    return identityReason(code);
  }
  return "Не удалось получить ответ. Восстановите состояние перед повторным действием; подтверждение могло быть принято сервером.";
}

export function normalizeIdentityCms(value: string) {
  return value.replace(/-----BEGIN (?:CMS|PKCS7)-----|-----END (?:CMS|PKCS7)-----/g, "").replace(/\s/g, "");
}
