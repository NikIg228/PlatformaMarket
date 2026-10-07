"use client";
import { useCallback, useRef, useState } from "react";
import { Laptop24Regular } from "@fluentui/react-icons/svg/laptop";
import { Desktop24Regular } from "@fluentui/react-icons/svg/desktop";
import { Phone24Regular } from "@fluentui/react-icons/svg/phone";
import { DmButton, DmDialog, DmFeedback, EmptyState, LoadingState, errorMessage } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { sessionStore as clinicSessionStore } from "../../../buyer-web/app/workspace-session";
import { sessionStore as supplierSessionStore } from "../../../supplier-web/app/workspace-session";
import styles from "./account-settings.module.css";

function deviceName(agent: string | null) {
  if (!agent) return { name: "Неизвестное устройство", kind: "desktop" };
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "Браузер";
  const system = /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Windows/.test(agent) ? "Windows" : /Macintosh|Mac OS/.test(agent) ? "macOS" : /Linux/.test(agent) ? "Linux" : "Неизвестная ОС";
  return { name: `${browser} · ${system}`, kind: /Android|iPhone|iPad/.test(agent) ? "phone" : system === "Windows" ? "laptop" : "desktop" };
}

function activityDate(value: string) {
  const date = new Date(value), today = new Date(), yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const day = date.toDateString() === today.toDateString() ? "Сегодня" : date.toDateString() === yesterday.toDateString() ? "Вчера" : date.toLocaleDateString("ru-KZ", { day: "numeric", month: "long" });
  return `${day}, ${date.toLocaleTimeString("ru-KZ", { hour: "2-digit", minute: "2-digit" })}`;
}

export function ProfileSessions() {
  const { api, session, role } = useWorkspace();
  const load = useCallback(() => api.listSessions(), [api]);
  const resource = useResource(load, { automatic: false });
  const [page, setPage] = useState(1);
  const ordered = [...(resource.data ?? [])].sort((a, b) => Number(b.id === session.sessionId) - Number(a.id === session.sessionId));
  const pageCount = Math.max(1, Math.ceil(ordered.length / 5)), currentPage = Math.min(page, pageCount);
  const visible = ordered.slice((currentPage - 1) * 5, currentPage * 5);
  const [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState(false);
  const lock = useRef(false), trigger = useRef<HTMLButtonElement | null>(null), heading = useRef<HTMLHeadingElement>(null);
  const close = () => { setSelected(null); setError(null); };
  async function revoke() {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await api.revokeSession(selected);
      if (result.id !== selected || result.status !== "REVOKED") throw new Error("Сервер не подтвердил завершение сеанса. Повторите попытку.");
      if (selected === session.sessionId) {
        const store = role === "clinic" ? clinicSessionStore : supplierSessionStore;
        if (store.getSnapshot().session?.sessionId === selected) { store.invalidate(); window.location.replace("/login"); }
        return;
      }
      resource.setData(current => current?.filter(item => item.id !== selected) ?? null);
      close(); setNotice(true);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className={styles.card} aria-label="Активные сеансы"><h2 ref={heading} tabIndex={-1}>Активные сеансы</h2><p className={styles.intro}>Завершите сеанс на устройстве, которым больше не пользуетесь.</p>
    {resource.error ? <DmFeedback tone="danger" title="Не удалось загрузить сеансы" description={resource.error} alert action={<DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>} /> : null}
    {resource.loading && !resource.data ? <LoadingState label="Загружаем сеансы" /> : null}
    {notice ? <DmFeedback tone="success" title="Сеанс завершён" description="На том устройстве потребуется повторный вход." /> : null}
    {resource.data?.length === 0 ? <EmptyState title="Активных сеансов нет" description="Войдите в аккаунт заново." /> : null}
    <ul className={styles.sessions}>{visible.map(item => {
      const device = deviceName(item.userAgent), Icon = device.kind === "phone" ? Phone24Regular : device.kind === "laptop" ? Laptop24Regular : Desktop24Regular;
      return <li className={styles.session} key={item.id}><Icon className={styles.device} aria-hidden="true" /><div className={styles.sessionInfo}><div className={styles.sessionTitle}><span>{device.name}</span>{item.id === session.sessionId ? <span className={styles.badge}>Текущий сеанс</span> : null}</div><p>{activityDate(item.lastUsedAt ?? item.createdAt)}</p></div><DmButton appearance="outline" intent="brand" disabled={busy} onClick={event => { trigger.current = event.currentTarget; setSelected(item.id); setError(null); }}>Завершить сеанс</DmButton></li>;
    })}</ul>
    {pageCount > 1 ? <nav className={styles.pagination} aria-label="Страницы сеансов"><DmButton disabled={busy || currentPage === 1} onClick={() => setPage(currentPage - 1)}>Назад</DmButton><span aria-live="polite">Страница {currentPage} из {pageCount} · Всего {ordered.length}</span><DmButton disabled={busy || currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Далее</DmButton></nav> : null}
    <DmDialog open={selected !== null} onOpenChange={open => { if (!open && !lock.current) close(); }} onClosed={() => (trigger.current?.isConnected ? trigger.current : heading.current)?.focus()} title="Завершить сеанс?" description={`На этом устройстве потребуется повторный вход.${selected === session.sessionId ? " Вы завершаете текущий сеанс." : ""}`} actions={<><DmButton disabled={busy} onClick={close}>Отмена</DmButton><DmButton disabled={busy} appearance="primary" onClick={() => void revoke()}>{busy ? "Завершаем…" : "Подтвердить завершение"}</DmButton></>}>
      {error ? <DmFeedback tone="danger" title="Сеанс не завершён" description={error} alert /> : null}
    </DmDialog>
  </section>;
}
