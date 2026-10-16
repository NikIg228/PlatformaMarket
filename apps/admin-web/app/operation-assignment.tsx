"use client";
import { ActionFeedback } from "@marketplace/ui/action-feedback";
import { useEffect, useRef, useState } from "react";
import { MarketplaceApiError, type MarketplaceApiClient } from "@marketplace/api-client";
import type { OperationAssignment, OperationAssignmentResult, OperationHistory, OperationQueueType } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmSelect, DmTextarea } from "@marketplace/ui/controls";
import { ErrorState, LoadingState } from "@marketplace/ui/primitives";
import { errorMessage } from "@marketplace/ui/format";
import { priorityLabels, type QueueItem } from "./operation-queue";

export function OperationAssignmentContent({ api, type, item, defaultPriority, assignees, canManage, onBusyChange, onSaved }: { api: MarketplaceApiClient; type: OperationQueueType; item: QueueItem; defaultPriority: string; assignees: { id: string; displayName: string }[]; canManage: boolean; onBusyChange: (busy: boolean) => void; onSaved: (result: OperationAssignmentResult) => Promise<void> }) {
  const [priority, setPriority] = useState(item.assignment?.priority ?? defaultPriority);
  const [assigneeId, setAssigneeId] = useState(item.assignment?.assigneeId ?? "");
  const [dueAt, setDueAt] = useState(item.assignment?.dueAt ? localDate(item.assignment.dueAt) : "");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<OperationHistory | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [current, setCurrent] = useState(item.assignment);
  const [conflict, setConflict] = useState(false);
  const [reloaded, setReloaded] = useState(false);
  const pending = useRef<{ json: string; key: string } | null>(null);
  const locked = useRef(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const wasBusy = useRef(false);
  useEffect(() => {
    // Disabling the submitting fieldset can move focus to body. Restore a usable
    // control after completion, without taking focus from the dialog's close action.
    if (wasBusy.current && !busy && (document.activeElement === document.body || document.activeElement?.matches(":disabled"))) reasonRef.current?.focus();
    wasBusy.current = busy;
  }, [busy]);
  useEffect(() => { let active = true; setHistory(null); setHistoryError(""); void api.operationHistory(type, item.id).then(value => { if (active) setHistory(value); }, cause => { if (active) setHistoryError(errorMessage(cause)); }); return () => { active = false; }; }, [api, type, item.id, revision]);
  const save = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); onBusyChange(true); setError(""); setFeedback("");
    try {
      const input = { expectedVersion: current?.version ?? 0, priority: priority as OperationAssignment["priority"], assigneeId: assigneeId || null, dueAt: dueAt ? new Date(dueAt).toISOString() : null, reason: reason.trim() };
      const json = JSON.stringify(input); if (pending.current?.json !== json) pending.current = { json, key: crypto.randomUUID() };
      const result = await api.assignOperation(type, item.id, { ...input, idempotencyKey: pending.current.key });
      setCurrent(result); await onSaved(result); setReason(""); setFeedback("Назначение сохранено."); setConflict(false); setReloaded(false); setRevision(value => value + 1);
    } catch (cause) { setError(errorMessage(cause)); setConflict(cause instanceof MarketplaceApiError && cause.status === 409); }
    finally { locked.current = false; setBusy(false); onBusyChange(false); }
  };
  const refreshVersion = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); onBusyChange(true);
    try {
      const queue = await api.operationWorkQueue({ q: item.id, kind: type, limit: 100 });
      const latest = queue.items.find(value => value.id === item.id && value.queueType === type);
      if (!latest) throw new Error("Случай больше не находится в очереди. Проверьте исходный объект.");
      setCurrent(latest.assignment); pending.current = null; setConflict(false); setError(""); setReloaded(true);
      setFeedback("Актуальная версия загружена. Ваш ввод сохранён; сравните его с текущим назначением перед сохранением.");
      setRevision(value => value + 1);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { locked.current = false; setBusy(false); onBusyChange(false); }
  };
  return <>
    <p>{item.reason}</p>{error ? <ActionFeedback tone="error" description={`${error} Ввод сохранён.`} /> : null}{feedback ? <ActionFeedback tone="success" description={feedback} /> : null}
    {conflict ? <DmButton disabled={busy} onClick={() => void refreshVersion()}>Загрузить актуальное назначение</DmButton> : null}
    {reloaded ? <p>Текущее назначение (версия {current?.version ?? 0}): {current?.assigneeName ?? "Не назначен"} · {priorityLabels[current?.priority ?? defaultPriority]} · Срок: {current?.dueAt ? new Date(current.dueAt).toLocaleString("ru-KZ") : "Не задан"}</p> : null}
    <form className="mp-stack" onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy || !canManage} style={{ border: 0, padding: 0 }}>
      <DmField label="Приоритет"><DmSelect value={priority} onChange={event => setPriority(event.target.value)}>{Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DmSelect></DmField>
      <DmField label="Ответственный"><DmSelect value={assigneeId} onChange={event => setAssigneeId(event.target.value)}><option value="">Не назначен</option>{assignees.map(member => <option key={member.id} value={member.id}>{member.displayName}</option>)}</DmSelect></DmField>
      <DmField label="Срок (местное время)"><DmInput type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></DmField>
      <DmField label="Причина изменения (не менее 10 символов)"><DmTextarea ref={reasonRef} value={reason} maxLength={1_000} onChange={event => setReason(event.target.value)} /></DmField>
      <DmButton type="submit" appearance="primary" disabled={reason.trim().length < 10}>Сохранить назначение</DmButton>
    </fieldset></form>
    {!canManage ? <p>Для назначения требуется право управления обращениями.</p> : null}
    <h3>История назначений: последние 30 изменений</h3>{historyError ? <ErrorState description={historyError} action={<DmButton onClick={() => setRevision(value => value + 1)}>Повторить загрузку истории</DmButton>} /> : history === null ? <LoadingState label="Загружаем историю" /> : history.length === 0 ? <p>Назначение ещё не менялось.</p> : <ol>{history.map(event => { const after = event.after as { reason?: string; priority?: string; assigneeId?: string | null; dueAt?: string | null }; return <li key={event.id}><strong>{assignees.find(member => member.id === event.actorId)?.displayName ?? "Оператор"}</strong> · {new Date(event.createdAt).toLocaleString("ru-KZ")}<p>{after?.reason ?? event.action}</p>{after?.priority ? <p>Приоритет: {priorityLabels[after.priority] ?? after.priority}</p> : null}<p>Ответственный: {after?.assigneeId ? assignees.find(member => member.id === after.assigneeId)?.displayName ?? "Другой сотрудник" : "Не назначен"} · Срок: {after?.dueAt ? new Date(after.dueAt).toLocaleString("ru-KZ") : "Не задан"}</p></li>; })}</ol>}
  </>;
}
export function localDate(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
