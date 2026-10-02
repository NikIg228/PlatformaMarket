"use client";
import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DmButton, DmField, DmInput, DmTextarea, EmptyState, LoadingState, errorMessage, formatStatus, usePermissions } from "@marketplace/ui";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { PermissionBoundary } from "./permission-boundary";

export default function Support() { return <PermissionBoundary required={["support.ticket.view"]}><SupportContent /></PermissionBoundary>; }
function SupportContent() {
  const { api, role } = useWorkspace();
  const has = usePermissions();
  const query = useSearchParams();
  const [selected, setSelected] = useState<string | undefined>(query.get("ticketId") ?? undefined);
  const [offset, setOffset] = useState(0);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const lock = useRef(false);
  const pending = useRef(new Map<string, { json: string; key: string }>());
  const list = useResource(useCallback(() => api.supportTickets(undefined, offset), [api, offset]));
  const detail = useResource(useCallback(() => selected ? api.supportTicket(selected) : Promise.resolve(null), [api, selected]));
  const ticket = detail.data;
  const key = (scope: string, input: unknown) => { const json = JSON.stringify(input); let item = pending.current.get(scope); if (!item || item.json !== json) { item = { json, key: crypto.randomUUID() }; pending.current.set(scope, item); } return item.key; };
  const run = async (action: () => Promise<void>) => { if (lock.current) return; lock.current = true; setBusy(true); setError(""); setFeedback(""); try { await action(); await list.refreshAfterWrite(); } catch (cause) { setError(errorMessage(cause)); } finally { lock.current = false; setBusy(false); } };
  return <section className="mp-stack">
    {error || list.error || detail.error ? <p role="alert">{error || list.error || detail.error} Ввод сохранён.<DmButton disabled={busy} onClick={() => { void list.refresh(); void detail.refresh(); }}>Обновить</DmButton></p> : null}{feedback ? <p role="status">{feedback}</p> : null}
    <div className="dm-conversations-layout"><aside className="dm-conversations-list"><DmButton disabled={busy} onClick={() => setSelected(undefined)}>Новое обращение</DmButton>{list.initialLoading ? <LoadingState label="Загружаем обращения" /> : list.data?.length === 0 ? <EmptyState title="Обращений нет" description="Создайте обращение или запросите оператора в диалоге." /> : null}{list.data?.map(item => <DmButton key={item.id} disabled={busy} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setFeedback(""); }}><span>{item.subject} · {formatStatus(item.status)}</span></DmButton>)}<DmButton disabled={!offset || busy} onClick={() => setOffset(value => Math.max(0, value - 50))}>Назад</DmButton><DmButton disabled={list.data?.length !== 50 || busy} onClick={() => setOffset(value => value + 50)}>Далее</DmButton></aside>
    <div className="dm-conversations-detail">{selected ? ticket ? <><h2>{ticket.subject}</h2><p>{ticket.number} · {formatStatus(ticket.status)}</p><p>Срок: {ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString("ru-KZ") : "Уточняется"}</p>{ticket.links.filter(link => link.entityType === "BusinessConversation").map(link => <DmButton as="a" key={link.id} href={`/${role}/messages?conversationId=${link.entityId}`}>Связанный диалог</DmButton>)}
      {ticket.hasOlder ? <DmButton disabled={busy} onClick={() => void run(async () => { const older = await api.supportTicket(selected, ticket.messages[0].id); detail.setData(value => value ? { ...value, hasOlder: older.hasOlder, messages: [...older.messages, ...value.messages] } : value); })}>Ранние сообщения</DmButton> : null}
      <ol className="dm-conversations-history">{ticket.messages.map(message => <li key={message.id}><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString("ru-KZ")}</small></li>)}</ol>
      {has("support.ticket.create") ? <form onSubmit={event => { event.preventDefault(); void run(async () => { const input = { body: (drafts[selected] ?? "").trim(), isInternal: false, attachments: [] }; await api.addSupportMessage(selected, { ...input, idempotencyKey: key(selected, input) }); setDrafts(value => ({ ...value, [selected]: "" })); pending.current.delete(selected); setFeedback("Ответ сохранён."); await detail.refreshAfterWrite(); }); }}><DmField label="Ответ оператору"><DmTextarea value={drafts[selected] ?? ""} disabled={busy} maxLength={20_000} onChange={event => setDrafts(value => ({ ...value, [selected]: event.target.value }))} /></DmField><DmButton type="submit" disabled={busy || !(drafts[selected] ?? "").trim()}>Отправить</DmButton></form> : null}
    </> : <LoadingState label="Загружаем обращение" /> : has("support.ticket.create") ? <form onSubmit={event => { event.preventDefault(); void run(async () => { const input = { subject: subject.trim(), description: description.trim(), category: "GENERAL", priority: "NORMAL" as const, links: [] }; const result = await api.createSupportTicket({ ...input, idempotencyKey: key("create", input) }); setSubject(""); setDescription(""); pending.current.delete("create"); setSelected(result.id); setFeedback("Обращение создано."); }); }}><h2>Новое обращение</h2><DmField label="Тема"><DmInput value={subject} disabled={busy} maxLength={200} onChange={event => setSubject(event.target.value)} /></DmField><DmField label="Описание"><DmTextarea value={description} disabled={busy} maxLength={10_000} onChange={event => setDescription(event.target.value)} /></DmField><DmButton type="submit" appearance="primary" disabled={busy || subject.trim().length < 4 || description.trim().length < 10}>Создать обращение</DmButton></form> : <p>Ваша роль позволяет только просматривать обращения.</p>}</div></div>
  </section>;
}
