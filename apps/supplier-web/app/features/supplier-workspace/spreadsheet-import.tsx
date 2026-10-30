"use client";
import type { RowFilter } from "./spreadsheet-import-types";
import { SpreadsheetConfirmation } from "./SpreadsheetConfirmation";
import { SpreadsheetPreview } from "./SpreadsheetPreview";
import { SpreadsheetColumnMapping } from "./SpreadsheetColumnMapping";
import { SpreadsheetImportHistory } from "./SpreadsheetImportHistory";

import { SpreadsheetFilePicker } from "./SpreadsheetFilePicker";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MarketplaceApiClient,
  SupplierImportBatchResponse,
  SupplierImportDiagnosticsResponse,
} from "@marketplace/api-client";
import {
  importPriceMinor,
  type SupplierColumnMappingInput,
  type SupplierImportPreview,
  type SupplierImportTaxPreview,
} from "@marketplace/schemas";
import { type ImportVatOptionsValue } from "./import-vat-options";
import { Tab } from "@fluentui/react-components";
import {
  DmHeading,
  DmTabList,
  DmButton,
  DmField,
  DmInput,
  DmDropdown,
  DmTable,
  ErrorState,
  StatusTag,
  useUnsavedChanges,
  productWorkflowStyles as styles,
  errorMessage,
  formatStatus,
} from "@marketplace/ui";
import type { SupplierDataSource } from "./types";

const fields = [
  ["externalId", "Код строки", "Код"],
  ["name", "Название товара", "Название"],
  ["supplierSku", "Артикул поставщика", "Артикул"],
  ["gtin", "Штрихкод", "Штрихкод"],
  ["priceMinor", "Цена", "Цена"],
  ["currency", "Валюта", "Валюта"],
  ["quantityOnHand", "Остаток", "Остаток"],
  ["unit", "Единица измерения", "Единица"],
  ["brand", "Бренд", "Бренд"],
  ["manufacturer", "Производитель", "Производитель"],
  ["lotNumber", "Номер партии", "Партия"],
  ["expirationDate", "Срок годности", "Срок годности"],
  ["vatMode", "Режим НДС", "Режим НДС"],
  ["vatRate", "Ставка НДС", "Ставка НДС"],
  ["vatBasis", "Основание НДС", "Основание НДС"],
] as const;

