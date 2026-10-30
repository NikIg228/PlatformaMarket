import type {
  SupplierImportPreview,
  SupplierImportTaxPreview,
} from "@marketplace/schemas";
import type { RowFilter } from "./spreadsheet-import-types";

export type SpreadsheetPreviewRow = SupplierImportPreview["rows"][number] & {
  name: string;
  sku: string;
  quantity: string;
  minor: string | null;
  tax: SupplierImportTaxPreview["items"][number] | undefined;
  issue: string | null;
  state: RowFilter;
};
