"use client";
export function ResourceStatus({ resource }: { resource: {
  lastSuccessAt: number | null; refreshing: boolean; offline: boolean; error: string | null;
} }) {
  if (!resource.lastSuccessAt || (!resource.offline && !resource.error)) return null;
  return <p role="status">
    {resource.offline ? "Нет сети. Показаны ранее загруженные данные." : `Не удалось загрузить данные: ${resource.error}. Показана предыдущая версия.`}
  </p>;
}
