"use client";
import { ActionFeedback } from "@marketplace/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { OperationHistory, SupportTicketDetail, UpdateSupportTicketInput } from "@marketplace/schemas";
import { DmButton, DmCheckbox, DmDialog, DmField, DmInput, DmSelect, DmTextarea, LoadingState, SupportAttachmentList, errorMessage } from "@marketplace/ui";
import { ticketStatuses } from "./support-operations";
import { localDate } from "./operation-assignment";

export function SupportTicketPanel({ id, api, assignees, canManage, canWrite, onClose, onChanged, onConversation }: { id: string; api: MarketplaceApiClient; assignees: { id: string; displayName: string }[]; canManage: boolean; canWrite: boolean; onClose: () => void; onChanged: () => Promise<void>; onConversation: (id: string) => void }) {
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [history, setHistory] = useState<OperationHistory>([]);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const destination = useRef<string | undefined>(undefined);
  const [status, setStatus] = useState("OPEN");
  const [priority, setPriority] = useState("NORMAL");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [reason, setReason] = useState("");
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const lock = useRef(false);
  const pending = useRef(new Map<string, { json: string; key: string }>());
  const load = useCallback(async (initialize = false) => {
    const [result, events] = await Promise.all([api.supportTicket(id), canManage ? api.supportTicketHistory(id) : Promise.resolve([])]);
    setTicket(result); setHistory(events);
    if (initialize) { setStatus(result.status); setPriority(result.priority); setAssigneeId(result.assigneeId ?? ""); setDueAt(result.slaDueAt ? localDate(result.slaDueAt) : ""); }
  }, [api, id, canManage]);
  useEffect(() => { void load(true).catch(cause => setError(errorMessage(cause))); }, [load]);
  const key = (action: string, input: unknown) => { const json = JSON.stringify(input); let current = pending.current.get(action); if (!current || current.json !== json) { current = { json, key: crypto.randomUUID() }; pending.current.set(action, current); } return current.key; };
  const run = async (action: () => Promise<void>, refreshAfter = true) => { if (lock.current) return; lock.current = true; setBusy(true); setError(""); setFeedback(""); try { await action(); if (refreshAfter) { await load(); await onChanged(); } } catch (cause) { setError(errorMessage(cause)); } finally { lock.current = false; setBusy(false); } };
  return <DmDialog open={open} title={ticket ? `${ticket.number} · ${ticket.subject}` : "Обращение"} onOpenChange={value => { if (!value && !busy) setOpen(false); }} onClosed={() => { if (destination.current) onConversation(destination.current); else onClose(); }} actions={<DmButton disabled={busy} onClick={() => setOpen(false)}>Закрыть</DmButton>}>
    {error ? <ActionFeedback tone="error" description={`${error} Ввод сохранён.`} action={<DmButton disabled={busy} onClick={() => void load().catch(cause => setError(errorMessage(cause)))}>Обновить обращение</DmButton>} /> : null}{feedback ? <ActionFeedback tone="success" description={feedback} /> : null}
    {!ticket ? <LoadingState label="Загружаем обращение" /> : <>
      <p>{ticket.description}</p>{ticket.links.filter(link => link.entityType === "BusinessConversation").map(link => <DmButton key={link.id} disabled={busy} onClick={() => { destination.current = link.entityId; setOpen(false); }}>Открыть связанный диалог</DmButton>)}
      {canManage ? <form className="mp-stack" onSubmit={event => { event.preventDefault(); void run(async () => { const input = { expectedVersion: ticket.version, status: status as UpdateSupportTicketInput["status"], priority: priority as UpdateSupportTicketInput["priority"], assigneeId: assigneeId || null, slaDueAt: dueAt ? new Date(dueAt).toISOString() : null, reason: reason.trim() }; await api.updateSupportTicket(id, { ...input, idempotencyKey: key("update", input) }); setReason(""); setFeedback("Изменение обращения сохранено."); }); }}>
        <fieldset disabled={busy} style={{ border: 0, padding: 0 }}><DmField label="Статус"><DmSelect value={status} onChange={event => setStatus(event.target.value)}>{Object.entries(ticketStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DmSelect></DmField>
          <DmField label="Приоритет"><DmSelect value={priority} onChange={event => setPriority(event.target.value)}><option value="LOW">Низкий</option><option value="NORMAL">Обычный</option><option value="HIGH">Высокий</option><option value="URGENT">Срочный</option></DmSelect></DmField>
          <DmField label="Ответственный"><DmSelect value={assigneeId} onChange={event => setAssigneeId(event.target.value)}><option value="">Не назначен</option>{assignees.map(member => <option key={member.id} value={member.id}>{member.displayName}</option>)}</DmSelect></DmField>
          <DmField label="Срок (местное время)"><DmInput type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></DmField>
          <DmField label="Причина изменения"><DmTextarea value={reason} maxLength={1_000} onChange={event => setReason(event.target.value)} /></DmField><DmButton type="submit" disabled={reason.trim().length < 10}>Сохранить решение</DmButton>
        </fieldset></form> : null}
      <h3>Сообщения обращения</h3>{ticket.hasOlder ? <DmButton disabled={busy} onClick={() => void run(async () => { const older = await api.supportTicket(id, ticket.messages[0].id); setTicket(value => value ? { ...value, hasOlder: older.hasOlder, messages: [...older.messages, ...value.messages] } : value); }, false)}>Ранние сообщения</DmButton> : null}
      <ol>{ticket.messages.map(message => <li key={message.id}><strong>{assignees.find(member => member.id === message.authorId)?.displayName ?? "Участник"}{message.isInternal ? " · Внутренняя заметка" : ""}</strong><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.body}</p><SupportAttachmentList api={api} ticketId={id} messageId={message.id} files={message.attachments} /><small>{new Date(message.createdAt).toLocaleString("ru-KZ")}</small></li>)}</ol>
      {canWrite ? <form onSubmit={event => { event.preventDefault(); void run(async () => { const input = { body: body.trim(), isInternal: internal, attachments: [] }; await api.addSupportMessage(id, { ...input, idempotencyKey: key("message", input) }); setBody(""); pending.current.delete("message"); setFeedback("Ответ сохранён."); }); }}><DmField label="Ответ"><DmTextarea value={body} disabled={busy} maxLength={20_000} onChange={event => setBody(event.target.value)} /></DmField><DmCheckbox label="Внутренняя заметка оператора" checked={internal} disabled={busy} onChange={(_, data) => setInternal(data.checked === true)} /><DmButton type="submit" disabled={busy || !body.trim()}>Отправить ответ</DmButton></form> : null}
      {canManage ? <><h3>История решений (последние 30)</h3><ol>{history.map(event => <li key={event.id}>{new Date(event.createdAt).toLocaleString("ru-KZ")} · {assignees.find(member => member.id === event.actorId)?.displayName ?? "Участник"}<p>{(event.after as { reason?: string } | null)?.reason ?? event.action}</p></li>)}</ol></> : null}
    </>}
  </DmDialog>;
}
