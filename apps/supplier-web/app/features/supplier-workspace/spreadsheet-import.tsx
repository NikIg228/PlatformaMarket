"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MarketplaceApiClient, SupplierImportBatchResponse, SupplierImportDiagnosticsResponse } from "@marketplace/api-client";
import type { SupplierColumnMappingInput } from "@marketplace/schemas";
import { DmButton, DmField, DmInput, DmDropdown, DmTable, ErrorState, LoadingState, Section, StatusTag, errorMessage, formatStatus, formatDate } from "@marketplace/ui";
import type { SupplierDataSource } from "./types";
import styles from "./product-forms.module.css";

const fields = [
  ["externalId", "Код строки или артикул", "Код"], ["name", "Название товара", "Название"],
  ["supplierSku", "Артикул поставщика", "Артикул"], ["gtin", "Штрихкод", "Штрихкод"],
  ["priceMinor", "Цена в тиынах", "Цена в тиынах"], ["currency", "Валюта", "Валюта"],
  ["quantityOnHand", "Остаток", "Остаток"], ["unit", "Единица измерения", "Единица"],
] as const;
const template = '\uFEFF' + fields.map(([, , header]) => header).join(',') + '\r\n';
export function SpreadsheetImport({ api, supplierId, sources, onChanged, hideHeading = false }: {
  api: MarketplaceApiClient; supplierId: string; sources: SupplierDataSource[]; onChanged: () => Promise<void>; hideHeading?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null), [step, setStep] = useState(0);
  const [sourceId, setSourceId] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(([key, , initial]) => [key, initial])));
  const [batch, setBatch] = useState<SupplierImportBatchResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<SupplierImportDiagnosticsResponse | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [createdSource, setCreatedSource] = useState<SupplierDataSource | null>(null), [reason, setReason] = useState("");
  const [history, setHistory] = useState<SupplierImportBatchResponse[] | null>(null), [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false), [historyError, setHistoryError] = useState<string | null>(null);
  const lock = useRef(false), historySequence = useRef(0), fileInput = useRef<HTMLInputElement>(null);
  const fileType = file?.name.toLowerCase().endsWith(".xlsx") ? "EXCEL" : "CSV";
  const availableSources = [...sources, ...(createdSource && !sources.some(source => source.id === createdSource.id) ? [createdSource] : [])].filter(source => source.type === fileType && source.status === "ACTIVE");
  const loadHistory = useCallback(async (cursor?: string) => {
    const request = ++historySequence.current; setHistoryLoading(true); setHistoryError(null);
    try {
      const rows = await api.listSupplierImportBatches(supplierId, cursor ? { cursor } : {});
      if (request !== historySequence.current) return;
      setHistory(current => cursor ? [...(current ?? []), ...rows] : rows); setHistoryHasMore(rows.length === 50);
    } catch (cause) { if (request === historySequence.current) setHistoryError(errorMessage(cause)); }
    finally { if (request === historySequence.current) setHistoryLoading(false); }
  }, [api, supplierId]);
  useEffect(() => { void loadHistory(); return () => { historySequence.current++; }; }, [loadHistory]);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await action(); } catch (cause) { setError(errorMessage(cause)); } finally { lock.current = false; setBusy(false); }
  };
  const validateFile = () => {
    if (!file || !/\.(csv|xlsx)$/i.test(file.name)) throw new Error("Выберите файл CSV или XLSX.");
    if (!file.size || file.size > 20_000_000) throw new Error("Файл должен быть непустым и не больше 20 МБ.");
    return file;
  };
  const preview = () => run(async () => {
    const selectedFile = validateFile();
    if (!mapping.externalId?.trim() || !mapping.name?.trim()) throw new Error("Укажите названия колонок кода и товара.");
    let selected = availableSources.find(source => source.id === sourceId);
    if (sourceId && !selected) throw new Error("Выберите источник для этого формата файла.");
    if (!selected) {
      selected = await api.post<SupplierDataSource>(`/suppliers/${supplierId}/data-sources`, { name: `Прайс ${fileType === "EXCEL" ? "Excel" : "CSV"}`, type: fileType });
      setCreatedSource(selected); setSourceId(selected.id);
    }
    const contentBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("Не удалось прочитать файл. Выберите его повторно.")); reader.readAsDataURL(selectedFile);
    });
    const created = await api.createSupplierImportBatch(supplierId, {
      sourceId: selected.id, fileName: selectedFile.name, fileType, contentBase64,
      columnMapping: Object.fromEntries(Object.entries(mapping).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])) as SupplierColumnMappingInput,
    });
    setBatch(created); setDiagnostics(null); setBatch(await api.getSupplierImportBatch(supplierId, created.id));
    await onChanged(); await loadHistory();
  });
  const refresh = () => run(async () => {
    if (!batch) return;
    setBatch(await api.getSupplierImportBatch(supplierId, batch.id));
    setDiagnostics(await api.getSupplierImportDiagnostics(supplierId, batch.id)); await loadHistory();
  });
  const process = () => run(async () => {
    if (!batch) return;
    setBatch(await api.processSupplierImportBatch(supplierId, batch.id));
    setBatch(await api.getSupplierImportBatch(supplierId, batch.id));
    setDiagnostics(await api.getSupplierImportDiagnostics(supplierId, batch.id)); await onChanged(); await loadHistory();
  });
  const rollback = () => run(async () => {
    if (!batch) return;
    await api.rollbackSupplierImportBatch(supplierId, batch.id, { reason: reason.trim(), expectedUpdatedAt: batch.updatedAt });
    setBatch(await api.getSupplierImportBatch(supplierId, batch.id)); setDiagnostics(null); await onChanged(); await loadHistory();
  });
  const previewRows = batch?.rows ?? [];
  const requiredColumns = [batch?.columnMapping?.externalId, batch?.columnMapping?.name].filter((value): value is string => typeof value === "string");
  const missingColumns = batch?.status === "MAPPED" && previewRows.length > 0 ? requiredColumns.filter(column => !Object.hasOwn(previewRows[0]!.rawData, column)) : [];
  return <Section className={styles.panel} title={hideHeading ? undefined : "Загрузить товары из файла"}>
    <div className="mp-stack">
      <ol className={styles.steps} aria-label="Этапы импорта"><li aria-current={!batch && step === 0 ? "step" : undefined}>1. Файл</li><li aria-current={!batch && step === 1 ? "step" : undefined}>2. Столбцы</li><li aria-current={batch ? "step" : undefined}>3. Проверка и загрузка</li></ol>
      {error ? <ErrorState description={error} /> : null}
      {!batch ? <>
        {step === 0 ? <>
          <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download="Шаблон-прайса.csv">Скачать шаблон CSV</a>
          <DmField label="Таблица поставщика" hint="CSV с запятыми или первый лист XLSX; до 20 МБ и 5 000 строк."><DmButton disabled={busy} onClick={() => fileInput.current?.click()}>Выбрать файл CSV или XLSX</DmButton><input ref={fileInput} hidden aria-label="Таблица поставщика" type="file" accept=".csv,.xlsx" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); setSourceId(""); setError(null); }} /></DmField>
          {file ? <p>{file.name}</p> : null}
          <DmField label="Источник прайса" hint="Для обновления прежних строк выбирайте тот же источник и сохраняйте их коды."><DmDropdown value={sourceId} disabled={busy} onChange={(_, data) => setSourceId(data.value)}><option value="">Создать новый источник</option>{availableSources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</DmDropdown></DmField>
          <DmButton appearance="primary" disabled={busy || !file} onClick={() => { try { validateFile(); setError(null); setStep(1); } catch (cause) { setError(errorMessage(cause)); } }}>Настроить столбцы</DmButton>
        </> : <>
          <h3>{file?.name}</h3><p>Укажите заголовки столбцов вашего файла. Код и название обязательны; ненужные поля очистите. Цена в тиынах: 125000 = 1 250 ₸.</p>
          <div className={styles.mapping}>{fields.map(([key, label]) => <DmField key={key} label={label} required={key === "externalId" || key === "name"}><DmInput value={mapping[key]} disabled={busy} onChange={(_, data) => setMapping(current => ({ ...current, [key]: data.value }))} /></DmField>)}</div>
          <div className={styles.toolbar}><DmButton disabled={busy} onClick={() => setStep(0)}>Назад к файлу</DmButton><DmButton appearance="primary" disabled={busy || !file} onClick={() => void preview()}>{busy ? "Читаем файл…" : "Загрузить для просмотра"}</DmButton></div>
        </>}
      </> : <>
        <h3>{batch.fileName}</h3><p role="status">Всего строк: {batch.totalRows}. Показано: {previewRows.length}.</p>
        <StatusTag>{batch.status === "MAPPED" ? "Ожидает подтверждения" : formatStatus(batch.status)}</StatusTag>
        {previewRows.length ? <DmTable caption="Предварительный просмотр строк файла" columns={[{ key: "number", label: "Строка" }, { key: "data", label: "Данные" }, { key: "status", label: "Результат" }]}>{previewRows.map(row => <tr key={row.id}><td data-label="Строка"><div>{row.rowNumber}</div></td><td data-label="Данные" style={{ overflowWrap: "anywhere" }}><div>{Object.entries(row.rawData).map(([key, value]) => <div key={key}><strong>{key}:</strong> {String(value ?? "")}</div>)}</div></td><td data-label="Результат"><div>{row.status === "RAW" ? "Загружено" : formatStatus(row.status)}{row.errorMessage ? <p>{row.errorMessage}</p> : null}</div></td></tr>)}</DmTable> : <p>Просмотр ещё не загружен. Нажмите «Обновить результат».</p>}
        {missingColumns.length ? <p role="alert">Не найдены обязательные столбцы: {missingColumns.join(", ")}. Исправьте названия и загрузите файл заново.</p> : null}
        {diagnostics ? <p role="status">Обработано: {diagnostics.processedRows}. Ошибок: {diagnostics.errorRows}. Требуют сопоставления: {diagnostics.byStatus.MATCH_PENDING ?? 0}.</p> : null}
        <p>Импорт не публикует товары автоматически. Проверьте предложения после обработки.</p>
        <div className={styles.toolbar}><DmButton disabled={busy} onClick={() => void refresh()}>Обновить результат</DmButton>{batch.status === "MAPPED" ? <DmButton appearance="primary" disabled={busy || !previewRows.length || missingColumns.length > 0} onClick={() => void process()}>Данные проверены — обработать</DmButton> : null}<DmButton disabled={busy} onClick={() => { setBatch(null); setDiagnostics(null); setReason(""); setError(null); }}>Вернуться к загрузке</DmButton></div>
        {["COMPLETED", "COMPLETED_WITH_ERRORS"].includes(batch.status) ? <details><summary>Отменить результаты загрузки</summary><div className="mp-stack"><DmField label="Причина отмены" hint="От 10 до 500 символов. Результаты этой загрузки будут отменены; история сохранится."><DmInput value={reason} maxLength={500} disabled={busy} onChange={(_, data) => setReason(data.value)} /></DmField><DmButton disabled={busy || reason.trim().length < 10} onClick={() => void rollback()}>Подтвердить отмену загрузки</DmButton></div></details> : null}
      </>}
      <section className={styles.history} aria-label="История загрузок"><div className={styles.toolbar}><h3>История загрузок</h3><DmButton disabled={historyLoading} onClick={() => void loadHistory()}>Обновить историю</DmButton></div>
        {historyError ? <ErrorState description={historyError} action={<DmButton onClick={() => void loadHistory()}>Повторить загрузку истории</DmButton>} /> : null}
        {!history && historyLoading ? <LoadingState label="Загружаем историю" /> : null}
        {history?.length === 0 ? <p>Вы ещё не загружали прайсы.</p> : history ? <DmTable caption="История импорта" columns={[{ key: "file", label: "Файл" }, { key: "status", label: "Результат" }, { key: "action", label: "Действие" }]}>{history.map(item => <tr key={item.id}><td data-label="Файл"><div>{item.fileName}<br />{formatDate(item.createdAt, true)}</div></td><td data-label="Результат"><div>{formatStatus(item.status)} · обработано {item.processedRows}/{item.totalRows} · ошибок: {item.errorRows}</div></td><td data-label="Действие"><div><DmButton disabled={busy} onClick={() => void run(async () => { const [detail, report] = await Promise.all([api.getSupplierImportBatch(supplierId, item.id), api.getSupplierImportDiagnostics(supplierId, item.id)]); setBatch(detail); setDiagnostics(report); setReason(""); })}>Открыть результат {item.fileName}</DmButton></div></td></tr>)}</DmTable> : null}
        {historyHasMore ? <DmButton disabled={historyLoading} onClick={() => void loadHistory(history?.at(-1)?.id)}>Показать более ранние загрузки</DmButton> : null}
      </section>
    </div>
  </Section>;
}
