import { DmButton, productWorkflowStyles as styles } from "@marketplace/ui";
import type { SupplierDataSource } from "./types";

import type { SpreadsheetPreviewRow } from "./spreadsheet-preview-types";

import type { Dispatch, SetStateAction } from "react";

type Props = {
  file: File | null;
  rows: SpreadsheetPreviewRow[];
  availableSources: SupplierDataSource[];
  sourceId: string;
  priceUnit: "MAJOR" | "MINOR";
  busy: boolean;
  unknownCreation: boolean;
  setStep: Dispatch<SetStateAction<number>>;
  process: () => Promise<void>;
  setTab: Dispatch<SetStateAction<"new" | "history">>;
  loadHistory: (cursor?: string | undefined) => Promise<void>;
};

export function SpreadsheetConfirmation({
  file,
  rows,
  availableSources,
  sourceId,
  priceUnit,
  busy,
  unknownCreation,
  setStep,
  process,
  setTab,
  loadHistory,
}: Props) {
  return (
    <>
      <h2>Подтвердите загрузку</h2>
      <dl className={styles.metadata}>
        <dt>Файл</dt>
        <dd>{file?.name}</dd>
        <dt>Строк</dt>
        <dd>{rows.length}</dd>
        <dt>Источник</dt>
        <dd>
          {availableSources.find((source) => source.id === sourceId)?.name ??
            "Новый источник прайса"}
        </dd>
        <dt>Цена в файле</dt>
        <dd>{priceUnit === "MAJOR" ? "Тенге" : "Тиыны"}</dd>
      </dl>
      <p className={styles.notice}>
        Цены и остатки сопоставленных товаров будут обновлены. Новые и
        неизвестные товары могут потребовать проверки. Публикация не выполняется
        автоматически.
      </p>
      <div className={styles.footer}>
        <DmButton disabled={busy || unknownCreation} onClick={() => setStep(2)}>
          Назад к проверке
        </DmButton>
        <DmButton
          appearance="primary"
          disabled={busy || unknownCreation}
          onClick={() => void process()}
        >
          {busy ? "Обрабатываем…" : "Подтвердить и обработать"}
        </DmButton>
      </div>
      {unknownCreation ? (
        <DmButton
          onClick={() => {
            setTab("history");
            void loadHistory();
          }}
        >
          Проверить историю загрузок
        </DmButton>
      ) : null}
    </>
  );
}
