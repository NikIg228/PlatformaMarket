"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient } from "@marketplace/api-client";
import { operatorAuditQuerySchema, type OperatorAuditEntry } from "@marketplace/schemas";
import { adminSectionQuery, parseAdminQuery, serializeAdminQuery, type AdminQuery } from "@marketplace/schemas/product-navigation";
import { DmButton, DmDialog, DmField, DmInput, DmSurface, DmTable, EmptyState, ErrorState, LoadingState } from "@marketplace/ui";
import { useAdminQuery } from "./use-admin-query";
import { useOperatorProjection } from "./use-operator-projection";
import styles from "./operator-orders.module.css";

const fields = { auditOrganization: "ID организации", auditActor: "ID сотрудника", auditEntityType: "Тип объекта", auditEntityId: "ID объекта", auditAction: "Действие", auditFrom: "Дата с", auditTo: "Дата по" } as const;
const query = (state: AdminQuery) => ({ organizationId: state.auditOrganization || undefined, actorId: state.auditActor || undefined, entityType: state.auditEntityType || undefined, entityId: state.auditEntityId || undefined, action: state.auditAction || undefined, dateFrom: state.auditFrom || undefined, dateTo: state.auditTo || undefined, offset: state.auditOffset, limit: 25 });
export const auditTime = (value: string) => new Date(value).toLocaleString("ru-KZ", { timeZone: "Asia/Almaty" });

