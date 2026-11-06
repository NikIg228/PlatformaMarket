"use client";
import { LoadingState } from "@marketplace/ui/loading-state";
import { useSearchParams } from "next/navigation";
import { workspaceLocale, workspaceText } from "./workspace-locale";
export function ResourceStatus({ resource }: { resource: {
  lastSuccessAt: number | null; refreshing: boolean; offline: boolean; error: string | null;
} }) {
  const locale = workspaceLocale(useSearchParams().get("lang"));
  const t = (text: string) => workspaceText(locale, text);
  if (!resource.lastSuccessAt) return null;
  if (resource.refreshing && !resource.offline && !resource.error) return <LoadingState presentation="inline" label={t("Обновляем данные…")} />;
  if (!resource.offline && !resource.error) return null;
  return <p role="status">
    {resource.offline ? t("Нет сети. Показаны ранее загруженные данные.") : `${t("Не удалось загрузить данные")}: ${resource.error}. ${t("Показана предыдущая версия.")}`}
  </p>;
}
