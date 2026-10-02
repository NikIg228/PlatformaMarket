"use client";
import { useCallback, useState } from "react";
import { DmButton, EmptyState, LoadingState, errorMessage } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { PermissionBoundary } from "./permission-boundary";

export default function Notifications() { return <PermissionBoundary required={["notification.view"]}><NotificationList /></PermissionBoundary>; }
function NotificationList() {
  const { api, organizationId, role } = useWorkspace();
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const load = useCallback(() => api.internalNotifications(organizationId, offset), [api, organizationId, offset]);
  const resource = useResource(load, { intervalMs: 30_000 });
  return <section className="mp-stack">
    {error || resource.error ? <p role="alert">{error || resource.error}<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton></p> : null}
    {resource.initialLoading ? <LoadingState label="Загружаем уведомления" /> : resource.data?.length === 0 ? <EmptyState title="Уведомлений пока нет" description="Здесь появятся изменения заказов, документов и обращения." /> : null}
    {resource.data?.map(item => {
      const href = item.aggregateId && /^[a-f0-9-]{36}$/i.test(item.aggregateId) ? item.aggregateType === "BusinessConversation" ? `/${role}/messages?conversationId=${item.aggregateId}` : item.aggregateType === "SupplierOrder" ? `/${role}/orders/${item.aggregateId}` : item.aggregateType === "SupportTicket" ? `/${role}/support?ticketId=${item.aggregateId}` : undefined : undefined;
      return <article key={item.id} style={{ padding: 16, border: "1px solid var(--dm-border)", borderRadius: 8 }}><h2>{item.subject}{!item.readAt ? " · Новое" : ""}</h2><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString("ru-KZ")}</small><div className="dm-conversations-toolbar">{href ? <DmButton as="a" href={href}>Открыть</DmButton> : null}{!item.readAt ? <DmButton disabled={Boolean(busy)} onClick={() => { setBusy(item.id); setError(""); void api.readNotification(item.id).then(() => resource.refreshAfterWrite()).catch(cause => setError(errorMessage(cause))).finally(() => setBusy(undefined)); }}>Отметить прочитанным</DmButton> : null}</div></article>;
    })}
    <div className="dm-conversations-toolbar"><DmButton disabled={!offset || resource.loading} onClick={() => setOffset(value => Math.max(0, value - 50))}>Назад</DmButton><DmButton disabled={resource.loading} onClick={() => void resource.refresh()}>Обновить</DmButton><DmButton disabled={resource.loading || resource.data?.length !== 50} onClick={() => setOffset(value => value + 50)}>Далее</DmButton></div>
  </section>;
}
