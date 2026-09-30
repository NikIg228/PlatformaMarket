"use client";
import { useCallback, type ReactNode } from "react";
import { DmButton, ErrorState, LoadingState, PermissionsProvider } from "@marketplace/ui";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { useResource } from "./use-resource";

export function WorkspacePermissions({ api, organizationId, children }: { api: MarketplaceApiClient; organizationId: string; children: ReactNode }) {
  const load = useCallback(() => api.get<string[]>("/access-control/permissions"), [api, organizationId]);
  const resource = useResource(load);
  if (!resource.data) return resource.error ? <ErrorState description="Не удалось проверить права доступа." action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : <LoadingState label="Проверяем доступ" />;
  return <PermissionsProvider permissions={resource.error ? [] : resource.data}>
    {resource.offline ? <p role="status">Нет сети. Права будут проверены после восстановления связи.</p> : resource.error ? <><p role="status">Не удалось проверить права. Действия временно недоступны; ваш ввод сохранён.</p><DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Повторить проверку прав</DmButton></> : null}
    {children}
  </PermissionsProvider>;
}
