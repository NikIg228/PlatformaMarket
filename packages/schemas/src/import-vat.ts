import { vatSelectionSchema, type VatSelection } from "./vat";

type TaxColumns = { vatMode?: string; vatRate?: string; vatBasis?: string };
/** Blank cells mean preserve/inherit; any explicit cell requires a valid complete declaration. */
export function importVatSelection(row: Record<string, unknown>, columns: TaxColumns): VatSelection | undefined {
  const cell = (column?: string) => column ? String(row[column] ?? "").trim() : "";
  const mode = cell(columns.vatMode), rate = cell(columns.vatRate), basis = cell(columns.vatBasis);
  if (!mode && !rate && !basis) return undefined;
  return vatSelectionSchema.parse({ mode, rate: rate || null, basis: basis || null });
}
