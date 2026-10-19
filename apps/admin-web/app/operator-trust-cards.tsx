"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient, MarketplaceApiError } from "@marketplace/api-client";
import { operatorTrustResolveSchema, type OperatorTrust, type OperatorTrustIncident } from "@marketplace/schemas";
import { DmButton, DmDialog, DmFeedback, DmField, DmSurface, DmTextarea, StatusTag } from "@marketplace/ui";
import { adminApiContext } from "./admin-auth";
import { formatAdminStatus } from "./admin-labels";
import { TrustEventList } from "./operator-trust-events";
import styles from "./operator-orders.module.css";

const time = (value: string | null) => value ? new Date(value).toLocaleString("ru-KZ", { timeZone: "Asia/Almaty" }) : "Не указан";
type Supplier = Extract<OperatorTrust["suppliers"], { status: "AVAILABLE" }>["data"]["items"][number];
const actions: Record<string, string> = { NONE: "Без ограничений", REQUIRE_CONFIRMATION: "Требуется подтверждение", DOWNRANK: "Понижение в выдаче", DISABLE_COMPARISON: "Исключение из сравнения", RESTRICT_SCOPE: "Ограничение области работы", HIDE_DISCOUNT: "Скидка скрыта", HOLD_FOR_REVIEW: "Приостановлено до проверки", FREEZE_CHANGE: "Изменение заморожено", HARD_BLOCK: "Жёсткая блокировка" };
const severity: Record<string, string> = { LOW: "Низкий", MEDIUM: "Средний", HIGH: "Высокий", CRITICAL: "Критический" };
const statuses: Record<string, string> = { OPEN: "Открыто", SOFT_ACTION_ACTIVE: "Действует ограничение", UNDER_APPEAL: "Оспаривается", HARD_BLOCKED: "Заблокировано", UPHELD: "Апелляция удовлетворена", PARTIALLY_UPHELD: "Апелляция удовлетворена частично" };
const status = (value: string) => statuses[value] ?? formatAdminStatus(value);

function Appeals({ items, total }: { items: OperatorTrustIncident["appeals"]; total: number }) {
  return <div className={styles.section}><h4>Апелляции: {total}</h4>{total > items.length ? <p>Показаны последние {items.length} из {total}. Это не полная история апелляций.</p> : null}
    {items.map(appeal => <DmSurface variant="card" key={appeal.id}><div className={styles.section}><p>{status(appeal.status)} · {time(appeal.createdAt)}</p><p>{appeal.reason}</p><p>Решение: {appeal.decision ?? "Ещё не принято"}{appeal.decidedAt ? ` · ${time(appeal.decidedAt)}` : ""}</p>{appeal.hasEvidence ? <p>К апелляции приложены материалы. Их произвольный формат пока не поддерживает безопасный просмотр в сводке.</p> : <p>Дополнительные материалы не приложены.</p>}</div></DmSurface>)}
  </div>;
}

