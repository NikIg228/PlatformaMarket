"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { OperationWorkQueue } from "@marketplace/schemas";
import { DmButton, DmSelect, EmptyState, ErrorState, LoadingState, StatusTag, errorMessage } from "@marketplace/ui";
import { adminApiContext } from "./admin-auth";
import { OperationAssignmentPanel } from "./operation-assignment";
import styles from "./operation-queue.module.css";

export const queueLabels: Record<string, string> = { ORGANIZATION_REVIEW: "Допуск поставщиков", PROMOTION_REVIEW: "Модерация акций", CATALOG_REVIEW: "Карточки на проверке", COMPLIANCE_REVIEW: "Проверка документов", INTEGRATION_RECONCILIATION: "Расхождения в данных", IMPORT_ATTENTION: "Загрузки требуют проверки", AGREEMENT_SIGNATURE: "Договоры ждут подписи", SUPPLIER_CONFIRMATION: "Подтверждение заказов", STALE_INVENTORY: "Устаревшие остатки" };
export const priorityLabels: Record<string, string> = { CRITICAL: "Критический", HIGH: "Высокий", NORMAL: "Обычный", LOW: "Низкий" };
type QueueSection = OperationWorkQueue["sections"][number];
export type QueueItem = QueueSection["items"][number];
export const queueItemLabel = (item: QueueItem) => item.proposedName ?? item.orderNumber ?? item.agreementNumber ?? item.fileName ?? (typeof item.externalRef === "string" ? item.externalRef : item.id);

export function OperationQueue() {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const openerRef = useRef<HTMLElement | null>(null);
  const [data, setData] = useState<OperationWorkQueue | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<{ id: string; displayName: string }[]>([]);
  const [selected, setSelected] = useState<{ section: QueueSection; item: QueueItem } | null>(null);
  const [kind, setKind] = useState("ALL");
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true); setError("");
    try { const [queue, members, rights] = await Promise.all([api.operationWorkQueue(offset), api.operationAssignees(), api.get<string[]>("/access-control/permissions")]); setData(queue); setAssignees(members); setPermissions(rights); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }, [api, offset]);
  useEffect(() => { void load(); }, [load]);
  return <section className={styles.panel} aria-label="Операционная очередь">
    <div className={styles.header}><div><h2 className={styles.title}>Операционная очередь</h2><p className={styles.subtitle}>Причина задачи, ответственный, срок и история решений.</p></div><div className={styles.total}><strong>{data?.totalOpenItems ?? "—"}</strong><span>задач в выборке</span></div><DmButton disabled={busy} onClick={() => void load()}>Обновить</DmButton></div>
    {error ? <ErrorState description={error} action={<DmButton onClick={() => void load()}>Повторить</DmButton>} /> : null}
    {busy && !data ? <LoadingState label="Загружаем очередь" /> : null}
    <label>Раздел очереди<DmSelect value={kind} onChange={event => setKind(event.target.value)}><option value="ALL">Все разделы</option>{Object.entries(queueLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</DmSelect></label>
    {data && !data.totalOpenItems ? <EmptyState title="Нет задач в этой выборке" description="Проверьте предыдущую страницу или обновите очередь." /> : null}
    <div className={styles.items}>{data?.sections.filter(section => kind === "ALL" || kind === section.type).flatMap(section => section.items.map(item => <article className={styles.item} key={`${section.type}:${item.id}`}>
      <div><strong>{queueLabels[section.type]} · {queueItemLabel(item)}</strong><p>{item.reason}</p><StatusTag tone={(item.assignment?.priority ?? section.priority) === "CRITICAL" ? "danger" : "warning"}>{priorityLabels[item.assignment?.priority ?? section.priority]}</StatusTag><p>Ответственный: {item.assignment?.assigneeName ?? "Не назначен"} · Срок: {item.assignment?.dueAt ? new Date(item.assignment.dueAt).toLocaleString("ru-KZ") : "Не задан"}</p>{item.assignment?.reason ? <p>Последнее решение: {item.assignment.reason}</p> : null}</div>
      <DmButton onClick={event => { openerRef.current = event.currentTarget; setSelected({ section, item }); }}>Назначение и история</DmButton><DmButton as="a" href={item.href}>Открыть объект</DmButton>
    </article>))}</div>
    <div className="dm-conversations-toolbar"><DmButton disabled={!offset || busy} onClick={() => setOffset(value => Math.max(0, value - 50))}>Предыдущие</DmButton><span>Выборка {offset + 1}–{offset + 50} в каждом разделе</span><DmButton disabled={busy || !data?.sections.some(section => section.hasMore)} onClick={() => setOffset(value => value + 50)}>Следующие</DmButton></div>
    {selected ? <OperationAssignmentPanel key={`${selected.section.type}:${selected.item.id}`} api={api} type={selected.section.type} item={selected.item} defaultPriority={selected.section.priority} assignees={assignees} canManage={permissions.includes("support.ticket.manage")} onClose={() => { openerRef.current?.focus(); setSelected(null); }} onSaved={async assignment => { setSelected(value => value ? { ...value, item: { ...value.item, assignment } } : null); await load(); }} /> : null}
  </section>;
}
