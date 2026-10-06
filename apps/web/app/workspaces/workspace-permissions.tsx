"use client";
import { useCallback, type ReactNode } from "react";
import { DmButton, ErrorState, LoadingState, PermissionsProvider } from "@marketplace/ui";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { useResource } from "./use-resource";

export function WorkspacePermissions({ api, organizationId, children, render = content => content }: { api: MarketplaceApiClient; organizationId: string; children: ReactNode; render?: (content: ReactNode) => ReactNode }) {
  const load = useCallback((signal: AbortSignal) => api.getAccessPolicy(signal), [api, organizationId]);
  const resource = useResource(load);
  const content = !resource.data ? (resource.error ? <ErrorState description="Не удалось проверить права доступа." action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : <LoadingState label="Проверяем доступ" />) : <>
    {resource.offline ? <p role="status">Нет сети. Права будут проверены после восстановления связи.</p> : resource.error ? <><p role="status">Не удалось проверить права. Действия временно недоступны; ваш ввод сохранён.</p><DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Повторить проверку прав</DmButton></> : null}
    {children}
  </>;
  return <PermissionsProvider permissions={resource.error ? [] : resource.data?.permissions ?? []} mode={resource.data?.mode ?? "ROLE_BASED"}>
    {render(content)}
  </PermissionsProvider>;
}
