import { describe, expect, it } from "vitest";
import { calculateVatLine, grossFromNetMinor, sumVatLines, sameAcceptedVat, vatCalendarDate, vatRule, vatSelectionSchema, type VatPriceSnapshot } from "./vat";
const declaration: VatPriceSnapshot = { selection: { mode: "TAXABLE", rate: "16", basis: null }, ruleId: "KZ_STANDARD_2026_V1",
  declaredAt: "2026-10-14T10:00:00.000Z", declaredById: "00000000-0000-4000-8000-000000000001", source: "EXPLICIT", defaultVersion: null,
  profile: { revisionId: "00000000-0000-4000-8000-000000000002", version: 1, organizationVersion: 1,
    taxPeriodId: "00000000-0000-4000-8000-000000000003", status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null } };
describe("supplier VAT contract and exact arithmetic", () => {
  it("requires buyer reconfirmation for tax terms, not declaration timestamps or JSON key order", () => {
    const line = calculateVatLine("11600", declaration);
    expect(sameAcceptedVat(undefined, null)).toBe(true);
    expect(sameAcceptedVat(null, line)).toBe(false);
    expect(sameAcceptedVat(line, { ...line, declaration: { ...declaration, declaredAt: "2026-10-15T10:00:00.000Z", selection: { basis: null, rate: "16", mode: "TAXABLE" } } })).toBe(true);
    expect(sameAcceptedVat(line, { ...line, declaration: { ...declaration, profile: { ...declaration.profile, version: 2 } } })).toBe(false);
    expect(sameAcceptedVat(line, { ...line, declaration: { ...declaration, selection: { ...declaration.selection, basis: "Уточнённое основание" } } })).toBe(false);
  });
  it("extracts included tax without changing the payable amount", () => {
    expect(calculateVatLine("100000", declaration)).toMatchObject({ grossMinor: "100000", vatMinor: "13793", baseMinor: "86207" });
    expect(calculateVatLine("1160000", declaration)).toMatchObject({ vatMinor: "160000", baseMinor: "1000000" });
  });
  it("rounds the complete line, sums rounded lines and never recomputes document VAT", () => {
    const line = calculateVatLine("100", declaration);
    expect(sumVatLines([line, line, line])).toEqual({ grossMinor: "300", baseMinor: "258", vatMinor: "42" });
    expect(calculateVatLine("300", declaration).vatMinor).toBe("41");
  });
  it("uses exact tie rounding and preserves amounts above Number.MAX_SAFE_INTEGER", () => {
    const at16 = calculateVatLine("29", declaration); expect(at16.vatMinor).toBe("4");
    const at5 = { ...declaration, selection: { mode: "TAXABLE" as const, rate: "5" as const, basis: "Перечень №1204, подтверждено поставщиком" } };
    const line = calculateVatLine("99999999999999999999", at5);
    expect(BigInt(line.baseMinor) + BigInt(line.vatMinor)).toBe(99999999999999999999n);
    expect(grossFromNetMinor("1", { ...at5.selection, rate: "10" })).toBe("1");
    expect(grossFromNetMinor("5", { ...at5.selection, rate: "10" })).toBe("6");
  });
  it.each(["NOT_VAT_PAYER", "EXEMPT", "ZERO_RATED"] as const)("keeps %s distinct even with zero tax", mode => {
    const selection = { mode, rate: mode === "ZERO_RATED" ? "0" as const : null, basis: mode === "NOT_VAT_PAYER" ? null : "Подтверждённое основание" };
    expect(calculateVatLine("100000", { ...declaration, selection })).toMatchObject({ vatMinor: "0", baseMinor: "100000", declaration: { selection: { mode } } });
  });
  it("requires basis and rejects contradictory, arbitrary and unknown rates", () => {
    for (const value of [{ mode: "EXEMPT", rate: "16", basis: "Основание" }, { mode: "TAXABLE", rate: "5", basis: null },
      { mode: "TAXABLE", rate: "12", basis: "Основание" }, { mode: "NOT_VAT_PAYER", rate: "0", basis: null }]) expect(vatSelectionSchema.safeParse(value).success).toBe(false);
    expect(() => calculateVatLine("1.5", declaration)).toThrow(); expect(() => calculateVatLine("-1", declaration)).toThrow();
  });
  it("uses Kazakhstan dates and does not apply the 2027 reduced rate in 2026", () => {
    const tax = { mode: "TAXABLE" as const, rate: "10" as const, basis: "Перечень №1204" };
    expect(vatRule(tax, "2026-12-31")).toBeNull(); expect(vatRule(tax, "2027-01-01")).toBe("KZ_MEDICAL_2027_V1");
    expect(vatRule({ ...tax, rate: "5" }, "2027-01-01")).toBeNull();
    expect(vatCalendarDate(new Date("2026-12-31T19:00:00Z"))).toBe("2027-01-01");
  });
});
