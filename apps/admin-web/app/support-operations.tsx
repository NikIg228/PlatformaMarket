"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { SupportTicketSummary } from "@marketplace/schemas";
import { DmAction, ActionFeedback, ConversationWorkspace, DmButton, DmField, DmInput, DmSelect, EmptyState, LoadingState, StatusTag, errorMessage } from "@marketplace/ui";
import { adminApiContext, readAdminSession } from "./admin-auth";
import { SupportTicketPanel } from "./support-ticket-panel";
import { useAdminQuery } from "./use-admin-query";
import styles from "./support-operations.module.css";

export const ticketStatuses: Record<string, string> = { OPEN: "Новое", IN_PROGRESS: "В работе", WAITING_CUSTOMER: "Ждём ответа", RESOLVED: "Решено", CLOSED: "Закрыто" };
const priorities: Record<string, string> = { URGENT: "Срочный", HIGH: "Высокий", NORMAL: "Обычный", LOW: "Низкий" };
export function SupportOperations() {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const sectionRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const request = useRef(0);
  const polling = useRef(false);
  const [tickets, setTickets] = useState<SupportTicketSummary[] | null>(null);
  const { state, write } = useAdminQuery();
  const { ticketId: selected, conversationId, supportMode: mode, supportStatus: status, supportQ: query, supportOffset: offset, supportSort: sort } = state;
  const [search, setSearch] = useState(query);
  const invalidSearch = /[\u0000-\u001f\u007f]/.test(search);
  useEffect(() => { setSearch(query); }, [query]);
  const [error, setError] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<{ id: string; displayName: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const session = readAdminSession();
  const organizationId = session?.activeOrganizationId ?? session?.organizationId ?? adminApiContext().organizationId;
  const load = useCallback(async (quiet = false) => {
    const serial = ++request.current;
    if (!quiet) setBusy(true);
    try {
      const [rows, members, rights] = await Promise.all([api.supportTickets(status || undefined, offset, { q: query, sort }), api.operationAssignees(), api.get<string[]>("/access-control/permissions")]);
      if (serial !== request.current) return;
      setTickets(rows); setAssignees(members); setPermissions(rights); setError("");
    } catch (cause) { if (serial === request.current) setError(errorMessage(cause)); }
    finally { if (serial === request.current) setBusy(false); }
  }, [api, status, offset, query, sort]);
  useEffect(() => { setTickets(null); setError(""); void load(); return () => { request.current += 1; }; }, [load]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || polling.current) return;
      polling.current = true; void load(true).finally(() => { polling.current = false; });
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  const selectTicket = (id?: string) => write({ ...state, section: "support", ticketId: id, conversationId: undefined, supportMode: "tickets" });
  const selectConversation = (id?: string) => write({ ...state, section: "support", ticketId: undefined, conversationId: id, supportMode: "conversations" });
  return <section ref={sectionRef} tabIndex={-1} className="mp-stack" aria-label="Обращения и диалоги">
    <div className={styles.toolbar}><div className="dm-conversations-toolbar"><DmAction variant="tab" aria-pressed={mode === "tickets"} onClick={() => { selectTicket(); }}>Обращения</DmAction><DmAction variant="tab" aria-pressed={mode === "conversations"} onClick={() => { selectConversation(); }}>Диалоги с оператором</DmAction></div></div>
    {error ? <ActionFeedback tone="error" description={`${error} Последние загруженные данные сохранены.`} action={<DmButton onClick={() => void load()}>Повторить</DmButton>} /> : null}
    {mode === "conversations" && organizationId ? <ConversationWorkspace hideHeading key="operator-conversations" controlledSelection listState={{ filter: state.conversationFilter, offset: state.conversationOffset, onChange: next => write({ ...state, conversationFilter: next.filter, conversationOffset: next.offset }) }} api={api} organizationId={organizationId} operator initialId={conversationId} onSelect={selectConversation} canWrite={permissions.includes("support.ticket.create") && permissions.includes("support.ticket.manage")} /> : mode === "tickets" ? <>
      <form className={styles.filters} onSubmit={event => { event.preventDefault(); if (!invalidSearch) write({ ...state, supportOffset: 0, supportQ: search.trim() }); }}>
        <DmField label="Поиск обращения" validationState={invalidSearch ? "error" : "none"} validationMessage={invalidSearch ? "Удалите управляющие символы из поискового запроса." : undefined}><DmInput value={search} maxLength={200} onChange={(_, data) => setSearch(data.value)} placeholder="Номер или тема" /></DmField>
        <DmField label="Статус обращения"><DmSelect value={status} onChange={event => { write({ ...state, supportStatus: event.target.value as typeof status, supportOffset: 0 }); }}><option value="">Все статусы</option>{Object.entries(ticketStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DmSelect></DmField>
        <DmField label="Порядок"><DmSelect value={sort} onChange={event => { write({ ...state, supportSort: event.target.value as typeof sort, supportOffset: 0 }); }}><option value="queue">По приоритету и сроку</option><option value="recent">Сначала обновлённые</option></DmSelect></DmField>
        <DmButton type="submit" disabled={busy || invalidSearch}>Найти</DmButton>
        {query ? <DmButton disabled={busy} onClick={() => { setSearch(""); write({ ...state, supportQ: "", supportOffset: 0 }); }}>Сбросить поиск</DmButton> : null}
      </form>
      {tickets === null && busy ? <LoadingState label="Загружаем обращения" /> : tickets?.length === 0 ? <EmptyState title="Обращений нет" description={query || status ? "Измените поиск или фильтр статуса." : "Новые обращения участников появятся здесь автоматически."} /> : null}
      {tickets?.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Обращение</th><th>Статус</th><th>Приоритет</th><th>Ответственный</th><th>Срок</th><th><span className="dm-sr-only">Действие</span></th></tr></thead><tbody>{tickets.map(ticket => <tr key={ticket.id}><td data-label="Обращение"><strong>{ticket.subject}</strong><small>{ticket.number}</small></td><td data-label="Статус"><StatusTag tone={ticket.status === "OPEN" ? "warning" : ticket.status === "RESOLVED" || ticket.status === "CLOSED" ? "success" : "neutral"}>{ticketStatuses[ticket.status]}</StatusTag></td><td data-label="Приоритет">{priorities[ticket.priority]}</td><td data-label="Ответственный">{assignees.find(member => member.id === ticket.assigneeId)?.displayName ?? "Не назначен"}</td><td data-label="Срок">{ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString("ru-KZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Не задан"}</td><td><DmButton onClick={event => { openerRef.current = event.currentTarget; selectTicket(ticket.id); }}>Открыть обращение</DmButton></td></tr>)}</tbody></table></div> : null}
      <div className={styles.toolbar}><span>{tickets?.length ? `${offset + 1}–${offset + tickets.length}` : ""}</span><div className="dm-conversations-toolbar"><DmButton disabled={busy || !offset} onClick={() => write({ ...state, supportOffset: Math.max(0, offset - 50) })}>Назад</DmButton><DmButton disabled={busy || tickets?.length !== 50 || offset >= 100000} onClick={() => write({ ...state, supportOffset: offset + 50 })}>Далее</DmButton></div></div>
    </> : null}
    {selected ? <SupportTicketPanel key={selected} id={selected} api={api} assignees={assignees} canManage={permissions.includes("support.ticket.manage")} canWrite={permissions.includes("support.ticket.create")} onClose={() => { (openerRef.current?.isConnected ? openerRef.current : sectionRef.current)?.focus(); selectTicket(); }} onChanged={() => load()} onConversation={id => { sectionRef.current?.focus(); selectConversation(id); }} /> : null}
  </section>;
}
