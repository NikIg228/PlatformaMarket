import type { MarketplaceApiClient } from "@marketplace/api-client";
import {
  type SupplierColumnMappingInput,
  type SupplierImportPreview,
  type SupplierImportTaxPreview,
} from "@marketplace/schemas";
import {
  ImportVatOptions,
  type ImportVatOptionsValue,
} from "./import-vat-options";

import {
  DmHeading,
  DmButton,
  DmField,
  DmDropdown,
  productWorkflowStyles as styles,
} from "@marketplace/ui";

import type { RowFilter } from "./spreadsheet-import-types";

import type { Dispatch, SetStateAction } from "react";

type Props = {
  file: File | null;
  fields: ReadonlyArray<readonly [string, string, string]>;
  mapping: Record<string, string>;
  columnMapping: SupplierColumnMappingInput;
  preview: SupplierImportPreview | null;
  setMapping: Dispatch<SetStateAction<Record<string, string>>>;
  priceUnit: "MAJOR" | "MINOR";
  setPriceUnit: Dispatch<SetStateAction<"MAJOR" | "MINOR">>;
  api: MarketplaceApiClient;
  supplierId: string;
  busy: boolean;
  setTaxOptions: Dispatch<SetStateAction<ImportVatOptionsValue | null>>;
  setStep: Dispatch<SetStateAction<number>>;
  taxOptions: ImportVatOptionsValue | null;
  run: (action: () => Promise<void>) => Promise<void>;
  setTaxPreview: Dispatch<SetStateAction<SupplierImportTaxPreview | null>>;
  setFilter: Dispatch<SetStateAction<RowFilter>>;
  setPage: Dispatch<SetStateAction<number>>;
};

export function SpreadsheetColumnMapping({
  file,
  fields,
  columnMapping,
  mapping,
  preview,
  setMapping,
  priceUnit,
  setPriceUnit,
  api,
  supplierId,
  busy,
  setTaxOptions,
  setStep,
  taxOptions,
  run,
  setTaxPreview,
  setFilter,
  setPage,
}: Props) {
  return (
    <>
      <DmHeading
        title="Сопоставьте столбцы"
        description="Выберите столбец вашего файла для каждого поля. Код и название обязательны."
      />
      <p className={styles.hint}>{file?.name}</p>
      <div className={styles.fields}>
        {fields.map(([key, label]) => (
          <DmField
            key={key}
            label={label}
            required={key === "externalId" || key === "name"}
            hint={
              mapping[key]
                ? `Пример: ${String(preview?.rows[0]?.rawData[mapping[key]!] ?? "—").slice(0, 100)}`
                : undefined
            }
          >
            <DmDropdown
              aria-label={label}
              value={mapping[key] ?? ""}
              onChange={(_, data) =>
                setMapping((current) => ({
                  ...current,
                  [key]: data.value,
                }))
              }
            >
              <option value="">Не импортировать</option>
              {preview?.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </DmDropdown>
          </DmField>
        ))}
        <DmField label="Цена в файле">
          <DmDropdown
            value={priceUnit}
            onChange={(_, data) =>
              setPriceUnit(data.value as "MAJOR" | "MINOR")
            }
          >
            <option value="MAJOR">Тенге (1 250 = 1 250 ₸)</option>
            <option value="MINOR">Тиыны (125000 = 1 250 ₸)</option>
          </DmDropdown>
        </DmField>
      </div>
      <ImportVatOptions
        api={api}
        supplierId={supplierId}
        disabled={busy}
        onChange={setTaxOptions}
      />
      <div className={styles.footer}>
        <DmButton disabled={busy} onClick={() => setStep(0)}>
          Назад
        </DmButton>
        <DmButton
          appearance="primary"
          disabled={busy || !mapping.externalId || !mapping.name || !taxOptions}
          onClick={() =>
            void run(async () => {
              if (!preview) return;
              setTaxPreview(
                await api.previewSupplierImportTax(supplierId, {
                  columnMapping,
                  rows: preview.rows,
                }),
              );
              setFilter("all");
              setPage(0);
              setStep(2);
            })
          }
        >
          {busy ? "Проверяем условия…" : "Проверить данные"}
        </DmButton>
      </div>
    </>
  );
}