export function SpreadsheetImport({
  api,
  supplierId,
  sources,
  onChanged,
  hideHeading = false,
}: {
  api: MarketplaceApiClient;
  supplierId: string;
  sources: SupplierDataSource[];
  onChanged: () => Promise<void>;
  hideHeading?: boolean;
}) {
  const [tab, setTab] = useState<"new" | "history">("new"),
    [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<SupplierImportPreview | null>(null);
  const [sourceId, setSourceId] = useState(""),
    [createdSource, setCreatedSource] = useState<SupplierDataSource | null>(
      null,
    );
  const [mapping, setMapping] = useState<Record<string, string>>({}),
    [priceUnit, setPriceUnit] = useState<"MAJOR" | "MINOR">("MAJOR");
  const [taxOptions, setTaxOptions] = useState<ImportVatOptionsValue | null>(
      null,
    ),
    [taxPreview, setTaxPreview] = useState<SupplierImportTaxPreview | null>(
      null,
    );
  const columnMapping = {
    ...Object.fromEntries(Object.entries(mapping).filter(([, value]) => value)),
    priceUnit,
    ...taxOptions,
  } as SupplierColumnMappingInput;
  const [batch, setBatch] = useState<SupplierImportBatchResponse | null>(null),
    [diagnostics, setDiagnostics] =
      useState<SupplierImportDiagnosticsResponse | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [unknownCreation, setUnknownCreation] = useState(false);
  const [filter, setFilter] = useState<RowFilter>("all"),
    [page, setPage] = useState(0),
    [reason, setReason] = useState("");
  const [history, setHistory] = useState<SupplierImportBatchResponse[] | null>(
      null,
    ),
    [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false),
    [historyError, setHistoryError] = useState<string | null>(null);
  const lock = useRef(false),
    historySequence = useRef(0),
    fileInput = useRef<HTMLInputElement>(null),
    content = useRef(""),
    batchId = useRef<string | null>(null);
  useUnsavedChanges(Boolean(file && !batch && !unknownCreation));
  const fileType = file?.name.toLowerCase().endsWith(".xlsx") ? "EXCEL" : "CSV";
  const availableSources = [
    ...sources,
    ...(createdSource &&
    !sources.some((source) => source.id === createdSource.id)
      ? [createdSource]
      : []),
  ].filter((source) => source.type === fileType && source.status === "ACTIVE");
  const loadHistory = useCallback(
    async (cursor?: string) => {
      const request = ++historySequence.current;
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const rows = await api.listSupplierImportBatches(
          supplierId,
          cursor ? { cursor } : {},
        );
        if (request !== historySequence.current) return;
        setHistory((current) =>
          cursor ? [...(current ?? []), ...rows] : rows,
        );
        setHistoryHasMore(rows.length === 50);
      } catch (cause) {
        if (request === historySequence.current)
          setHistoryError(errorMessage(cause));
      } finally {
        if (request === historySequence.current) setHistoryLoading(false);
      }
    },
    [api, supplierId],
  );
  useEffect(() => {
    void loadHistory();
    return () => {
      historySequence.current++;
    };
  }, [loadHistory]);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const readFile = () =>
    run(async () => {
      if (!file || !/\.(csv|xlsx)$/i.test(file.name))
        throw new Error("Выберите файл CSV или XLSX.");
      if (!file.size || file.size > 20_000_000)
        throw new Error("Файл должен быть непустым и не больше 20 МБ.");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () =>
          reject(
            new Error("Не удалось прочитать файл. Выберите его повторно."),
          );
        reader.readAsDataURL(file);
      });
      const result = await api.previewSupplierImport(supplierId, {
        fileName: file.name,
        fileType,
        contentBase64: base64,
      });
      content.current = base64;
      setPreview(result);
      setMapping(
        Object.fromEntries(
          fields.map(([key, label, header]) => [
            key,
            result.headers.find((item) =>
              [
                header.toLowerCase(),
                label.toLowerCase(),
                key.toLowerCase(),
              ].includes(item.toLowerCase()),
            ) ?? "",
          ]),
        ),
      );
      setStep(1);
    });
  const rows = (preview?.rows ?? []).map((row) => {
    const value = (key: string) =>
      String(row.rawData[mapping[key] ?? ""] ?? "").trim();
    const price = value("priceMinor"),
      minor = price ? importPriceMinor(price, priceUnit) : null,
      quantity = value("quantityOnHand");
    const issue =
      !value("externalId") || !value("name")
        ? "Нужны код и название"
        : price && !minor
          ? "Некорректная цена"
          : quantity && !/^\d+(?:\.\d{1,6})?$/.test(quantity)
            ? "Некорректный остаток"
            : value("expirationDate") &&
                Number.isNaN(Date.parse(value("expirationDate")))
              ? "Некорректная дата"
              : null;
    const attention =
      !price || !value("currency")
        ? "Нужны цена и валюта"
        : value("currency").toUpperCase() !== "KZT"
          ? "Поддерживается валюта KZT"
          : value("expirationDate") &&
              new Date(value("expirationDate")) <= new Date()
            ? "Срок годности истёк"
            : null;
    const tax = taxPreview?.items.find(
      (item) => item.rowNumber === row.rowNumber,
    );
    const taxIssue =
      tax?.kind === "ERROR"
        ? tax.issue
        : tax?.kind === "UNKNOWN"
          ? "Укажите налоговый режим нового предложения"
          : null;
    return {
      ...row,
      name: value("name"),
      sku: value("supplierSku") || value("externalId"),
      quantity,
      minor: tax?.amountMinor ?? minor,
      tax,
      issue: issue ?? taxIssue ?? attention,
      state: (issue || taxIssue
        ? "error"
        : attention
          ? "attention"
          : "ready") as RowFilter,
    };
  });
  const selectedRows = rows.filter(
      (row) => filter === "all" || row.state === filter,
    ),
    errors = rows.filter((row) => row.state === "error").length;
  const process = () =>
    run(async () => {
      if (!batchId.current) {
        if (
          !file ||
          !preview ||
          !rows.length ||
          errors ||
          !taxPreview ||
          !taxOptions
        )
          throw new Error(
            "Проверьте строки и налоговые условия перед загрузкой.",
          );
        let selected = availableSources.find(
          (source) => source.id === sourceId,
        );
        if (sourceId && !selected)
          throw new Error("Выберите источник для этого формата файла.");
        if (!selected) {
          selected = await api.post<SupplierDataSource>(
            `/suppliers/${supplierId}/data-sources`,
            {
              name: `Прайс ${fileType === "EXCEL" ? "Excel" : "CSV"}`,
              type: fileType,
            },
          );
          setCreatedSource(selected);
          setSourceId(selected.id);
        }
        let created: SupplierImportBatchResponse;
        try {
          created = await api.createSupplierImportBatch(supplierId, {
            sourceId: selected.id,
            fileName: file.name,
            fileType,
            contentBase64: content.current,
            columnMapping,
            taxPreviewHash: taxPreview.previewHash,
          });
        } catch (cause) {
          const status =
            cause && typeof cause === "object" && "status" in cause
              ? Number(cause.status)
              : 0;
          if (status === 409) {
            setTaxPreview(null);
            setStep(1);
            throw new Error(
              "Условия предложений или налоговый профиль изменились. Проверьте данные повторно; файл и столбцы сохранены.",
            );
          }
          if (!status || status >= 500 || status === 408) {
            setUnknownCreation(true);
            throw new Error(
              `Не удалось подтвердить создание загрузки. Проверьте историю перед повторной отправкой. ${errorMessage(cause)}`,
            );
          }
          throw cause;
        }
        batchId.current = created.id;
        setBatch(created);
      }
      const processed = await api.processSupplierImportBatch(
        supplierId,
        batchId.current!,
      );
      setBatch(processed);
      setBatch(await api.getSupplierImportBatch(supplierId, batchId.current!));
      setDiagnostics(
        await api.getSupplierImportDiagnostics(supplierId, batchId.current!),
      );
      await onChanged();
      await loadHistory();
    });
  const refresh = () =>
    run(async () => {
      if (!batch) return;
      setBatch(await api.getSupplierImportBatch(supplierId, batch.id));
      setDiagnostics(
        await api.getSupplierImportDiagnostics(supplierId, batch.id),
      );
      await loadHistory();
    });
  const reset = () => {
    setTaxPreview(null);
    setTaxOptions(null);
    setBatch(null);
    batchId.current = null;
    setDiagnostics(null);
    setFile(null);
    setPreview(null);
    content.current = "";
    setStep(0);
    setReason("");
    setError(null);
    setUnknownCreation(false);
    setTab("new");
  };
  return (
    <div className={styles.form}>
      {!hideHeading ? <h2>Импорт товаров</h2> : null}
      <DmTabList
        aria-label="Импорт"
        selectedValue={tab}
        onTabSelect={(_, data) => {
          const value = data.value as "new" | "history";
          setTab(value);
          if (value === "history") void loadHistory();
        }}
      >
        <Tab value="new">Новая загрузка</Tab>
        <Tab value="history">История загрузок</Tab>
      </DmTabList>
      {tab === "history" ? (
        <SpreadsheetImportHistory
          historyError={historyError}
          loadHistory={loadHistory}
          history={history}
          historyLoading={historyLoading}
          setTab={setTab}
          busy={busy}
          file={file}
          batch={batch}
          run={run}
          api={api}
          supplierId={supplierId}
          setBatch={setBatch}
          batchId={batchId}
          setDiagnostics={setDiagnostics}
          setReason={setReason}
          setStep={setStep}
          historyHasMore={historyHasMore}
        />
      ) : (
        <div className={`${styles.panel} ${styles.form}`}>
          {error ? <ErrorState description={error} /> : null}
          {batch ? (
            <section className={styles.form}>
              <div className={styles.toolbar}>
                <h2>{batch.fileName}</h2>
                <StatusTag>
                  {batch.status === "MAPPED"
                    ? "Ожидает обработки"
                    : formatStatus(batch.status)}
                </StatusTag>
              </div>
              <p role="status">
                Всего строк: {batch.totalRows} · обработано:{" "}
                {diagnostics?.processedRows ?? batch.processedRows} · ошибок:{" "}
                {diagnostics?.errorRows ?? batch.errorRows}
              </p>
              {diagnostics?.byStatus.MATCH_PENDING ? (
                <p className={styles.notice}>
                  Требуют сопоставления: {diagnostics.byStatus.MATCH_PENDING}.
                  Эти строки ещё не стали предложениями каталога.
                </p>
              ) : null}
              <DmTable
                caption="Результат обработки строк"
                columns={[
                  { key: "name", label: "Товар" },
                  { key: "row", label: "Строка" },
                  { key: "status", label: "Результат" },
                ]}
              >
                {(batch.rows ?? []).map((row) => (
                  <tr key={row.id}>
                    <td data-label="Товар">
                      <div>
                        {String(
                          row.rawData[
                            String(batch.columnMapping?.name ?? "")
                          ] ?? "Без названия",
                        )}
                      </div>
                    </td>
                    <td data-label="Строка">
                      <div>{row.rowNumber}</div>
                    </td>
                    <td data-label="Результат">
                      <div>
                        {formatStatus(row.status)}
                        {row.errorMessage ? (
                          <small>{row.errorMessage}</small>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </DmTable>
              <p className={styles.hint}>
                Импорт не публикует товары автоматически. Проверьте предложения
                после обработки.
              </p>
              <div className={styles.footer}>
                {error ? (
                  <DmButton disabled={busy} onClick={() => void refresh()}>
                    Повторить загрузку результата
                  </DmButton>
                ) : null}
                {batch.status === "MAPPED" ? (
                  <DmButton
                    appearance="primary"
                    disabled={busy}
                    onClick={() => void process()}
                  >
                    Обработать загрузку
                  </DmButton>
                ) : (
                  <DmButton disabled={busy} onClick={reset}>
                    Новая загрузка
                  </DmButton>
                )}
              </div>
              {["COMPLETED", "COMPLETED_WITH_ERRORS"].includes(batch.status) ? (
                <details className={styles.disclosure}>
                  <summary>Отменить результаты загрузки</summary>
                  <div className={styles.form}>
                    <DmField
                      label="Причина отмены"
                      hint="От 10 до 500 символов. Изменения этой загрузки будут отменены; история сохранится."
                    >
                      <DmInput
                        value={reason}
                        maxLength={500}
                        disabled={busy}
                        onChange={(_, data) => setReason(data.value)}
                      />
                    </DmField>
                    <DmButton
                      disabled={busy || reason.trim().length < 10}
                      onClick={() =>
                        void run(async () => {
                          await api.rollbackSupplierImportBatch(
                            supplierId,
                            batch.id,
                            {
                              reason: reason.trim(),
                              expectedUpdatedAt: batch.updatedAt,
                            },
                          );
                          setBatch(
                            await api.getSupplierImportBatch(
                              supplierId,
                              batch.id,
                            ),
                          );
                          setDiagnostics(null);
                          await onChanged();
                          await loadHistory();
                        })
                      }
                    >
                      Подтвердить отмену загрузки
                    </DmButton>
                  </div>
                </details>
              ) : null}
            </section>
          ) : (
            <section className={styles.form}>
              {step === 0 ? (
                <>
                  <DmHeading
                    title="Загрузите прайс"
                    description="Выберите CSV с запятыми или первый лист Excel. До 20 МБ и 5 000 строк. В шаблоне Excel есть пример и пояснения к столбцам. Замените пример своими товарами; цена — в тенге."
                  />
                  <SpreadsheetFilePicker
                    file={file}
                    busy={busy}
                    fileInput={fileInput}
                    setFile={setFile}
                    setSourceId={setSourceId}
                    setPreview={setPreview}
                    setError={setError}
                  />
                  <div className={styles.toolbar}>
                    <a
                      href="/templates/supplier-price-template.xlsx"
                      download="Шаблон-прайса.xlsx"
                    >
                      Скачать шаблон Excel
                    </a>
                    <a
                      href="/templates/supplier-price-template.csv"
                      download="Шаблон-прайса.csv"
                    >
                      Скачать шаблон CSV
                    </a>
                  </div>
                  <DmField
                    label="Источник прайса"
                    hint="Для обновления прежних строк выбирайте тот же источник и сохраняйте их коды."
                  >
                    <DmDropdown
                      value={sourceId}
                      disabled={busy}
                      onChange={(_, data) => setSourceId(data.value)}
                    >
                      <option value="">Создать новый источник</option>
                      {availableSources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </DmDropdown>
                  </DmField>
                  <div className={styles.footer}>
                    <span className={styles.hint}>
                      До подтверждения предложения не изменятся
                    </span>
                    <DmButton
                      appearance="primary"
                      disabled={busy || !file}
                      onClick={() => void readFile()}
                    >
                      {busy ? "Читаем файл…" : "Настроить столбцы"}
                    </DmButton>
                  </div>
                </>
              ) : step === 1 ? (
                <SpreadsheetColumnMapping
                  columnMapping={columnMapping}
                  file={file}
                  fields={fields}
                  mapping={mapping}
                  preview={preview}
                  setMapping={setMapping}
                  priceUnit={priceUnit}
                  setPriceUnit={setPriceUnit}
                  api={api}
                  supplierId={supplierId}
                  busy={busy}
                  setTaxOptions={setTaxOptions}
                  setStep={setStep}
                  taxOptions={taxOptions}
                  run={run}
                  setTaxPreview={setTaxPreview}
                  setFilter={setFilter}
                  setPage={setPage}
                />
              ) : step === 2 ? (
                <SpreadsheetPreview
                  file={file}
                  rows={rows}
                  taxPreview={taxPreview}
                  filter={filter}
                  setFilter={setFilter}
                  setPage={setPage}
                  selectedRows={selectedRows}
                  page={page}
                  errors={errors}
                  setStep={setStep}
                />
              ) : (
                <SpreadsheetConfirmation
                  file={file}
                  rows={rows}
                  availableSources={availableSources}
                  sourceId={sourceId}
                  priceUnit={priceUnit}
                  busy={busy}
                  unknownCreation={unknownCreation}
                  setStep={setStep}
                  process={process}
                  setTab={setTab}
                  loadHistory={loadHistory}
                />
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
