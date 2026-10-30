import { DmFileInput } from "@marketplace/ui/controls";

import { type SupplierImportPreview } from "@marketplace/schemas";

import { DmButton } from "@marketplace/ui";

import local from "./spreadsheet-import.module.css";

import type { Dispatch, SetStateAction, RefObject } from "react";

type Props = {
  file: File | null;
  busy: boolean;
  fileInput: RefObject<HTMLInputElement | null>;
  setFile: Dispatch<SetStateAction<File | null>>;
  setSourceId: Dispatch<SetStateAction<string>>;
  setPreview: Dispatch<SetStateAction<SupplierImportPreview | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function SpreadsheetFilePicker({
  file,
  busy,
  fileInput,
  setFile,
  setSourceId,
  setPreview,
  setError,
}: Props) {
  return (
    <div className={local.upload}>
      <strong>{file?.name ?? "Выберите файл с товарами"}</strong>
      <span>Название, цена, остаток и артикул — в отдельных столбцах</span>
      <DmButton disabled={busy} onClick={() => fileInput.current?.click()}>
        {file ? "Выбрать другой файл" : "Выбрать файл CSV или XLSX"}
      </DmButton>
      <DmFileInput
        ref={fileInput}
        hidden
        aria-label="Таблица поставщика"
        accept=".csv,.xlsx"
        disabled={busy}
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setSourceId("");
          setPreview(null);
          setError(null);
        }}
      />
    </div>
  );
}
