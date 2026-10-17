"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import type { OperationObject, OperationQueueType, SupplierImportDiagnosticsResponse } from "@marketplace/schemas";
import { adminSectionQuery } from "@marketplace/schemas/product-navigation";
import { ActionFeedback, DmButton, DmDialog, DmField, DmSurface, DmTextarea, LoadingState, errorMessage, formatDate } from "@marketplace/ui";
import { adminApiContext } from "./admin-auth";
import { useAdminQuery } from "./use-admin-query";
import styles from "./operation-import-focus.module.css";

const statusLabels: Record<string, string> = {
  UPLOADED: "Загружен", MAPPED: "Готов к обработке", REVIEW_REQUIRED: "Нужно проверить сопоставление",
  PROCESSING: "Обрабатывается", COMPLETED: "Завершён", COMPLETED_WITH_ERRORS: "Завершён с ошибками",
  FAILED: "Ошибка обработки", ROLLING_BACK: "Выполняется откат", ROLLED_BACK: "Отменён",
  MISMATCH: "Данные расходятся", MISSING_EXTERNAL: "Нет данных во внешней системе", MISSING_INTERNAL: "Нет данных на площадке",
  MATCHED: "Данные совпадают", RESOLVED: "Решение сохранено",
};
const importHelp: Record<string, string> = {
  UPLOADED: "Поставщику нужно завершить сопоставление колонок перед обработкой файла.",
  MAPPED: "Сопоставление сохранено. Можно обработать этот файл с уже подтверждёнными условиями поставщика.",
  REVIEW_REQUIRED: "Поставщику нужно проверить сопоставление колонок и подтвердить условия импорта в своём кабинете.",
  PROCESSING: "Обработка уже выполняется. Обновите состояние позже.",
  COMPLETED: "Импорт завершён. Откат доступен, если его результаты ещё можно безопасно отменить.",
  COMPLETED_WITH_ERRORS: "Проверьте проблемные строки. Для исправления поставщик загружает исправленный файл. Откат отменит допустимые результаты всего этого импорта.",
  FAILED: "Автоматический повтор из этого состояния недоступен. Поставщику нужно проверить исходный файл и условия импорта, затем загрузить исправленный файл.",
  ROLLING_BACK: "Откат уже выполняется. Обновите состояние позже.",
  ROLLED_BACK: "Результаты импорта отменены. Исходный файл и история сохранены.",
};
const reconciliationKinds: Record<string, string> = { CATALOG: "Каталог", PRICE: "Цены", INVENTORY: "Остатки", ORDER: "Заказы", RESERVATION: "Резервы" };
function fieldValue(field: OperationObject["fields"][number]) {
  if (field.label === "Статус") return statusLabels[field.value] ?? "Требуется уточнение";
  if (field.label === "Тип") return reconciliationKinds[field.value] ?? "Проверка данных";
  if (field.label === "Обнаружено" && !Number.isNaN(Date.parse(field.value))) return formatDate(field.value, true);
  return field.value;
}