export function TrustIncidentCard({ incident, canResolve, onResolved }: { incident: OperatorTrustIncident; canResolve: boolean; onResolved: () => Promise<void> }) {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const [open, setOpen] = useState(false), [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState(false);
  const [mustRefresh, setMustRefresh] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const reasonInput = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { setMustRefresh(false); if (incident.status !== "RESOLVED") setSuccess(false); }, [incident]);
  const unresolvedAppeal = incident.appeals.some(appeal => ["OPEN", "UNDER_REVIEW"].includes(appeal.status));
  async function resolve() {
    const input = operatorTrustResolveSchema.safeParse({ version: incident.version, resolution: reason });
    if (!input.success) { setError("Укажите результат проверки: от 5 до 2000 символов."); return; }
    setBusy(true); setError("");
    try { await api.resolveOperatorTrustIncident(incident.id, input.data); setOpen(false); setSuccess(true); await onResolved(); }
    catch (cause) {
      setMustRefresh(true);
      setError(cause instanceof MarketplaceApiError && cause.status === 409 ? "Инцидент изменился или есть апелляция без решения. Закройте окно и обновите Trust; введённая причина сохранена." : "Результат не подтверждён. Закройте окно и обновите Trust перед повтором; введённая причина сохранена.");
      if (cause instanceof MarketplaceApiError && [401, 403].includes(cause.status)) await onResolved();
      requestAnimationFrame(() => reasonInput.current?.focus());
    }
    finally { setBusy(false); }
  }
  return <DmSurface variant="card"><div className={styles.section}>
    <div className={styles.header}><h3>{incident.organizationName ?? (incident.organizationId ? "Название организации недоступно" : "Организация не указана")}</h3><StatusTag tone={incident.severity === "CRITICAL" || incident.severity === "HIGH" ? "danger" : "warning"}>{severity[incident.severity] ?? incident.severity}</StatusTag></div>
    <p>{status(incident.status)} · {time(incident.createdAt)} · {incident.id}</p><p>{incident.explanation}</p>
    <dl className={styles.details}>
      <div><dt>Объект</dt><dd>{incident.subjectType} · {incident.subjectId}</dd></div><div><dt>Основание</dt><dd>{incident.reasonCode}</dd></div>
      <div><dt>Ограничение</dt><dd>{actions[incident.actionType] ?? incident.actionType}</dd></div><div><dt>Срок ограничения</dt><dd>{time(incident.actionExpiresAt)}</dd></div>
      <div><dt>Что исправить</dt><dd>{incident.remediation}</dd></div><div><dt>Условие восстановления</dt><dd>{incident.restorationCondition}</dd></div>
      <div><dt>Указанный источник</dt><dd>{incident.sourceEntityType ?? "Не указан"} {incident.sourceEntityId ?? ""}</dd></div>
      {incident.hardBlockReason ? <div><dt>Причина блокировки</dt><dd>{incident.hardBlockReason}</dd></div> : null}
    </dl>
    {incident.resolution ? <p>Результат проверки: {incident.resolution}</p> : null}
    <Appeals items={incident.appeals} total={incident.appealCount} />
    {success ? <DmFeedback presentation="inline" tone="success" title="Восстановление подтверждено" description="Решение и причина сохранены в журнале." /> : null}
    {incident.status !== "RESOLVED" && !success ? <DmButton ref={trigger} disabled={!canResolve || unresolvedAppeal} onClick={() => setOpen(true)}>Подтвердить восстановление</DmButton> : null}
    {unresolvedAppeal ? <p>Сначала требуется решение по открытой апелляции.</p> : null}
    <DmDialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }} onClosed={() => trigger.current?.focus()} title="Подтверждение восстановления" actions={<><DmButton disabled={busy} onClick={() => setOpen(false)}>Отмена</DmButton><DmButton appearance="primary" disabled={busy || !canResolve || mustRefresh} onClick={() => void resolve()}>{busy ? "Сохраняем…" : "Закрыть инцидент"}</DmButton></>}>
      <div className={styles.section}><p>Инцидент будет закрыт, ограничение снято. Подтвердите выполнение условия: {incident.restorationCondition}</p><DmField label="Результат проверки"><DmTextarea ref={reasonInput} value={reason} maxLength={2000} onChange={(_, value) => setReason(value.value)} /></DmField>{error ? <p role="alert">{error}</p> : null}</div>
    </DmDialog>
  </div></DmSurface>;
}

export function TrustSupplierCard({ supplier }: { supplier: Supplier }) {
  const [events, setEvents] = useState(false);
  return <DmSurface variant="card"><div className={styles.section}><h3>{supplier.name}</h3>
    {supplier.snapshot ? <><p>Расчётный сигнал: {supplier.snapshot.score ?? "Нет оценки"} / 100 · {formatAdminStatus(supplier.snapshot.status)}</p><p>Дата расчёта: {time(supplier.snapshot.computedAt)} · окно {supplier.snapshot.windowDays} дней · формула {supplier.snapshot.formulaVersion}</p><p>Записей в расчёте: {supplier.snapshot.eventCount}. Происхождение и полнота требуют проверки.</p></> : <p>Рейтинг не рассчитан. Наличие поставщика не означает наличие событий.</p>}
    <Appeals items={supplier.appeals} total={supplier.appealCount} />
    <DmButton aria-expanded={events} onClick={() => setEvents(value => !value)}>{events ? "Скрыть события" : "Происхождение событий"}</DmButton>
    {events ? <TrustEventList supplierId={supplier.id} /> : null}
  </div></DmSurface>;
}
