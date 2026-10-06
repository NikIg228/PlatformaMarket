"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { SupportTicketDetail, UploadedSupportAttachment } from "@marketplace/schemas";
import { DmButton, SupportAttachmentList, ErrorState, LoadingState, errorMessage } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { supportCategories, supportDate, supportStatuses } from "./support-presentation";
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
  const { api, role } = useWorkspace();
  const resource = useResource(useCallback(() => api.supportTicket(id), [api, id]), { intervalMs: 15_000 });
  const ticket = resource.data;
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [olderBusy, setOlderBusy] = useState(false);
  const [olderError, setOlderError] = useState("");
  const [newCount, setNewCount] = useState(0);
  const [reopen, setReopen] = useState(false);
  const viewport = useRef<HTMLOListElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const known = useRef(new Set<string>());
  const initialized = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!ticket) return;
    const initial = !initialized.current;
    const fresh = ticket.messages.filter(message => !known.current.has(message.id));
    const list = viewport.current;
    const atBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 70;
    for (const message of ticket.messages) known.current.add(message.id);
    setMessages(previous => mergeMessages(previous, ticket.messages));
    if (initial) { setHasOlder(ticket.hasOlder); initialized.current = true; heading.current?.focus({ preventScroll: true }); }
    if (initial || atBottom && fresh.length) requestAnimationFrame(() => { if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; });
    else if (fresh.length) setNewCount(value => value + fresh.length);
  }, [ticket]);
  const older = async () => {
    if (olderBusy || !messages[0]) return;
    setOlderBusy(true); setOlderError("");
    const height = viewport.current?.scrollHeight ?? 0;
    try {
      const result = await api.supportTicket(id, messages[0].id);
      if (!mounted.current) return;
      result.messages.forEach(message => known.current.add(message.id));
      setMessages(previous => mergeMessages(previous, result.messages)); setHasOlder(result.hasOlder);
      requestAnimationFrame(() => { if (viewport.current) viewport.current.scrollTop += viewport.current.scrollHeight - height; });
    } catch (cause) { if (mounted.current) setOlderError(errorMessage(cause)); }
    finally { if (mounted.current) setOlderBusy(false); }
  };
  const terminal = ticket?.status === "RESOLVED" || ticket?.status === "CLOSED";
  return <section className={styles.detail} aria-label="Переписка с поддержкой">
    <DmButton appearance="subtle" className={styles.mobileBack} aria-label="← К обращениям" disabled={busy || uploading} onClick={onBack}>← К обращениям</DmButton>
    {resource.error ? <ErrorState title="Не удалось обновить обращение" description={resource.error} action={<DmButton onClick={() => void resource.refresh()}>Повторить загрузку</DmButton>} /> : null}
    {resource.initialLoading ? <LoadingState label="Загружаем обращение" /> : ticket ? <>
      <header className={styles.ticketHeader}><div className={styles.ticketIdentity}><h2 ref={heading} tabIndex={-1}>{ticket.subject}</h2><span className={styles.muted}>{supportCategories[ticket.category] ?? "Обращение в поддержку"} · {ticket.number}</span></div>
        <div className={styles.ticketActions}><span className={styles.status} data-status={ticket.status}>{supportStatuses[ticket.status]}</span></div>
        {ticket.links.filter(link => link.entityType === "BusinessConversation").map(link => <DmButton as="a" key={link.id} href={`/${role}/messages?conversationId=${encodeURIComponent(link.entityId)}`} appearance="subtle">Связанный диалог</DmButton>)}
      </header>
      {ticket.status === "WAITING_CUSTOMER" ? <p className={styles.notice}>Поддержка ждёт уточнений. Ответьте в этом обращении.</p> : null}
      {hasOlder ? <div className={styles.historyAction}><DmButton disabled={busy || olderBusy} onClick={() => void older()}>{olderBusy ? "Загружаем…" : "Показать ранние сообщения"}</DmButton></div> : null}
      {olderError ? <p role="alert" className={styles.notice}>{olderError} <DmButton disabled={olderBusy} onClick={() => void older()}>Повторить загрузку истории</DmButton></p> : null}
      <ol ref={viewport} className={styles.history} aria-label="Сообщения обращения" onScroll={() => { const list = viewport.current; if (list && list.scrollHeight - list.scrollTop - list.clientHeight < 70) setNewCount(0); }}>
        {messages.map((message, index) => <Fragment key={message.id}>
          {!index || new Date(messages[index - 1].createdAt).toLocaleDateString("ru-KZ") !== new Date(message.createdAt).toLocaleDateString("ru-KZ") ? <li className={styles.day}><time dateTime={message.createdAt}>{new Intl.DateTimeFormat("ru-KZ", { day: "numeric", month: "long", year: "numeric" }).format(new Date(message.createdAt))}</time></li> : null}
          <li className={styles.message} data-own={message.authorLabel === "Вы"}><div className={styles.messageMeta}><strong>{message.authorLabel ?? "Участник обращения"}</strong></div>{message.body ? <p>{message.body}</p> : null}
            <SupportAttachmentList api={api} ticketId={id} messageId={message.id} files={message.attachments} />
            <time className={styles.messageTime} dateTime={message.createdAt} title={supportDate(message.createdAt)}>{new Intl.DateTimeFormat("ru-KZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}</time>
          </li>
        </Fragment>)}
      </ol>
      {newCount ? <DmButton className={styles.newMessages} onClick={() => { if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; setNewCount(0); }}>Новые сообщения · {newCount} ↓</DmButton> : null}
      {canWrite ? terminal && !reopen ? <div className={styles.closed}><div><strong>Обращение {ticket.status === "CLOSED" ? "закрыто" : "решено"}</strong><p>Если нужна помощь по этому вопросу, продолжите обращение.</p></div><DmButton disabled={busy} onClick={() => setReopen(true)}>Вопрос не решён</DmButton></div> : <SupportReplyComposer value={draft} onChange={onDraft} files={files} onFiles={onFiles} busy={busy} uploading={uploading} onUploading={onUploading} reopening={Boolean(terminal)} onCancel={() => setReopen(false)} onSubmit={async () => {
        const saved = await onSend(Boolean(terminal && reopen));
        if (saved && mounted.current) { setReopen(false); await resource.refreshAfterWrite(); requestAnimationFrame(() => { if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; }); }
        return saved;
      }} /> : <p className={styles.notice}>Ваша роль позволяет только просматривать обращения.</p>}
    </> : null}
  </section>;
}
