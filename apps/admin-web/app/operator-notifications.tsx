"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { NotificationInbox } from "@marketplace/schemas";
import { ActionFeedback, DmButton, DmDialog, EmptyState, LoadingState, errorMessage } from "@marketplace/ui";
import { adminApiContext, readAdminSession } from "./admin-auth";

export function OperatorNotifications({ onSupport }: { onSupport: () => void }) {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const organizationId = readAdminSession()?.activeOrganizationId;
  const [data, setData] = useState<NotificationInbox | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const refresh = useCallback(async () => {
    if (!organizationId || running.current) return;
    running.current = true;
    try { setData(await api.notificationInbox(organizationId, { category: "support", limit: 20 })); setError(""); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { running.current = false; }
  }, [api, organizationId]);
  useEffect(() => {
    const update = () => { if (document.visibilityState === "visible") void refresh(); };
    update(); const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update); document.addEventListener("visibilitychange", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, [refresh]);
  return <>
    <DmButton onClick={() => { setOpen(true); void refresh(); }} aria-label={error ? "Уведомления поддержки: не удалось обновить" : `Уведомления поддержки: ${data?.unreadCount ?? 0} непрочитанных`}>Обращения{data?.unreadCount ? ` · ${data.unreadCount}` : error ? " · !" : ""}</DmButton>
    <DmDialog open={open} onOpenChange={setOpen} title="Уведомления поддержки" actions={<DmButton onClick={() => setOpen(false)}>Закрыть</DmButton>}>
      {error ? <ActionFeedback tone="error" description={error} action={<DmButton onClick={() => void refresh()}>Повторить</DmButton>} /> : null}
      {!data && !error ? <LoadingState label="Загружаем уведомления" /> : data?.items.length === 0 ? <EmptyState title="Новых событий нет" description="Здесь появятся обращения участников и ответы по ним." /> : null}
      <div className="mp-stack">{data?.items.map(item => <article key={item.id}><strong>{item.title}{!item.readAt ? " · Новое" : ""}</strong><p>{item.description}</p><DmButton disabled={busy} onClick={() => {
        setBusy(true); void api.readNotification(item.id).then(() => {
          setOpen(false); onSupport();
          if (item.target?.type === "support") { const url = new URL(window.location.href); url.searchParams.set("ticketId", item.target.id); window.history.replaceState(null, "", url.pathname + url.search); window.dispatchEvent(new PopStateEvent("popstate")); }
          void refresh();
        }).catch(cause => setError(errorMessage(cause))).finally(() => setBusy(false));
      }}>Открыть обращение</DmButton></article>)}</div>
    </DmDialog>
  </>;
}
