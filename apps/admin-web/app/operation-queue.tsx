"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentType } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { OperationWorkQueue, OperationQueueItem } from "@marketplace/schemas";
import { DmButton, DmSurface } from "@marketplace/ui/actions";
import { DmDialog, EmptyState, ErrorState, LoadingState, StatusTag } from "@marketplace/ui/primitives";
import { errorMessage, formatDate } from "@marketplace/ui/format";
import { adminApiContext } from "./admin-auth";
import { adminSectionQuery, parseAdminQuery, serializeAdminQuery } from "@marketplace/schemas/product-navigation";
import { useAdminQuery } from "./use-admin-query";
import { OperationQueueFilters } from "./operation-queue-filters";
import styles from "./operation-queue.module.css";

export const queueLabels: Record<string, string> = { ORGANIZATION_REVIEW: "Допуск поставщиков", PROMOTION_REVIEW: "Модерация акций", CATALOG_REVIEW: "Карточки на проверке", COMPLIANCE_REVIEW: "Проверка документов", INTEGRATION_RECONCILIATION: "Расхождения в данных", IMPORT_ATTENTION: "Загрузки требуют проверки", AGREEMENT_SIGNATURE: "Договоры ждут подписи", SUPPLIER_CONFIRMATION: "Подтверждение заказов", STALE_INVENTORY: "Устаревшие остатки", DOCUMENT_EXCEPTION: "Документальные расхождения" };
export const priorityLabels: Record<string, string> = { CRITICAL: "Критический", HIGH: "Высокий", NORMAL: "Обычный", LOW: "Низкий" };
export type QueueItem = OperationQueueItem;
export const queueItemLabel = (item: QueueItem) => item.title;

