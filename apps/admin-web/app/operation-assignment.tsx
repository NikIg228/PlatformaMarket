"use client";
import { ActionFeedback } from "@marketplace/ui/action-feedback";
import { useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import type { OperationAssignment, OperationAssignmentResult, OperationHistory, OperationQueueType } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmSelect, DmTextarea } from "@marketplace/ui/controls";
import { LoadingState } from "@marketplace/ui/primitives";
import { errorMessage } from "@marketplace/ui/format";
import { priorityLabels, type QueueItem } from "./operation-queue";

export function OperationAssignmentContent({ api, type, item, defaultPriority, assignees, canManage, onBusyChange, onSaved }: { api: MarketplaceApiClient; type: OperationQueueType; item: QueueItem; defaultPriority: string; assignees: { id: string; displayName: string }[]; canManage: boolean; onBusyChange: (busy: boolean) => void; onSaved: (result: OperationAssignmentResult) => Promise<void> }) {
  const [priority, setPriority] = useState(item.assignment?.priority ?? defaultPriority);
  const [assigneeId, setAssigneeId] = useState(item.assignment?.assigneeId ?? "");
  const [dueAt, setDueAt] = useState(item.assignment?.dueAt ? localDate(item.assignment.dueAt) : "");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<OperationHistory | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const pending = useRef<{ json: string; key: string } | null>(null);
  const locked = useRef(false);
  useEffect(() => { let active = true; void api.operationHistory(type, item.id).then(value => { if (active) setHistory(value); }, cause => { if (active) setError(errorMessage(cause)); }); return () => { active = false; }; }, [api, type, item.id, revision]);
  const save = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); onBusyChange(true); setError(""); setFeedback("");
    try {
      const input = { expectedVersion: item.assignment?.version ?? 0, priority: priority as OperationAssignment["priority"], assigneeId: assigneeId || null, dueAt: dueAt ? new Date(dueAt).toISOString() : null, reason: reason.trim() };
      const json = JSON.stringify(input); if (pending.current?.json !== json) pending.current = { json, key: crypto.randomUUID() };
      const result = await api.assignOperation(type, item.id, { ...input, idempotencyKey: pending.current.key });
      await onSaved(result); setReason(""); setFeedback("Назначение сохранено."); setRevision(value => value + 1);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { locked.current = false; setBusy(false); onBusyChange(false); }
  };
  return <>
    <p>{item.reason}</p>{error ? <ActionFeedback tone="error" description={`${error} Ввод сохранён. При конфликте закройте окно и обновите очередь.`} /> : null}{feedback ? <ActionFeedback tone="success" description={feedback} /> : null}
    <form className="mp-stack" onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={busy || !canManage} style={{ border: 0, padding: 0 }}>
      <DmField label="Приоритет"><DmSelect value={priority} onChange={event => setPriority(event.target.value)}>{Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</DmSelect></DmField>
      <DmField label="Ответственный"><DmSelect value={assigneeId} onChange={event => setAssigneeId(event.target.value)}><option value="">Не назначен</option>{assignees.map(member => <option key={member.id} value={member.id}>{member.displayName}</option>)}</DmSelect></DmField>
      <DmField label="Срок (местное время)"><DmInput type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></DmField>
      <DmField label="Причина изменения (не менее 10 символов)"><DmTextarea value={reason} maxLength={1_000} onChange={event => setReason(event.target.value)} /></DmField>
      <DmButton type="submit" appearance="primary" disabled={reason.trim().length < 10}>Сохранить назначение</DmButton>
    </fieldset></form>
    {!canManage ? <p>Для назначения требуется право управления обращениями.</p> : null}
    <h3>Последние 30 изменений</h3>{history === null ? <LoadingState label="Загружаем историю" /> : history.length === 0 ? <p>Назначение ещё не менялось.</p> : <ol>{history.map(event => { const after = event.after as { reason?: string; priority?: string }; return <li key={event.id}><strong>{assignees.find(member => member.id === event.actorId)?.displayName ?? "Оператор"}</strong> · {new Date(event.createdAt).toLocaleString("ru-KZ")}<p>{after?.reason ?? event.action}</p>{after?.priority ? <p>Приоритет: {priorityLabels[after.priority] ?? after.priority}</p> : null}</li>; })}</ol>}
  </>;
}
export function localDate(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
