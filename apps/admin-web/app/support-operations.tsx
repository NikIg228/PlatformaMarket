"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { SupportTicketSummary } from "@marketplace/schemas";
import { ConversationWorkspace, DmButton, DmField, DmSelect, EmptyState, LoadingState, errorMessage } from "@marketplace/ui";
import { adminApiContext, readAdminSession } from "./admin-auth";
import { SupportTicketPanel } from "./support-ticket-panel";

export const ticketStatuses: Record<string, string> = { OPEN: "Новое", IN_PROGRESS: "В работе", WAITING_CUSTOMER: "Ждём ответа", RESOLVED: "Решено", CLOSED: "Закрыто" };
export function SupportOperations() {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const sectionRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [tickets, setTickets] = useState<SupportTicketSummary[] | null>(null);
  const [selected, setSelected] = useState<string>();
  const [conversationId, setConversationId] = useState<string>();
  const [mode, setMode] = useState("tickets");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<{ id: string; displayName: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const session = readAdminSession();
  const organizationId = session?.activeOrganizationId ?? session?.organizationId ?? adminApiContext().organizationId;
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { const [rows, members, rights] = await Promise.all([api.supportTickets(status || undefined, offset), api.operationAssignees(), api.get<string[]>("/access-control/permissions")]); setTickets(rows); setAssignees(members); setPermissions(rights); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }, [api, status, offset]);
  useEffect(() => { void load(); }, [load]);
  return <section ref={sectionRef} tabIndex={-1} className="mp-stack" aria-label="Обращения и диалоги"><h2>Обращения и споры</h2>
    <p>Решения по заказу, возврату и оплате выполняются в профильных операциях. Ответ в обращении не меняет коммерческие условия.</p>
    <div className="dm-conversations-toolbar"><DmButton aria-pressed={mode === "tickets"} onClick={() => setMode("tickets")}>Обращения</DmButton><DmButton aria-pressed={mode === "conversations"} onClick={() => { setConversationId(undefined); setMode("conversations"); }}>Диалоги с оператором</DmButton></div>
    {error ? <p role="alert">{error} <DmButton onClick={() => void load()}>Повторить</DmButton></p> : null}
    {mode === "conversations" && organizationId ? <ConversationWorkspace key={conversationId ?? "all"} api={api} organizationId={organizationId} operator initialId={conversationId} canWrite={permissions.includes("support.ticket.create") && permissions.includes("support.ticket.manage")} /> : mode === "tickets" ? <>
      <DmField label="Статус обращения"><DmSelect value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}><option value="">Все статусы</option>{Object.entries(ticketStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DmSelect></DmField>
      {tickets === null && busy ? <LoadingState label="Загружаем обращения" /> : tickets?.length === 0 ? <EmptyState title="Обращений нет" description="Новые обращения появятся после запроса участника." /> : null}
      <div className="mp-stack">{tickets?.map(ticket => <article key={ticket.id} style={{ padding: 16, border: "1px solid var(--dm-border)", borderRadius: 8 }}><h3>{ticket.number} · {ticket.subject}</h3><p>{ticketStatuses[ticket.status]} · {ticket.priority === "URGENT" ? "Срочный" : ticket.priority === "HIGH" ? "Высокий" : ticket.priority === "LOW" ? "Низкий" : "Обычный"}</p><p>Ответственный: {assignees.find(member => member.id === ticket.assigneeId)?.displayName ?? "Не назначен"} · Срок: {ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString("ru-KZ") : "Не задан"}</p><DmButton onClick={event => { openerRef.current = event.currentTarget; setSelected(ticket.id); }}>Открыть обращение</DmButton></article>)}</div>
      <div className="dm-conversations-toolbar"><DmButton disabled={busy || !offset} onClick={() => setOffset(value => Math.max(0, value - 50))}>Назад</DmButton><DmButton disabled={busy} onClick={() => void load()}>Обновить</DmButton><DmButton disabled={busy || tickets?.length !== 50} onClick={() => setOffset(value => value + 50)}>Далее</DmButton></div>
      {selected ? <SupportTicketPanel key={selected} id={selected} api={api} assignees={assignees} canManage={permissions.includes("support.ticket.manage")} canWrite={permissions.includes("support.ticket.create")} onClose={() => { openerRef.current?.focus(); setSelected(undefined); }} onChanged={load} onConversation={id => { sectionRef.current?.focus(); setSelected(undefined); setConversationId(id); setMode("conversations"); }} /> : null}
    </> : null}
  </section>;
}
