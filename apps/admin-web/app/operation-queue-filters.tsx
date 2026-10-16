"use client";
import { useEffect, useState } from "react";
import { type AdminQuery } from "@marketplace/schemas/product-navigation";
import { DmButton, DmSurface } from "@marketplace/ui/actions";
import { DmField, DmInput } from "@marketplace/ui/controls";
import { DmSelect } from "@marketplace/ui/native-select";
import { queueLabels, priorityLabels } from "./operation-queue";
import styles from "./operation-queue.module.css";

export function OperationQueueFilters({ state, write }: { state: AdminQuery; write: (state: AdminQuery) => void }) {
  const [q, setQ] = useState(state.queueQ);
  useEffect(() => setQ(state.queueQ), [state.queueQ]);
  const invalid = /[\u0000-\u001f\u007f]/.test(q);
  const update = (values: Partial<AdminQuery>) => write({ ...state, ...values, queueOffset: 0 });
  const filtered = state.queueQ || state.queueKind !== "ALL" || state.queuePriority || state.queueAssignment !== "ALL" || state.queueDue !== "ALL" || state.queueSort !== "queue";
  return <DmSurface variant="filters"><form className={styles.filters} onSubmit={event => { event.preventDefault(); if (!invalid) update({ queueQ: q.trim() }); }}>
    <DmField label="Случай или организация" validationState={invalid ? "error" : "none"} validationMessage={invalid ? "Удалите управляющие символы из поиска." : undefined}><DmInput value={q} maxLength={200} onChange={(_, data) => setQ(data.value)} /></DmField>
    <DmField label="Раздел очереди"><DmSelect value={state.queueKind} onChange={event => update({ queueKind: event.target.value as AdminQuery["queueKind"] })}><option value="ALL">Все разделы</option>{Object.entries(queueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DmSelect></DmField>
    <DmField label="Приоритет случаев"><DmSelect value={state.queuePriority} onChange={event => update({ queuePriority: event.target.value as AdminQuery["queuePriority"] })}><option value="">Все приоритеты</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</DmSelect></DmField>
    <DmField label="Назначение"><DmSelect value={state.queueAssignment} onChange={event => update({ queueAssignment: event.target.value as AdminQuery["queueAssignment"] })}><option value="ALL">Все случаи</option><option value="MINE">Назначены мне</option><option value="UNASSIGNED">Не назначены</option><option value="ASSIGNED">Назначены сотруднику</option></DmSelect></DmField>
    <DmField label="Срок случаев"><DmSelect value={state.queueDue} onChange={event => update({ queueDue: event.target.value as AdminQuery["queueDue"] })}><option value="ALL">Все сроки</option><option value="OVERDUE">Просроченные</option><option value="SCHEDULED">Срок задан</option><option value="UNSCHEDULED">Срок не задан</option></DmSelect></DmField>
    <DmField label="Порядок случаев"><DmSelect value={state.queueSort} onChange={event => update({ queueSort: event.target.value as AdminQuery["queueSort"] })}><option value="queue">Приоритет, срок, возраст</option><option value="oldest">Сначала старые</option><option value="recent">Недавно обновлённые</option></DmSelect></DmField>
    <div className={styles.actions}><DmButton type="submit" disabled={invalid}>Найти случаи</DmButton>{filtered ? <DmButton onClick={() => { setQ(""); update({ queueQ: "", queueKind: "ALL", queuePriority: "", queueAssignment: "ALL", queueDue: "ALL", queueSort: "queue" }); }}>Сбросить фильтры очереди</DmButton> : null}</div>
  </form></DmSurface>;
}
