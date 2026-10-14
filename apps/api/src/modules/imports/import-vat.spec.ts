import { describe, expect, it, vi } from "vitest";
import { resolveImportPrice } from "./import-vat";
import { resolvePriceVat } from "../vat/vat-rules";
vi.mock("../vat/vat-rules", () => ({ resolvePriceVat: vi.fn() }));

const mapping = { externalId: "id", name: "name", vatMode: "mode", vatRate: "rate", vatBasis: "basis", expectedRequisitesVersion: 3, taxAcknowledged: true as const };
describe("import price normalization", () => {
  it("preserves legacy flags and gross amount for an existing blank row", async () => {
    vi.mocked(resolvePriceVat).mockResolvedValue(null);
    const previous = { taxSnapshot: null, includesVat: false, vatRate: null };
    const result = await resolveImportPrice({} as never, "supplier", "actor", {}, mapping, "12345", previous);
    expect(result).toMatchObject({ amountMinor: "12345", includesVat: false, vatRate: null });
    expect(resolvePriceVat).toHaveBeenLastCalledWith({}, "supplier", "actor", previous, undefined, undefined, undefined);
  });
  it("normalizes a net amount once and keeps gross input unchanged", async () => {
    vi.mocked(resolvePriceVat).mockResolvedValue({ selection: { mode: "TAXABLE", rate: "16", basis: null } } as never);
    expect(await resolveImportPrice({} as never, "supplier", "actor", {}, { ...mapping, priceIncludesVat: false }, "10001", null)).toMatchObject({ amountMinor: "11601", includesVat: true, vatRate: 16 });
    expect(await resolveImportPrice({} as never, "supplier", "actor", {}, { ...mapping, priceIncludesVat: true }, "11601", null)).toMatchObject({ amountMinor: "11601" });
  });
  it("rejects invalid explicit input instead of inheriting the default", async () => {
    await expect(resolveImportPrice({} as never, "supplier", "actor", { mode: "TAXABLE", rate: 18 }, mapping, "100", null)).rejects.toMatchObject({ status: 400 });
    await expect(resolveImportPrice({} as never, "supplier", "actor", { mode: "TAXABLE", rate: 16 }, { ...mapping, taxAcknowledged: undefined }, "100", null)).rejects.toMatchObject({ status: 400 });
  });
  it("cannot calculate gross from a net price with unknown tax treatment", async () => {
    vi.mocked(resolvePriceVat).mockResolvedValue(null);
    await expect(resolveImportPrice({} as never, "supplier", "actor", {}, { ...mapping, priceIncludesVat: false }, "100", { taxSnapshot: null })).rejects.toMatchObject({ status: 400 });
  });
});
