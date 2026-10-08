export const offlineMessage = "Нет подключения к сети. Данные могут быть устаревшими.";
export function feedbackErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Произошла неизвестная ошибка";
  const name = error instanceof Error ? error.name : "";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return offlineMessage;
  if (name === "TimeoutError") return "Ответ не получен вовремя. Проверьте результат действия перед повтором.";
  if (/^(Failed to fetch|Failed to Fetch|NetworkError.*|Load failed|fetch failed)$/i.test(message))
    return "Не удалось связаться с сервисом. Проверьте соединение и результат действия перед повтором.";
  if (/^Marketplace API returned 5\d\d$/.test(message)) return "Сервис временно недоступен. Проверьте результат действия перед повтором.";
  return message;
}

/** Writes with no conclusive response must never be described as rejected. */
export function actionFailure(error: unknown, options: { write?: boolean; title?: string } = {}) {
  const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
  if (options.write && (!status || status >= 500 || status === 408))
    return { tone: "warning" as const, title: "Результат пока неизвестен", description: "Проверьте результат операции перед повторным действием." };
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return { tone: "warning" as const, title: "Нет подключения к сети", description: "Не удалось проверить актуальные данные." };
  if (status === 401) return { tone: "warning" as const, title: "Нужно войти заново", description: "Сессия истекла. Войдите в аккаунт для продолжения." };
  if (status === 403) return { tone: "warning" as const, title: "Недостаточно прав", description: "Попросите администратора организации проверить ваш доступ." };
  return { tone: "error" as const, title: options.title ?? "Не удалось выполнить действие", description: feedbackErrorMessage(error) };
}
