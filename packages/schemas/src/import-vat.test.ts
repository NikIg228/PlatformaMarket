import { describe, expect, it } from "vitest";
import { importVatSelection } from "./import-vat";

const columns = { vatMode: "Режим", vatRate: "Ставка", vatBasis: "Основание" };
describe("import VAT cells", () => {
  it("distinguishes blank cells from an explicit zero rate", () => {
    expect(importVatSelection({ Режим: " ", Ставка: null }, columns)).toBeUndefined();
    expect(importVatSelection({ Режим: "ZERO_RATED", Ставка: 0, Основание: "Основание поставщика" }, columns)).toEqual({ mode: "ZERO_RATED", rate: "0", basis: "Основание поставщика" });
  });
  it("does not discard invalid explicit values or infer a mode", () => {
    for (const row of [{ Ставка: "16" }, { Режим: "TAXABLE", Ставка: "18" }, { Режим: "EXEMPT" }, { Режим: "NOT_VAT_PAYER", Ставка: "0" }])
      expect(() => importVatSelection(row, columns)).toThrow();
  });
  it("accepts a complete reduced-rate declaration and ignores unmapped columns", () => {
    expect(importVatSelection({ Режим: "TAXABLE", Ставка: 5, Основание: "Перечень поставщика" }, columns)).toMatchObject({ mode: "TAXABLE", rate: "5" });
    expect(importVatSelection({ Ставка: 18 }, {})).toBeUndefined();
  });
});