export function OperationImportFocus({ id, queueType }: { id: string; queueType: OperationQueueType }) {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const { state, write } = useAdminQuery();
  const [object, setObject] = useState<OperationObject | null>(null);
  const [diagnostics, setDiagnostics] = useState<SupplierImportDiagnosticsResponse | null>(null);
  const [diagnosticError, setDiagnosticError] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [applied, setApplied] = useState(false);
  const command = useRef<null | (() => Promise<unknown>)>(null);
  const lock = useRef(false);
  const mounted = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const rollbackTrigger = useRef<HTMLButtonElement>(null);
  const context = object?.context;

  const load = useCallback(async () => {
    const [next, rights] = await Promise.all([api.operationObject(queueType, id), api.get<string[]>("/access-control/permissions")]);
    if (!mounted.current) return;
    setObject(next); setError(""); setApplied(false); setDiagnostics(null); setDiagnosticError("");
    command.current = null; setPending(false);
    if (next.context?.kind === "IMPORT" && rights.includes("import.manage")) {
      try {
        const result = await api.getSupplierImportDiagnostics(next.context.supplierOrganizationId, id);
        if (mounted.current) setDiagnostics(result);
      } catch { if (mounted.current) setDiagnosticError("Не удалось загрузить строки для проверки. Обновите состояние; введённая причина сохранена."); }
    }
  }, [api, id, queueType]);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await load(); } catch (cause) { if (mounted.current) setError(errorMessage(cause)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }, [load]);
  useEffect(() => {
    mounted.current = true; heading.current?.focus(); void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);

  const execute = async (action?: "process" | "rollback" | "resolve") => {
    if (lock.current || !context) return;
    if (!command.current) {
      const text = reason.trim();
      if (action === "process" && context.kind === "IMPORT" && context.canProcess) command.current = () => api.processSupplierImportBatch(context.supplierOrganizationId, id);
      if (action === "rollback" && context.kind === "IMPORT" && context.canRollback && text.length >= 10) command.current = () => api.rollbackSupplierImportBatch(context.supplierOrganizationId, id, { reason: text, expectedUpdatedAt: context.updatedAt });
      if (action === "resolve" && context.kind === "RECONCILIATION" && context.canResolve && text.length >= 3) command.current = () => api.resolveIntegrationReconciliation(context.supplierOrganizationId, context.connectionId, id, { resolution: text, expectedUpdatedAt: context.updatedAt });
    }
    if (!command.current) return;
    lock.current = true; setBusy(true); setPending(true); setError(""); setFeedback(""); setConfirmed(false);
    try {
      await command.current();
      if (!mounted.current) return;
      command.current = null; setPending(false); setApplied(true); setReason("");
      setFeedback("Действие выполнено. Результат сохранён.");
      try { await load(); } catch (cause) { if (mounted.current) setError(`${errorMessage(cause)} Действие уже выполнено. Обновите состояние, чтобы увидеть результат.`); }
    } catch (cause) { if (mounted.current) setError(`${errorMessage(cause)} Обновите состояние или повторите ту же команду. Ввод сохранён.`); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return <DmSurface variant="section" className={styles.panel} role="region" aria-label="Контекст импорта и сверки" aria-busy={busy}>
    <div className={styles.header}><h2 ref={heading} tabIndex={-1}>{object?.title ?? "Объект из очереди"}</h2><DmButton disabled={busy} onClick={() => void refresh()}>Обновить состояние</DmButton></div>
    {error ? <ActionFeedback tone="error" description={error} /> : null}
    {feedback ? <ActionFeedback tone="success" description={feedback} /> : null}
    {!object && busy ? <LoadingState label="Открываем объект" /> : null}
    {object ? <dl className={styles.details}>{object.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{fieldValue(field)}</dd></div>)}</dl> : null}
    {object && !context ? <ActionFeedback tone="error" description="Контекст действий недоступен. Обновите состояние перед продолжением." /> : null}
    {context?.kind === "IMPORT" ? <>
      <p>{importHelp[context.status] ?? "Для этого состояния нет доступной автоматической команды. Уточните данные у поставщика."}</p>
      {diagnosticError ? <ActionFeedback tone="error" description={diagnosticError} /> : null}
      {diagnostics ? <section aria-label="Строки для проверки"><h3>Строки для проверки</h3>
        {diagnostics.conflicts.length ? <><p>Показано проблемных строк: {diagnostics.conflicts.length} (не более 200).</p><ol>{diagnostics.conflicts.map(row => <li key={row.rowNumber}>Строка {row.rowNumber}: {row.status === "MATCH_PENDING" ? "Нужно сопоставить товар" : "Нужно исправить данные"}</li>)}</ol></> : <p>Проблемные строки не найдены.</p>}
      </section> : null}
    </> : context?.kind === "RECONCILIATION" ? <>
      <p>Зафиксируйте результат проверки этого расхождения. Решение сохраняется в истории; исправление данных выполняется в соответствующей системе.</p>
      {context.resolution ? <p className={styles.resolution}>Сохранённое решение: {context.resolution}</p> : null}
    </> : null}
    {context && !pending && !applied ? <>
      {context.kind === "IMPORT" && context.canProcess ? <DmButton disabled={busy} onClick={() => void execute("process")}>Обработать импорт</DmButton> : null}
      {(context.kind === "IMPORT" && context.canRollback || context.kind === "RECONCILIATION" && context.canResolve) ? <form className={styles.form} onSubmit={event => { event.preventDefault(); if (context.kind === "IMPORT") setConfirmed(true); else void execute("resolve"); }}>
        <DmField label={context.kind === "IMPORT" ? "Причина отката" : "Решение по расхождению"} hint={context.kind === "IMPORT" ? "Не менее 10 символов. Причина сохранится в истории импорта." : "Не менее 3 символов. Опишите результат проверки."} required><DmTextarea value={reason} disabled={busy} maxLength={context.kind === "IMPORT" ? 500 : 2000} onChange={event => setReason(event.target.value)} /></DmField>
        <DmButton ref={rollbackTrigger} type="submit" disabled={busy || reason.trim().length < (context.kind === "IMPORT" ? 10 : 3)}>{context.kind === "IMPORT" ? "Откатить импорт" : "Сохранить решение"}</DmButton>
      </form> : null}
    </> : null}
    {pending ? <><p className={styles.resolution}>Введённая причина: {reason || "Обработка импорта"}</p><DmButton disabled={busy} onClick={() => void execute()}>Повторить ту же команду</DmButton></> : null}
    <div className={styles.actions}>
      <DmButton disabled={busy} onClick={() => write(adminSectionQuery(state, "overview"))}>Вернуться к очереди</DmButton>
      <DmButton disabled={busy} onClick={() => { write({ ...state, queueType: undefined, object: undefined }); const title = document.querySelector<HTMLElement>("h1"); if (title) { title.tabIndex = -1; title.focus(); } }}>Закрыть объект</DmButton>
    </div>
    <DmDialog open={confirmed} title="Откат импорта" onOpenChange={value => { if (!busy) setConfirmed(value); }} onClosed={() => { if (rollbackTrigger.current && !rollbackTrigger.current.disabled) rollbackTrigger.current.focus(); else heading.current?.focus(); }} actions={<><DmButton disabled={busy} onClick={() => setConfirmed(false)}>Отмена</DmButton><DmButton disabled={busy} onClick={() => void execute("rollback")}>Подтвердить откат</DmButton></>}>
      <p>Отменить допустимые результаты импорта «{object?.title}»? Сервер проверит, что данные не изменились и не используются в заказах или резервах.</p><p className={styles.resolution}>{reason}</p>
    </DmDialog>
  </DmSurface>;
}
