"use client";
import { MarketplaceApiError } from "@marketplace/api-client";
import { ActionFeedback } from "@marketplace/ui";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SupportTicketDetail, UploadedSupportAttachment } from "@marketplace/schemas";
import { DmButton, SupportAttachmentList, ErrorState, LoadingState, errorMessage } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { supportCategories, supportDate, supportStatuses } from "./support-presentation";
import { supportText, supportLocale } from "./support-copy";
import styles from "./support.module.css";
import { SupportReplyComposer } from "./support-reply-composer";

type Message = SupportTicketDetail["messages"][number];
function mergeMessages(previous: Message[], incoming: Message[]) {
  const entries = new Map(previous.map(message => [message.id, message]));
  for (const message of incoming) entries.set(message.id, message);
  return [...entries.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
export function SupportTicket({ id, draft, onDraft, canWrite, busy, onSend, onBack, files, onFiles, uploading, onUploading }: {
  id: string; draft: string; onDraft: (value: string) => void; canWrite: boolean; busy: boolean;
  onSend: (reopen: boolean) => Promise<boolean>; onBack: () => void;
  files: UploadedSupportAttachment[]; onFiles: (files: UploadedSupportAttachment[]) => void;
  uploading: boolean; onUploading: (busy: boolean) => void;
}) {
  const { api, role, locale } = useWorkspace();
  const t = (text: string) => supportText(locale, text);
  const [unavailable, setUnavailable] = useState(false);
  const resource = useResource(useCallback(async () => {
    try { return await api.supportTicket(id); }
    catch (cause) {
      if (cause instanceof MarketplaceApiError && [400, 403, 404, 422].includes(cause.status)) setUnavailable(true);
      throw cause;
    }
  }, [api, id]), { intervalMs: 15_000, automatic: !unavailable });
  const ticket = resource.data;
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const [olderError, setOlderError] = useState("");
  const [announcedCount, setAnnouncedCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [reopen, setReopen] = useState(false);
  const viewport = useRef<HTMLOListElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const known = useRef(new Set<string>());
  const initialized = useRef(false);
  const pendingScroll = useRef<"bottom" | { top: number; height: number } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!ticket) return;
    const initial = !initialized.current;
    const fresh = ticket.messages.filter(message => !known.current.has(message.id));
    if (!initial && fresh.length) setAnnouncedCount(value => value + fresh.length);
    const list = viewport.current;
    const atBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 70;
    for (const message of ticket.messages) known.current.add(message.id);
    setMessages(previous => mergeMessages(previous, ticket.messages));
    if (initial) { setHasOlder(ticket.hasOlder); initialized.current = true; heading.current?.focus({ preventScroll: true }); }
    if (initial || atBottom && fresh.length) pendingScroll.current = "bottom";
    else if (fresh.length) setNewCount(value => value + fresh.length);
  }, [ticket]);
  useLayoutEffect(() => {
    const list = viewport.current, pending = pendingScroll.current;
    if (!list || !pending) return;
    list.scrollTop = pending === "bottom" ? list.scrollHeight : pending.top + list.scrollHeight - pending.height;
    pendingScroll.current = null;
  }, [messages]);
  const older = async () => {
    if (olderBusy || !messages[0]) return;
    setOlderBusy(true); setOlderError("");
    try {
      const result = await api.supportTicket(id, messages[0].id);
      if (!mounted.current) return;
      result.messages.forEach(message => known.current.add(message.id));
      if (viewport.current) pendingScroll.current = { top: viewport.current.scrollTop, height: viewport.current.scrollHeight };
      setMessages(previous => mergeMessages(previous, result.messages)); setHasOlder(result.hasOlder);
    } catch (cause) { if (mounted.current) setOlderError(errorMessage(cause)); }
    finally { if (mounted.current) setOlderBusy(false); }
  };
  const terminal = ticket?.status === "RESOLVED" || ticket?.status === "CLOSED";
  return <section className={styles.detail} aria-label={t("Переписка с поддержкой")}>
    <DmButton appearance="subtle" className={styles.mobileBack} aria-label={t("← К обращениям")} disabled={busy || uploading} onClick={onBack}>{t("← К обращениям")}</DmButton>
    <span role="status" aria-live="polite" aria-atomic="true" className={styles.srOnly}>{announcedCount ? `${t("Получены новые сообщения")}: ${announcedCount}` : ""}</span>
    {resource.error ? <ErrorState presentation="inline" title={t(unavailable ? "Обращение недоступно" : "Не удалось обновить обращение")} description={t(unavailable ? "Проверьте ссылку или выберите другое обращение в списке." : "Не удалось загрузить данные. Проверьте соединение и повторите попытку.")} action={unavailable ? <DmButton onClick={onBack}>{t("К обращениям")}</DmButton> : <DmButton onClick={() => void resource.refresh()}>{t("Повторить загрузку")}</DmButton>} /> : null}
    {resource.initialLoading ? <LoadingState label={t("Загружаем обращение…")} /> : ticket ? <>
      <header className={styles.ticketHeader}><div className={styles.ticketIdentity}><h2 ref={heading} tabIndex={-1}>{ticket.subject}</h2><span className={styles.muted}>{t(supportCategories[ticket.category] ?? "Обращение в поддержку")} · {ticket.number}</span></div>
        <div className={styles.ticketActions}><span className={styles.status} data-status={ticket.status}>{t(supportStatuses[ticket.status])}</span></div>
        {ticket.links.filter(link => link.entityType === "BusinessConversation").map(link => <DmButton as="a" key={link.id} href={`/${role}/messages?conversationId=${encodeURIComponent(link.entityId)}`} appearance="subtle">{t("Связанный диалог")}</DmButton>)}
      </header>
      {ticket.status === "WAITING_CUSTOMER" ? <p className={styles.notice}>{t("Поддержка ждёт уточнений. Ответьте в этом обращении.")}</p> : null}
      {hasOlder ? <div className={styles.historyAction}><DmButton disabled={busy || olderBusy} onClick={() => void older()}>{olderBusy ? <LoadingState presentation="inline" label={t("Загружаем сообщения…")} /> : t("Показать ранние сообщения")}</DmButton></div> : null}
      {olderError ? <ActionFeedback tone="error" title={t("Ошибка")} description={locale === "ru" ? olderError : t("Не удалось загрузить данные. Проверьте соединение и повторите попытку.")} action={<DmButton disabled={olderBusy} onClick={() => void older()}>{t("Повторить загрузку истории")}</DmButton>} /> : null}
      <ol ref={viewport} className={styles.history} aria-label={t("Сообщения обращения")} onScroll={() => { const list = viewport.current; if (list && list.scrollHeight - list.scrollTop - list.clientHeight < 70) setNewCount(0); }}>
        {messages.map((message, index) => <Fragment key={message.id}>
          {!index || new Date(messages[index - 1].createdAt).toLocaleDateString(supportLocale(locale)) !== new Date(message.createdAt).toLocaleDateString(supportLocale(locale)) ? <li className={styles.day}><time dateTime={message.createdAt}>{new Intl.DateTimeFormat(supportLocale(locale), { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(message.createdAt))}</time></li> : null}
          <li className={styles.message} data-own={message.authorKind === "SELF" || (!message.authorKind && message.authorLabel === "Вы")}><div className={styles.messageMeta}><strong>{t(message.authorKind === "SELF" ? "Вы" : message.authorKind === "SUPPORT" ? "Поддержка" : message.authorKind === "ORGANIZATION" ? "Сотрудник организации" : message.authorLabel ?? "Участник обращения")}</strong></div>{message.body ? <p>{message.body}</p> : null}
            <SupportAttachmentList locale={locale} api={api} ticketId={id} messageId={message.id} files={message.attachments} />
            <time className={styles.messageTime} dateTime={message.createdAt} title={supportDate(message.createdAt, locale)}>{new Intl.DateTimeFormat(supportLocale(locale), { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time>
          </li>
        </Fragment>)}
      </ol>
      {newCount ? <DmButton className={styles.newMessages} onClick={() => { if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; setNewCount(0); }}>{t("Новые сообщения") + " · "}{newCount} ↓</DmButton> : null}
      {canWrite ? terminal && !reopen ? <div className={styles.closed}><div><strong>{t(ticket.status === "CLOSED" ? "Обращение закрыто" : "Обращение решено")}</strong><p>{t("Если нужна помощь по этому вопросу, продолжите обращение.")}</p></div><DmButton disabled={busy} onClick={() => setReopen(true)}>{t("Вопрос не решён")}</DmButton></div> : <SupportReplyComposer value={draft} onChange={onDraft} files={files} onFiles={onFiles} busy={busy} uploading={uploading} onUploading={onUploading} reopening={Boolean(terminal)} onCancel={() => setReopen(false)} onSubmit={async () => {
        const saved = await onSend(Boolean(terminal && reopen));
        if (saved && mounted.current) { setReopen(false); pendingScroll.current = "bottom"; await resource.refreshAfterWrite(); }
        return saved;
      }} /> : <p className={styles.notice}>{t("Ваша роль позволяет только просматривать обращения.")}</p>}
    </> : null}
  </section>;
}
