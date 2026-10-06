"use client";
import { DmAction, DmFileInput } from "@marketplace/ui/controls";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient, SupplierImportBatchResponse, SupplierImportDiagnosticsResponse } from "@marketplace/api-client";
import { importPriceMinor, type SupplierColumnMappingInput, type SupplierImportPreview } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmDropdown, DmTable, ErrorState, LoadingState, StatusTag, useUnsavedChanges, productWorkflowStyles as styles, errorMessage, formatStatus, formatDate, formatMoney } from "@marketplace/ui";
import type { SupplierDataSource } from "./types";
import local from "./spreadsheet-import.module.css";
const fields = [
  ["externalId", "Код строки", "Код"], ["name", "Название товара", "Название"],
  ["supplierSku", "Артикул поставщика", "Артикул"], ["gtin", "Штрихкод", "Штрихкод"],
  ["priceMinor", "Цена", "Цена"], ["currency", "Валюта", "Валюта"],
  ["quantityOnHand", "Остаток", "Остаток"], ["unit", "Единица измерения", "Единица"],
  ["brand", "Бренд", "Бренд"], ["manufacturer", "Производитель", "Производитель"],
  ["lotNumber", "Номер партии", "Партия"], ["expirationDate", "Срок годности", "Срок годности"],
] as const;
type RowFilter = "all" | "ready" | "attention" | "error";
export function SpreadsheetImport({ api, supplierId, sources, onChanged, hideHeading = false }: {
  api: MarketplaceApiClient; supplierId: string; sources: SupplierDataSource[]; onChanged: () => Promise<void>; hideHeading?: boolean;
}) {
  const [tab, setTab] = useState<"new" | "history">("new"), [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState<SupplierImportPreview | null>(null);
  const [sourceId, setSourceId] = useState(""), [createdSource, setCreatedSource] = useState<SupplierDataSource | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({}), [priceUnit, setPriceUnit] = useState<"MAJOR" | "MINOR">("MAJOR");
  const [batch, setBatch] = useState<SupplierImportBatchResponse | null>(null), [diagnostics, setDiagnostics] = useState<SupplierImportDiagnosticsResponse | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [unknownCreation, setUnknownCreation] = useState(false);
  const [filter, setFilter] = useState<RowFilter>("all"), [page, setPage] = useState(0), [reason, setReason] = useState("");
  const [history, setHistory] = useState<SupplierImportBatchResponse[] | null>(null), [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false), [historyError, setHistoryError] = useState<string | null>(null);
  const lock = useRef(false), historySequence = useRef(0), fileInput = useRef<HTMLInputElement>(null), content = useRef(""), batchId = useRef<string | null>(null);
  useUnsavedChanges(Boolean(file && !batch && !unknownCreation));
  const fileType = file?.name.toLowerCase().endsWith(".xlsx") ? "EXCEL" : "CSV";
  const availableSources = [...sources, ...(createdSource && !sources.some(source => source.id === createdSource.id) ? [createdSource] : [])].filter(source => source.type === fileType && source.status === "ACTIVE");
  const loadHistory = useCallback(async (cursor?: string) => {
    const request = ++historySequence.current; setHistoryLoading(true); setHistoryError(null);
    try { const rows = await api.listSupplierImportBatches(supplierId, cursor ? { cursor } : {}); if (request !== historySequence.current) return;
      setHistory(current => cursor ? [...(current ?? []), ...rows] : rows); setHistoryHasMore(rows.length === 50);
    } catch (cause) { if (request === historySequence.current) setHistoryError(errorMessage(cause)); }
    finally { if (request === historySequence.current) setHistoryLoading(false); }
  }, [api, supplierId]);
  useEffect(() => { void loadHistory(); return () => { historySequence.current++; }; }, [loadHistory]);
  const run = async (action: () => Promise<void>) => { if (lock.current) return; lock.current = true; setBusy(true); setError(null);
    try { await action(); } catch (cause) { setError(errorMessage(cause)); } finally { lock.current = false; setBusy(false); }
  };
  const readFile = () => run(async () => {
    if (!file || !/\.(csv|xlsx)$/i.test(file.name)) throw new Error("Выберите файл CSV или XLSX.");
    if (!file.size || file.size > 20_000_000) throw new Error("Файл должен быть непустым и не больше 20 МБ.");
    const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.onerror = () => reject(new Error("Не удалось прочитать файл. Выберите его повторно.")); reader.readAsDataURL(file); });
    const result = await api.previewSupplierImport(supplierId, { fileName: file.name, fileType, contentBase64: base64 });
    content.current = base64; setPreview(result);
    setMapping(Object.fromEntries(fields.map(([key, label, header]) => [key, result.headers.find(item => [header.toLowerCase(), label.toLowerCase(), key.toLowerCase()].includes(item.toLowerCase())) ?? ""])));
    setStep(1);
  });
  const rows = (preview?.rows ?? []).map(row => {
    const value = (key: string) => String(row.rawData[mapping[key] ?? ""] ?? "").trim();
    const price = value("priceMinor"), minor = price ? importPriceMinor(price, priceUnit) : null, quantity = value("quantityOnHand");
    const issue = !value("externalId") || !value("name") ? "Нужны код и название" : price && !minor ? "Некорректная цена" : quantity && !/^\d+(?:\.\d{1,6})?$/.test(quantity) ? "Некорректный остаток" : value("expirationDate") && Number.isNaN(Date.parse(value("expirationDate"))) ? "Некорректная дата" : null;
    const attention = !price || !value("currency") ? "Нужны цена и валюта" : value("currency").toUpperCase() !== "KZT" ? "Поддерживается валюта KZT" : value("expirationDate") && new Date(value("expirationDate")) <= new Date() ? "Срок годности истёк" : null;
    return { ...row, name: value("name"), sku: value("supplierSku") || value("externalId"), quantity, minor, issue: issue ?? attention, state: (issue ? "error" : attention ? "attention" : "ready") as RowFilter };
  });
  const selectedRows = rows.filter(row => filter === "all" || row.state === filter), errors = rows.filter(row => row.state === "error").length;
  const process = () => run(async () => {
    if (!batchId.current) {
      if (!file || !preview || !rows.length || errors) throw new Error("Исправьте ошибки файла перед загрузкой.");
      let selected = availableSources.find(source => source.id === sourceId);
      if (sourceId && !selected) throw new Error("Выберите источник для этого формата файла.");
      if (!selected) { selected = await api.post<SupplierDataSource>(`/suppliers/${supplierId}/data-sources`, { name: `Прайс ${fileType === "EXCEL" ? "Excel" : "CSV"}`, type: fileType }); setCreatedSource(selected); setSourceId(selected.id); }
      let created: SupplierImportBatchResponse;
      try { created = await api.createSupplierImportBatch(supplierId, { sourceId: selected.id, fileName: file.name, fileType, contentBase64: content.current,
        columnMapping: { ...Object.fromEntries(Object.entries(mapping).filter(([, value]) => value)), priceUnit } as SupplierColumnMappingInput }); }
      catch (cause) { const status = cause && typeof cause === "object" && "status" in cause ? Number(cause.status) : 0; if (!status || status >= 500 || status === 408) { setUnknownCreation(true); throw new Error(`Не удалось подтвердить создание загрузки. Проверьте историю перед повторной отправкой. ${errorMessage(cause)}`); } throw cause; }
      batchId.current = created.id; setBatch(created);
    }
    const processed = await api.processSupplierImportBatch(supplierId, batchId.current!); setBatch(processed);
    setBatch(await api.getSupplierImportBatch(supplierId, batchId.current!));
    setDiagnostics(await api.getSupplierImportDiagnostics(supplierId, batchId.current!)); await onChanged(); await loadHistory();
  });
  const refresh = () => run(async () => { if (!batch) return; setBatch(await api.getSupplierImportBatch(supplierId, batch.id)); setDiagnostics(await api.getSupplierImportDiagnostics(supplierId, batch.id)); await loadHistory(); });
  const reset = () => { setBatch(null); batchId.current = null; setDiagnostics(null); setFile(null); setPreview(null); content.current = ""; setStep(0); setReason(""); setError(null); setUnknownCreation(false); setTab("new"); };
  return <div className={styles.form}>
    {!hideHeading ? <h2>Импорт товаров</h2> : null}
    <div className={local.tabs} role="tablist" aria-label="Импорт"><DmAction variant="tab" role="tab" aria-selected={tab === "new"} onClick={() => setTab("new")}>Новая загрузка</DmAction><DmAction variant="tab" role="tab" aria-selected={tab === "history"} onClick={() => { setTab("history"); void loadHistory(); }}>История загрузок</DmAction></div>
    {tab === "history" ? <section className={`${styles.panel} ${styles.form}`} aria-label="История загрузок">
      <div className={styles.toolbar}><h2>История загрузок</h2><DmButton disabled={historyLoading} onClick={() => void loadHistory()}>Обновить</DmButton></div>
      {historyError ? <ErrorState description={historyError} action={<DmButton onClick={() => void loadHistory()}>Повторить</DmButton>} /> : null}
      {!history && historyLoading ? <LoadingState label="Загружаем историю" /> : null}
      {history?.length === 0 ? <div className={styles.empty}><h2>Загрузок пока нет</h2><p>Загрузите первый прайс в формате CSV или Excel.</p><DmButton appearance="primary" onClick={() => setTab("new")}>Загрузить файл</DmButton></div> : history ? <DmTable caption="История импорта" columns={[{ key: "file", label: "Файл" }, { key: "date", label: "Дата" }, { key: "status", label: "Результат" }, { key: "action", label: "Действие" }]}>{history.map(item => <tr key={item.id}><td data-label="Файл"><div><strong>{item.fileName}</strong></div></td><td data-label="Дата"><div>{formatDate(item.createdAt, true)}</div></td><td data-label="Результат"><div><StatusTag>{formatStatus(item.status)}</StatusTag><small>Обработано {item.processedRows}/{item.totalRows} · ошибок {item.errorRows}</small></div></td><td data-label="Действие"><div><DmButton disabled={busy} onClick={() => { if (file && !batch && !window.confirm("Открыть прошлую загрузку и закрыть текущий предпросмотр?")) return; void run(async () => { const [detail, report] = await Promise.all([api.getSupplierImportBatch(supplierId, item.id), api.getSupplierImportDiagnostics(supplierId, item.id)]); setBatch(detail); batchId.current = detail.id; setDiagnostics(report); setReason(""); setTab("new"); setStep(3); }); }}>Открыть результат {item.fileName}</DmButton></div></td></tr>)}</DmTable> : null}
      {historyHasMore ? <DmButton disabled={historyLoading} onClick={() => void loadHistory(history?.at(-1)?.id)}>Показать более ранние загрузки</DmButton> : null}
    </section> : <div className={`${styles.panel} ${styles.form}`}>
      {error ? <ErrorState description={error} /> : null}
      {batch ? <section className={styles.form}>
        <div className={styles.toolbar}><h2>{batch.fileName}</h2><StatusTag>{batch.status === "MAPPED" ? "Ожидает обработки" : formatStatus(batch.status)}</StatusTag></div>
        <p role="status">Всего строк: {batch.totalRows} · обработано: {diagnostics?.processedRows ?? batch.processedRows} · ошибок: {diagnostics?.errorRows ?? batch.errorRows}</p>
        {diagnostics?.byStatus.MATCH_PENDING ? <p className={styles.notice}>Требуют сопоставления: {diagnostics.byStatus.MATCH_PENDING}. Эти строки ещё не стали предложениями каталога.</p> : null}
        <DmTable caption="Результат обработки строк" columns={[{ key: "name", label: "Товар" }, { key: "row", label: "Строка" }, { key: "status", label: "Результат" }]}>{(batch.rows ?? []).map(row => <tr key={row.id}><td data-label="Товар"><div>{String(row.rawData[String(batch.columnMapping?.name ?? "")] ?? "Без названия")}</div></td><td data-label="Строка"><div>{row.rowNumber}</div></td><td data-label="Результат"><div>{formatStatus(row.status)}{row.errorMessage ? <small>{row.errorMessage}</small> : null}</div></td></tr>)}</DmTable>
        <p className={styles.hint}>Импорт не публикует товары автоматически. Проверьте предложения после обработки.</p>
        <div className={styles.footer}><DmButton disabled={busy} onClick={() => void refresh()}>Обновить результат</DmButton>{batch.status === "MAPPED" ? <DmButton appearance="primary" disabled={busy} onClick={() => void process()}>Обработать загрузку</DmButton> : <DmButton disabled={busy} onClick={reset}>Новая загрузка</DmButton>}</div>
        {["COMPLETED", "COMPLETED_WITH_ERRORS"].includes(batch.status) ? <details className={styles.disclosure}><summary>Отменить результаты загрузки</summary><div className={styles.form}><DmField label="Причина отмены" hint="От 10 до 500 символов. Изменения этой загрузки будут отменены; история сохранится."><DmInput value={reason} maxLength={500} disabled={busy} onChange={(_, data) => setReason(data.value)} /></DmField><DmButton disabled={busy || reason.trim().length < 10} onClick={() => void run(async () => { await api.rollbackSupplierImportBatch(supplierId, batch.id, { reason: reason.trim(), expectedUpdatedAt: batch.updatedAt }); setBatch(await api.getSupplierImportBatch(supplierId, batch.id)); setDiagnostics(null); await onChanged(); await loadHistory(); })}>Подтвердить отмену загрузки</DmButton></div></details> : null}
      </section> : <section className={styles.form}>
        {step === 0 ? <>
          <h2>Загрузите прайс</h2><p className={styles.hint}>CSV с запятыми или первый лист Excel. До 20 МБ и 5 000 строк.</p>
          <div className={local.upload}><strong>{file?.name ?? "Выберите файл с товарами"}</strong><span>Название, цена, остаток и артикул — в отдельных столбцах</span><DmButton disabled={busy} onClick={() => fileInput.current?.click()}>{file ? "Выбрать другой файл" : "Выбрать файл CSV или XLSX"}</DmButton><DmFileInput ref={fileInput} hidden aria-label="Таблица поставщика"  accept=".csv,.xlsx" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setSourceId(""); setPreview(null); setError(null); }} /></div>
          <div className={styles.toolbar}><a href="/templates/supplier-price-template.xlsx" download="Шаблон-прайса.xlsx">Скачать шаблон Excel</a><a href="/templates/supplier-price-template.csv" download="Шаблон-прайса.csv">Скачать шаблон CSV</a></div>
          <p className={styles.hint}>В шаблоне Excel есть пример и пояснения к столбцам. Замените пример своими товарами; цена — в тенге. CSV использует запятую как разделитель.</p>
          <DmField label="Источник прайса" hint="Для обновления прежних строк выбирайте тот же источник и сохраняйте их коды."><DmDropdown value={sourceId} disabled={busy} onChange={(_, data) => setSourceId(data.value)}><option value="">Создать новый источник</option>{availableSources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</DmDropdown></DmField>
          <div className={styles.footer}><span className={styles.hint}>До подтверждения предложения не изменятся</span><DmButton appearance="primary" disabled={busy || !file} onClick={() => void readFile()}>{busy ? "Читаем файл…" : "Настроить столбцы"}</DmButton></div>
        </> : step === 1 ? <>
          <h2>Сопоставьте столбцы</h2><p className={styles.hint}>{file?.name} · выберите столбец файла для каждого поля. Код и название обязательны.</p>
          <div className={styles.fields}>{fields.map(([key, label]) => <DmField key={key} label={label} required={key === "externalId" || key === "name"} hint={mapping[key] ? `Пример: ${String(preview?.rows[0]?.rawData[mapping[key]!] ?? "—").slice(0, 100)}` : undefined}><DmDropdown aria-label={label} value={mapping[key] ?? ""} onChange={(_, data) => setMapping(current => ({ ...current, [key]: data.value }))}><option value="">Не импортировать</option>{preview?.headers.map(header => <option key={header} value={header}>{header}</option>)}</DmDropdown></DmField>)}<DmField label="Цена в файле"><DmDropdown value={priceUnit} onChange={(_, data) => setPriceUnit(data.value as "MAJOR" | "MINOR")}><option value="MAJOR">Тенге (1 250 = 1 250 ₸)</option><option value="MINOR">Тиыны (125000 = 1 250 ₸)</option></DmDropdown></DmField></div>
          <div className={styles.footer}><DmButton onClick={() => setStep(0)}>Назад</DmButton><DmButton appearance="primary" disabled={!mapping.externalId || !mapping.name} onClick={() => { setFilter("all"); setPage(0); setStep(2); }}>Проверить данные</DmButton></div>
        </> : step === 2 ? <>
          <h2>Проверьте данные</h2><p className={styles.hint}>{file?.name} · {rows.length} строк. Сопоставление с каталогом выполняется при обработке.</p>
          <div className={local.filters}>{([["all", "Все"], ["ready", "Без ошибок"], ["attention", "Требуют внимания"], ["error", "Ошибки"]] as const).map(([value, label]) => <DmAction variant="choice" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); }}>{label} <span>{value === "all" ? rows.length : rows.filter(row => row.state === value).length}</span></DmAction>)}</div>
          <table className={styles.table}><caption className="dm-sr-only">Предварительный просмотр строк файла</caption><thead><tr><th>Товар</th><th>Цена</th><th>Остаток</th><th>Проверка</th></tr></thead><tbody>{selectedRows.slice(page * 25, (page + 1) * 25).map(row => <tr key={row.rowNumber}><td data-label="Товар"><div><strong>{row.name || "Без названия"}</strong><small>{row.sku || "Нет кода"} · строка {row.rowNumber}</small></div></td><td data-label="Цена"><div>{row.minor ? formatMoney(row.minor, "KZT") : "—"}</div></td><td data-label="Остаток"><div>{row.quantity || "—"}</div></td><td data-label="Проверка"><div><StatusTag>{row.state === "ready" ? "Без ошибок формата" : row.state === "error" ? "Ошибка" : "Требует внимания"}</StatusTag>{row.issue ? <small>{row.issue}</small> : null}</div></td></tr>)}</tbody></table>
          {!selectedRows.length ? <p className={styles.hint}>В этой группе нет строк.</p> : null}
          {selectedRows.length > 25 ? <div className={local.pagination}><DmButton disabled={page === 0} onClick={() => setPage(page - 1)}>Предыдущие строки</DmButton><span>{page + 1} / {Math.ceil(selectedRows.length / 25)}</span><DmButton disabled={(page + 1) * 25 >= selectedRows.length} onClick={() => setPage(page + 1)}>Следующие строки</DmButton></div> : null}
          {errors ? <p role="alert">Исправьте {errors} ошибок в исходном файле или сопоставлении столбцов.</p> : null}
          <div className={styles.footer}><DmButton onClick={() => setStep(1)}>Изменить столбцы</DmButton><DmButton appearance="primary" disabled={!rows.length || errors > 0} onClick={() => setStep(3)}>Далее: подтверждение</DmButton></div>
        </> : <>
          <h2>Подтвердите загрузку</h2><dl className={styles.metadata}><dt>Файл</dt><dd>{file?.name}</dd><dt>Строк</dt><dd>{rows.length}</dd><dt>Источник</dt><dd>{availableSources.find(source => source.id === sourceId)?.name ?? "Новый источник прайса"}</dd><dt>Цена в файле</dt><dd>{priceUnit === "MAJOR" ? "Тенге" : "Тиыны"}</dd></dl>
          <p className={styles.notice}>Цены и остатки сопоставленных товаров будут обновлены. Новые и неизвестные товары могут потребовать проверки. Публикация не выполняется автоматически.</p>
          <div className={styles.footer}><DmButton disabled={busy || unknownCreation} onClick={() => setStep(2)}>Назад к проверке</DmButton><DmButton appearance="primary" disabled={busy || unknownCreation} onClick={() => void process()}>{busy ? "Обрабатываем…" : "Подтвердить и обработать"}</DmButton></div>
          {unknownCreation ? <DmButton onClick={() => { setTab("history"); void loadHistory(); }}>Проверить историю загрузок</DmButton> : null}
        </>}
      </section>}
    </div>}
  </div>;
}
