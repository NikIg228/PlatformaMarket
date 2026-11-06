"use client";
import { ActionFeedback } from "@marketplace/ui";
import { DmAction } from "@marketplace/ui/controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SupportTicketListItem } from "@marketplace/schemas";
import { DmButton, DmDropdown, DmSearch, EmptyState, ErrorState, LoadingState, errorMessage, usePermissions, useUnsavedChanges } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { PermissionBoundary } from "./permission-boundary";
import { SupportCompose } from "./support-compose";
import { SupportTicket } from "./support-ticket";
import { emptySupportDraft, supportDate, supportStatuses } from "./support-presentation";
import { supportText, supportLocale } from "./support-copy";
import styles from "./support.module.css";
import { useSupportDrafts } from "./use-support-drafts";
import { Add20Regular } from "@fluentui/react-icons/svg/add";

export default function Support() {
  const { organizationId, session } = useWorkspace();
  return <PermissionBoundary required={["support.ticket.view"]}><SupportContent key={`${organizationId}:${session.sessionId}`} /></PermissionBoundary>;
}
function SupportContent() {
  const { api, organizationId, session, locale } = useWorkspace();
  const t = (text: string) => supportText(locale, text);
  const has = usePermissions(), canWrite = has("support.ticket.create");
  const query = useSearchParams(), router = useRouter(), pathname = usePathname();
  const selected = query.get("ticketId") ?? "";
  const q = (query.get("q") ?? "").slice(0, 200);
  const rawStatus = query.get("status") ?? "";
  const status = Object.hasOwn(supportStatuses, rawStatus) ? rawStatus : "";
  const filterKey = `${status}:${q}`;
  const [search, setSearch] = useState(q);
  const [pages, setPages] = useState({ key: filterKey, count: 1 });
  const pageCount = pages.key === filterKey ? pages.count : 1;
  const { draft, setDraft, replies, setReplies, files, setFiles, pending, key, forget, ready } = useSupportDrafts(`support-drafts:${organizationId}:${session.sessionId}`);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [feedback, setFeedback] = useState("");
  const [uploading, setUploading] = useState(false);
  const locked = busy || uploading;
  const lock = useRef(false);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const previousScreen = useRef({ selected, creating: false });
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setSearch(q), [q]);
  useUnsavedChanges(locked || Boolean(draft.subject || draft.description || Object.values(replies).some(value => value.trim()) || Object.values(files).some(items => items.length)));
  const list = useResource(useCallback(async () => {
    const items: SupportTicketListItem[] = [];
    let hasMore = false;
    for (let page = 0; page < pageCount; page++) {
      const result = await api.supportTickets(status || undefined, page * 50, { q, sort: "recent" });
      items.push(...result); hasMore = result.length === 50;
      if (!hasMore) break;
    }
    return { key: filterKey, count: pageCount, items: [...new Map(items.map(item => [item.id, item])).values()], hasMore };
  }, [api, status, q, pageCount, filterKey]), { intervalMs: 30_000, retainDataOnChange: true });
  const data = list.data?.key === filterKey ? list.data : null;
  useEffect(() => {
    if (!sentinel.current || !data?.hasMore || data.count !== pageCount || list.loading || busy) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); setPages({ key: filterKey, count: pageCount + 1 }); }
    });
    observer.observe(sentinel.current); return () => observer.disconnect();
  }, [data, pageCount, filterKey, list.loading, busy]);
  const firstTicket = canWrite && Boolean(data && !data.items.length && !q && !status && !selected);
  const mode = query.get("mode");
  const creating = canWrite && !selected && (mode === "new" || firstTicket);
  useEffect(() => {
    // Keep the form open if a timed-out create succeeded and later appears in the list.
    if (firstTicket && mode !== "new") {
      const next = new URLSearchParams(query.toString());
      next.set("mode", "new");
      router.replace(`${pathname}?${next}`, { scroll: false });
    }
  }, [firstTicket, mode, pathname, query, router]);
  useEffect(() => {
    const previous = previousScreen.current;
    if (!selected && !creating && (previous.selected || previous.creating)) {
      (rows.current.get(previous.selected) ?? listHeading.current)?.focus({ preventScroll: true });
    }
    previousScreen.current = { selected, creating };
  }, [selected, creating]);
  const navigate = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(query.toString());
    Object.entries(patch).forEach(([name, value]) => { if (value) next.set(name, value); else next.delete(name); });
    setError(""); setFeedback("");
    router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const run = async (action: () => Promise<void>) => {
    if (lock.current || uploading) return false;
    lock.current = true; setBusy(true); setError(""); setFeedback("");
    try { await action(); await list.refreshAfterWrite(); return true; }
    catch (cause) { setError(errorMessage(cause)); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  const create = () => run(async () => {
    const attachments = (files.create ?? []).map(({ assetId, name }) => ({ assetId, name }));
    const input = { subject: draft.subject.trim(), description: draft.description.trim(), category: draft.category, priority: "NORMAL" as const, links: [], ...(attachments.length ? { attachments } : {}) };
    const result = await api.createSupportTicket({ ...input, idempotencyKey: key("create", input) });
    forget("create"); setDraft(emptySupportDraft); setFiles(previous => ({ ...previous, create: [] }));
    navigate({ ticketId: result.id, mode: null, q: null, status: null }); setFeedback(t("Обращение отправлено"));
  });
  if (!ready) return <LoadingState label={t("Загружаем поддержку…")} />;
  return <section className={styles.workspace} data-selected={Boolean(selected)} data-first={firstTicket} aria-label={t("Обращения в поддержку")}>
    {error ? <ActionFeedback tone="error" title={t("Ошибка")} description={`${locale === "ru" ? error : t("Не удалось выполнить действие. Повторите попытку.")} ${t("Текст не потерян. Повторите отправку.")}`} /> : null}
    {feedback ? <ActionFeedback tone="success" title={t("Успешно")} description={feedback} /> : null}
    {firstTicket && list.error ? <ErrorState presentation="inline" title={t("Не удалось обновить обращения")} description={t("Не удалось загрузить данные. Проверьте соединение и повторите попытку.")} action={<DmButton onClick={() => void list.refresh()}>{t("Повторить загрузку списка")}</DmButton>} /> : null}
    <div className={styles.layout} data-detail={Boolean(selected || creating)} data-first={firstTicket}>
      {!firstTicket ? <aside className={styles.list} aria-label={t("Список обращений")}>
        <div className={styles.listHeader}><h2 ref={listHeading} tabIndex={-1}>{t("Мои обращения")}</h2><div className={styles.ticketActions}>{canWrite ? <DmButton appearance="primary" icon={<Add20Regular />} title={t("Новое обращение")} aria-label={t("Новое обращение")} disabled={locked || creating} onClick={() => navigate({ mode: "new", ticketId: null })} /> : null}</div></div>
        <div className={styles.filters}><DmSearch copy={locale === "kk" ? { clear: "Іздеуді тазарту", search: "Іздеу" } : undefined} className={styles.search} aria-label={t("Поиск обращений")} placeholder={t("Тема или номер обращения")} value={search} maxLength={200} onChange={setSearch} onSearch={value => navigate({ q: value })} pending={list.loading} disabled={locked} />
          <DmDropdown aria-label={t("Статус обращения")} value={status} disabled={locked} onChange={(_, value) => navigate({ status: value.value })}><option value="">{t("Все статусы")}</option>{Object.entries(supportStatuses).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</DmDropdown>
        </div>
        {list.error ? <div className={styles.listRecovery}><ErrorState presentation="inline" title={t("Не удалось загрузить обращения")} description={t("Не удалось загрузить данные. Проверьте соединение и повторите попытку.")} /><DmButton onClick={() => void list.refresh()}>{t("Повторить загрузку списка")}</DmButton></div> : null}
        {!data && list.loading ? <LoadingState label={t("Загружаем обращения…")} /> : data && !data.items.length ? <EmptyState title={q || status ? t("Обращения не найдены") : t("Обращений пока нет")} description={q || status ? t("Измените запрос или статус.") : t("Здесь появятся обращения вашей организации.")} /> : null}
        <div className={styles.rows}>{data?.items.map(item => <DmAction variant="row" type="button" key={item.id} ref={node => { if (node) rows.current.set(item.id, node); else rows.current.delete(item.id); }} className={styles.row} disabled={locked} aria-pressed={selected === item.id && !creating} onClick={() => navigate({ ticketId: item.id, mode: null })}>
          <div className={styles.rowMeta}><strong>{item.subject}</strong><time dateTime={item.updatedAt} title={supportDate(item.updatedAt, locale)}>{new Date(item.updatedAt).toLocaleDateString(supportLocale(locale)) === new Date().toLocaleDateString(supportLocale(locale)) ? new Intl.DateTimeFormat(supportLocale(locale), { hour: "2-digit", minute: "2-digit" }).format(new Date(item.updatedAt)) : new Intl.DateTimeFormat(supportLocale(locale), { day: "2-digit", month: "2-digit" }).format(new Date(item.updatedAt))}</time></div><span className={styles.preview}>{item.lastPublicMessage?.body || t(item.lastPublicMessage?.hasAttachments ? "Вложение" : "Нет сообщений")}</span><span className={styles.status} data-status={item.status}>{t(supportStatuses[item.status])}</span>
        </DmAction>)}{data?.hasMore ? <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} /> : null}</div>
        {data?.hasMore ? <DmButton className={styles.loadMore} disabled={busy || list.loading} onClick={() => setPages({ key: filterKey, count: pageCount + 1 })}>{list.loading ? <LoadingState presentation="inline" label={t("Загружаем обращения…")} /> : t("Показать ещё")}</DmButton> : null}
      </aside> : null}
      <div className={styles.content}>{creating ? <SupportCompose draft={draft} onChange={setDraft} onSubmit={create} busy={busy} files={files.create ?? []} onFiles={value => setFiles(previous => ({ ...previous, create: value }))} uploading={uploading} onUploading={setUploading} onCancel={firstTicket ? undefined : () => navigate({ mode: null })} /> : selected ? <SupportTicket key={selected} id={selected} canWrite={canWrite} busy={busy} files={files[selected] ?? []} onFiles={value => setFiles(previous => ({ ...previous, [selected]: value }))} uploading={uploading} onUploading={setUploading} draft={replies[selected] ?? ""} onDraft={value => setReplies(previous => ({ ...previous, [selected]: value }))} onBack={() => navigate({ ticketId: null })} onSend={reopen => run(async () => {
        const body = (replies[selected] ?? "").trim();
        const previous = pending.current.get(selected);
        const previousInput = previous ? JSON.parse(previous.json) as { body: string; reopen?: boolean } : null;
        const attachments = (files[selected] ?? []).map(({ assetId, name }) => ({ assetId, name }));
        const input = { body, isInternal: false, attachments, ...(reopen || previousInput?.body === body && previousInput.reopen ? { reopen: true } : {}) };
        await api.addSupportMessage(selected, { ...input, idempotencyKey: key(selected, input) });
        forget(selected); setReplies(previous => ({ ...previous, [selected]: "" })); setFiles(previous => ({ ...previous, [selected]: [] })); setFeedback(input.reopen ? t("Обращение снова в работе. Сообщение отправлено.") : t("Сообщение отправлено."));
      })} /> : <div className={styles.placeholder}><EmptyState title={t("Выберите обращение")} description={canWrite ? t("Откройте переписку слева или создайте новое обращение.") : t("Ваша роль позволяет просматривать обращения организации.")} /></div>}</div>
    </div>
  </section>;
}