export function OperatorAudit() {
  const { state, write } = useAdminQuery();
  const [draft, setDraft] = useState(state), [invalid, setInvalid] = useState(false);
  useEffect(() => { setDraft(state); setInvalid(false); }, [state]);
  return <section className={styles.section} aria-label="Журнал действий площадки"><h2>Журнал действий площадки</h2>
    <p>События организаций площадки. Даты и время указаны по Казахстану (UTC+5). Содержимое документов и конфиденциальные поля скрыты.</p>
    <DmSurface variant="filters"><form className={styles.filters} onSubmit={event => { event.preventDefault(); const valid = operatorAuditQuerySchema.safeParse(query(draft)).success && Object.keys(fields).every(key => !/[\\#]/.test(draft[key as keyof typeof fields])); setInvalid(!valid); if (valid) { try { write({ ...state, ...Object.fromEntries(Object.keys(fields).map(key => [key, draft[key as keyof typeof fields].trim()])), auditOffset: 0 }); } catch { setInvalid(true); } } }}>
      {Object.entries(fields).map(([key, label]) => <DmField key={key} label={label}><DmInput type={key === "auditFrom" || key === "auditTo" ? "date" : "text"} value={draft[key as keyof typeof fields]} maxLength={160} onChange={(_, data) => setDraft(previous => ({ ...previous, [key]: data.value }))} /></DmField>)}
      {invalid ? <p role="alert">Проверьте UUID организации и сотрудника, даты и порядок периода. Текст — до 160 символов, без # и обратной косой черты. Если адрес слишком длинный, сократите фильтры.</p> : null}
      <div className={styles.actions}><DmButton type="submit">Применить фильтры</DmButton><DmButton onClick={() => write({ ...state, auditOrganization: "", auditActor: "", auditEntityType: "", auditEntityId: "", auditAction: "", auditFrom: "", auditTo: "", auditOffset: 0 })}>Сбросить фильтры</DmButton></div>
    </form></DmSurface>
    <AuditResults key={JSON.stringify(query(state))} state={state} write={write} />
  </section>;
}

function AuditResults({ state, write }: { state: AdminQuery; write: (state: AdminQuery) => void }) {
  const input = JSON.stringify(query(state));
  const read = useCallback((api: MarketplaceApiClient, signal: AbortSignal) => api.operatorAudit(JSON.parse(input), signal), [input]);
  const { data, loading, error, refresh } = useOperatorProjection(read);
  const [selected, setSelected] = useState<OperatorAuditEntry | null>(null), [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const target = selected?.href ? parseAdminQuery(selected.href.split("?")[1] ?? "") : undefined;
  const destination = target ? { ...adminSectionQuery(state, target.section), orgId: target.orgId, orderId: target.orderId, ticketId: target.ticketId, object: target.object, queueType: target.queueType } : undefined;
  return <div className={styles.section} aria-busy={loading}>
    <div className={styles.header}><p role="status">{data ? `Найдено событий: ${data.total}${loading || error ? " · Последняя загрузка" : ""}` : ""}</p><DmButton disabled={loading} onClick={() => void refresh()}>Обновить журнал</DmButton></div>
    {loading && !data ? <LoadingState label="Загружаем журнал" /> : null}
    {error ? <ErrorState presentation="inline" title="Журнал не обновлён" description={error} action={<DmButton onClick={() => void refresh()}>Повторить загрузку журнала</DmButton>} /> : null}
    {data?.items.length === 0 ? <EmptyState title="События не найдены" description="Измените фильтры или вернитесь к первой странице." /> : null}
    {data?.items.map(entry => <DmSurface variant="card" key={entry.id} className={styles.section}>
      <div className={styles.header}><h3>{entry.action}</h3><p>{auditTime(entry.createdAt)}</p></div>
      <p>{entry.entityType} · {entry.entityId}</p>
      <dl className={styles.details}><div><dt>Сотрудник</dt><dd>{entry.actor ? `${entry.actor.name ?? "Имя недоступно"} · ${entry.actor.id}` : "Системное событие"}</dd></div><div><dt>Организация</dt><dd>{entry.organization ? `${entry.organization.name ?? "Название недоступно"} · ${entry.organization.id}` : "Событие площадки"}</dd></div></dl>
      <div className={styles.actions}><DmButton onClick={event => { trigger.current = event.currentTarget; setSelected(entry); setOpen(true); }}>Изменения</DmButton>
        {entry.actor ? <DmButton onClick={() => write({ ...state, auditActor: entry.actor!.id, auditOffset: 0 })}>События сотрудника</DmButton> : null}
        {entry.organization ? <DmButton onClick={() => write({ ...state, auditOrganization: entry.organization!.id, auditOffset: 0 })}>События организации</DmButton> : null}</div>
    </DmSurface>)}
    {data ? <nav className={styles.actions} aria-label="Страницы журнала"><DmButton disabled={loading || state.auditOffset === 0} onClick={() => write({ ...state, auditOffset: Math.max(0, state.auditOffset - 25) })}>Назад</DmButton><span>Страница {state.auditOffset / 25 + 1}</span><DmButton disabled={loading || state.auditOffset + 25 >= data.total || state.auditOffset >= 1000000} onClick={() => write({ ...state, auditOffset: state.auditOffset + 25 })}>Далее</DmButton>{state.auditOffset > 0 ? <DmButton onClick={() => write({ ...state, auditOffset: 0 })}>В начало журнала</DmButton> : null}</nav> : null}
    <DmDialog open={open && Boolean(data)} onOpenChange={setOpen} onClosed={() => trigger.current?.focus()} title="Изменения события" actions={<><DmButton onClick={() => setOpen(false)}>Закрыть</DmButton>{destination ? <DmButton as="a" href={`/admin${serializeAdminQuery(destination)}`} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && !event.button) { event.preventDefault(); write(destination); } }}>Открыть объект</DmButton> : null}</>}>
      {selected ? <div className={styles.section}><p>{selected.action} · {auditTime(selected.createdAt)}</p><p>{selected.entityType} · {selected.entityId}</p>
        {selected.redacted ? <p>Часть полей скрыта для защиты конфиденциальных данных.</p> : null}
        {selected.changes.length ? <DmTable caption="Безопасные изменения" columns={[{ key: "field", label: "Поле" }, { key: "before", label: "До" }, { key: "after", label: "После" }]}>{selected.changes.map(change => <tr key={change.field}><td data-label="Поле">{change.label}</td><td data-label="До">{change.before ?? "Нет значения"}</td><td data-label="После">{change.after ?? "Нет значения"}</td></tr>)}</DmTable> : <p>Нет доступных изменений для показа.</p>}
        {!destination ? <p>Переход к объекту недоступен для этого события или ваших прав.</p> : null}</div> : null}
    </DmDialog>
  </div>;
}
