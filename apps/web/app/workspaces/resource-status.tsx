"use client";
export function ResourceStatus({ resource }: { resource: {
  lastSuccessAt: number | null; refreshing: boolean; offline: boolean; error: string | null;
} }) {
  if (!resource.lastSuccessAt) return null;
  return <p role="status">
    {resource.offline ? "Нет сети. Показаны ранее загруженные данные." : resource.error
      ? `Не удалось обновить данные: ${resource.error}. Показана предыдущая версия.`
      : resource.refreshing ? "Обновляем данные…" : "Данные обновлены"}
    {" · "}<time dateTime={new Date(resource.lastSuccessAt).toISOString()}>{new Date(resource.lastSuccessAt).toLocaleTimeString("ru-RU")}</time>
  </p>;
}
