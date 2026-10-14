import { describe, expect, it } from "vitest";
import { calculateVatLine, type VatPriceSnapshot } from "@marketplace/schemas";
import { documentTaxTemplate, documentVat } from "./document-vat";
const declaration: VatPriceSnapshot = {
  selection: { mode: "TAXABLE", rate: "16", basis: null }, ruleId: "KZ_STANDARD_2026_V1", source: "EXPLICIT", defaultVersion: null,
  declaredAt: "2026-10-14T12:00:00.000Z", declaredById: "00000000-0000-4000-8000-000000000001",
  profile: { revisionId: "00000000-0000-4000-8000-000000000002", version: 1, organizationVersion: 1, taxPeriodId: "00000000-0000-4000-8000-000000000003", status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null },
};
describe("immutable document tax", () => {
  it("adds a visible invoice summary to the saved template without duplicating a template field", () => {
    const data = { invoice: { taxSummary: "НДС 16%: 16.00" } };
    expect(documentTaxTemplate("INVOICE", "Счёт", data)).toContain("{{invoice.taxSummary}}");
    expect(documentTaxTemplate("INVOICE", "{{invoice.taxSummary}}", data)).toBe("{{invoice.taxSummary}}");
    expect(documentTaxTemplate("INVOICE", "Исторический счёт", {})).toBe("Исторический счёт");
  });
  it("uses the accepted amount and original declaration, summing rounded lines", () => {
    const snapshot = { pricing: { tax: calculateVatLine("200", declaration) } };
    const result = documentVat(Array.from({ length: 3 }, () => ({ offerSnapshot: snapshot, totalPriceMinor: "100" })));
    expect(result.totals[0]).toMatchObject({ grossMinor: "300", baseMinor: "258", vatMinor: "42" });
    expect(result.lineText[0]).toBe("Включая НДС 16%; база 0.86; НДС 0.14");
    expect(snapshot.pricing.tax.grossMinor).toBe("200");
  });
  it("keeps unknown historical rows separate from an explicit zero tax", () => {
    const result = documentVat([{ offerSnapshot: {}, totalPriceMinor: "100" }, { offerSnapshot: { pricing: { tax: calculateVatLine("100", { ...declaration, selection: { mode: "EXEMPT", rate: null, basis: "Основание поставщика" } }) } }, totalPriceMinor: "100" }]);
    expect(result.unknownCount).toBe(1); expect(result.totals[0]).toMatchObject({ label: "Освобождено от НДС", vatMinor: "0" });
    expect(result.summary).toContain("НДС не уточнён: строк 1");
  });
  it("does not issue a false breakdown from malformed persisted tax", () => {
    expect(() => documentVat([{ offerSnapshot: { pricing: { tax: {} } }, totalPriceMinor: "100" }])).toThrow();
  });
});