export function OperationQueue() {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const openerRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [data, setData] = useState<OperationWorkQueue | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<{ id: string; displayName: string }[]>([]);
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const { state, write } = useAdminQuery();
  const { queueKind, queueOffset: offset, queueQ, queuePriority, queueAssignment, queueDue, queueSort } = state;
  const request = useRef(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const serial = ++request.current;
    setBusy(true); setError("");
    try { const [queue, members, rights] = await Promise.all([api.operationWorkQueue({ offset, q: queueQ, kind: queueKind, priority: queuePriority || undefined, assignment: queueAssignment, due: queueDue, sort: queueSort, limit: 50 }), api.operationAssignees(), api.get<string[]>("/access-control/permissions")]); if (serial !== request.current) return; setData(queue); setAssignees(members); setPermissions(rights); }
    catch (cause) { if (serial === request.current) { setError(errorMessage(cause)); setData(null); } }
    finally { if (serial === request.current) setBusy(false); }
  }, [api, offset, queueQ, queueKind, queuePriority, queueAssignment, queueDue, queueSort]);
  useEffect(() => { setData(null); setSelected(null); void load(); return () => { request.current += 1; }; }, [load]);
  const objectHref = (href: string) => {
    const url = new URL(href, window.location.origin);
    const destination = parseAdminQuery(url.search);
    return destination ? window.location.pathname + serializeAdminQuery({ ...adminSectionQuery(state, destination.section), queueType: destination.queueType, object: destination.object, orderId: destination.orderId }) : href;
  };
  return <DmSurface variant="section" className={styles.panel} role="region" aria-label="Операционная очередь" aria-busy={busy}>
    <div className={styles.header}><div><h2 ref={headingRef} tabIndex={-1} className={styles.title}>Операционная очередь</h2><p className={styles.subtitle}>Причина случая, ответственный, срок и история назначений.</p></div><DmButton disabled={busy} onClick={() => void load()}>Обновить очередь</DmButton></div>
    <OperationQueueFilters state={state} write={write} />
    {error ? <ErrorState title="Очередь недоступна" description={error} action={<DmButton onClick={() => void load()}>Повторить загрузку очереди</DmButton>} /> : null}
    {busy && !data ? <LoadingState label="Загружаем очередь" /> : null}
    {data ? <p role="status" className={styles.summary}>Найдено случаев: {data.total} · Всего открыто: {data.totalOpenItems}</p> : null}
    {data && !data.items.length ? <EmptyState title={data.total ? "На этой странице нет случаев" : "Случаи не найдены"} description="Измените фильтры или вернитесь к началу списка." action={offset ? <DmButton onClick={() => write({ ...state, queueOffset: 0 })}>К первой странице</DmButton> : undefined} /> : null}
    <div className={styles.items}>{data?.items.map(item => <DmSurface variant="card" className={styles.item} key={item.caseKey}>
      <div className={styles.details}><h3>{queueLabels[item.queueType]} · {queueItemLabel(item)}</h3><p>{item.organizations.map(org => org.name).join(" · ")}</p><p>{item.reason}</p>
        <div className={styles.tags}><StatusTag tone={item.priority === "CRITICAL" ? "danger" : item.priority === "HIGH" ? "warning" : "neutral"}>{priorityLabels[item.priority]}</StatusTag>{item.isOverdue ? <StatusTag tone="danger">Просрочено</StatusTag> : null}</div>
        <p>Ответственный: {item.assignment?.assigneeName ?? "Не назначен"} · Срок: {item.dueAt ? new Date(item.dueAt).toLocaleString("ru-KZ") : "Не задан"}</p>
        <p>Обновлено: <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time></p>{item.assignment?.reason ? <p>Последнее назначение: {item.assignment.reason}</p> : null}</div>
      <div className={styles.actions}><DmButton onClick={event => { openerRef.current = event.currentTarget; setSelected(item); }}>Назначение и история</DmButton><DmButton as="a" href={objectHref(item.href)} onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; const next = parseAdminQuery(new URL(event.currentTarget.href).search); if (next) { event.preventDefault(); write(next); } }}>Открыть объект</DmButton></div>
    </DmSurface>)}</div>
    {data ? <div className={styles.pagination}><DmButton disabled={!offset || busy} onClick={() => write({ ...state, queueOffset: Math.max(0, offset - 50) })}>Предыдущие</DmButton><span>{data.items.length ? `Случаи ${offset + 1}–${offset + data.items.length} из ${data.total}` : `Всего по фильтру: ${data.total}`}</span><DmButton disabled={busy || offset >= 100000 || !data.hasMore} onClick={() => write({ ...state, queueOffset: offset + 50 })}>Следующие</DmButton></div> : null}
    {selected ? <OperationAssignmentPanel key={selected.caseKey} api={api} type={selected.queueType} item={selected} defaultPriority={selected.priority} assignees={assignees} canManage={permissions.includes("support.ticket.manage") && (selected.queueType !== "DOCUMENT_EXCEPTION" || permissions.includes("order.confirm"))} onClose={() => { (openerRef.current?.isConnected ? openerRef.current : headingRef.current)?.focus(); setSelected(null); }} onSaved={async assignment => { setSelected(value => value ? { ...value, assignment } : null); await load(); }} /> : null}
  </DmSurface>;
}

type AssignmentContentProps = ComponentProps<typeof import("./operation-assignment").OperationAssignmentContent>;
type AssignmentProps = Omit<AssignmentContentProps, "onBusyChange"> & { onClose: () => void };
function OperationAssignmentPanel(props: AssignmentProps) {
  const [Panel, setPanel] = useState<ComponentType<AssignmentContentProps> | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setFailed(false);
    void import("./operation-assignment").then(module => {
      if (active) setPanel(() => module.OperationAssignmentContent);
    }, () => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [revision, open]);
  // Keep the same modal and focus trap while its lazy content loads.
  return <DmDialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }} onClosed={props.onClose}
    title={Panel ? `Задача: ${queueItemLabel(props.item)}` : "Назначение задачи"} actions={<DmButton disabled={busy} onClick={() => setOpen(false)}>Закрыть</DmButton>}>
    {Panel ? <Panel {...props} onBusyChange={setBusy} /> : failed ? <ErrorState description="Не удалось открыть назначение." action={<DmButton onClick={() => setRevision(value => value + 1)}>Повторить открытие</DmButton>} />
      : <LoadingState label="Открываем назначение" />}
  </DmDialog>;
}
