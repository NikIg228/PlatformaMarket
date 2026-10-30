import { DmAction } from "@marketplace/ui/controls";

import { vatLabel, type SupplierImportTaxPreview } from "@marketplace/schemas";

import {
  DmHeading,
  DmButton,
  StatusTag,
  productWorkflowStyles as styles,
  formatMoney,
} from "@marketplace/ui";

import local from "./spreadsheet-import.module.css";
import type { SpreadsheetPreviewRow } from "./spreadsheet-preview-types";
import type { RowFilter } from "./spreadsheet-import-types";

import type { Dispatch, SetStateAction } from "react";

type Props = {
  file: File | null;
  rows: SpreadsheetPreviewRow[];
  taxPreview: SupplierImportTaxPreview | null;
  filter: RowFilter;
  setFilter: Dispatch<SetStateAction<RowFilter>>;
  setPage: Dispatch<SetStateAction<number>>;
  selectedRows: SpreadsheetPreviewRow[];
  page: number;
  errors: number;
  setStep: Dispatch<SetStateAction<number>>;
};

export function SpreadsheetPreview({
  file,
  rows,
  taxPreview,
  filter,
  setFilter,
  setPage,
  selectedRows,
  page,
  errors,
  setStep,
}: Props) {
  return (
    <>
      <DmHeading
        title="Проверьте данные"
        description="Проверьте значения перед загрузкой. Сопоставление ваших товаров с каталогом выполняется при обработке."
      />
      <p className={styles.hint}>
        {file?.name} · {rows.length} строк.
      </p>
      {taxPreview ? (
        <p role="status">
          НДС: наследуют настройки {taxPreview.counts.inherited} ·
          индивидуальные условия {taxPreview.counts.individual} · без изменений{" "}
          {taxPreview.counts.unchanged} · ошибок {taxPreview.counts.errors} ·
          без режима {taxPreview.counts.unknown}. Показана конечная цена с
          применимым НДС.
        </p>
      ) : null}
      <div className={local.filters}>
        {(
          [
            ["all", "Все"],
            ["ready", "Без ошибок"],
            ["attention", "Требуют внимания"],
            ["error", "Ошибки"],
          ] as const
        ).map(([value, label]) => (
          <DmAction
            variant="tab"
            key={value}
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              setPage(0);
            }}
          >
            {label}{" "}
            <span>
              {value === "all"
                ? rows.length
                : rows.filter((row) => row.state === value).length}
            </span>
          </DmAction>
        ))}
      </div>
      <table className={styles.table}>
        <caption className="dm-sr-only">
          Предварительный просмотр строк файла
        </caption>
        <thead>
          <tr>
            <th>Товар</th>
            <th>Цена</th>
            <th>Остаток</th>
            <th>Проверка</th>
          </tr>
        </thead>
        <tbody>
          {selectedRows.slice(page * 25, (page + 1) * 25).map((row) => (
            <tr key={row.rowNumber}>
              <td data-label="Товар">
                <div>
                  <strong>{row.name || "Без названия"}</strong>
                  <small>
                    {row.sku || "Нет кода"} · строка {row.rowNumber}
                  </small>
                </div>
              </td>
              <td data-label="Цена">
                <div>
                  {row.minor ? formatMoney(row.minor, "KZT") : "—"}
                  <small>
                    {row.tax?.selection
                      ? vatLabel(row.tax.selection)
                      : "НДС не подтверждён"}
                  </small>
                </div>
              </td>
              <td data-label="Остаток">
                <div>{row.quantity || "—"}</div>
              </td>
              <td data-label="Проверка">
                <div>
                  <StatusTag>
                    {row.state === "ready"
                      ? "Без ошибок формата"
                      : row.state === "error"
                        ? "Ошибка"
                        : "Требует внимания"}
                  </StatusTag>
                  {row.issue ? <small>{row.issue}</small> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!selectedRows.length ? (
        <p className={styles.hint}>В этой группе нет строк.</p>
      ) : null}
      {selectedRows.length > 25 ? (
        <div className={local.pagination}>
          <DmButton disabled={page === 0} onClick={() => setPage(page - 1)}>
            Предыдущие строки
          </DmButton>
          <span>
            {page + 1} / {Math.ceil(selectedRows.length / 25)}
          </span>
          <DmButton
            disabled={(page + 1) * 25 >= selectedRows.length}
            onClick={() => setPage(page + 1)}
          >
            Следующие строки
          </DmButton>
        </div>
      ) : null}
      {errors ? (
        <p role="alert">
          Исправьте {errors} ошибок в исходном файле или сопоставлении столбцов.
        </p>
      ) : null}
      <div className={styles.footer}>
        <DmButton onClick={() => setStep(1)}>Изменить столбцы</DmButton>
        <DmButton
          appearance="primary"
          disabled={!rows.length || errors > 0}
          onClick={() => setStep(3)}
        >
          Далее: подтверждение
        </DmButton>
      </div>
    </>
  );
}
