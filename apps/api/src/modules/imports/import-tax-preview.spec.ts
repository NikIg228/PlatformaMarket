import { describe, expect, it, vi } from "vitest";
import { previewImportTax } from "./import-tax-preview";
import { resolveImportPrice } from "./import-vat";
vi.mock("./import-vat", () => ({ resolveImportPrice: vi.fn() }));
vi.mock("./matching", async importOriginal => ({ ...await importOriginal<typeof import("./matching")>(),
      rankVariants: vi.fn((row, variants) => variants.map((variant: { id: string }) => ({ variant: { ...variant, id: row.supplierSku || variant.id }, score: 1, reasons: ["gtin"] }))),
  isConfidentAutomaticMatch: vi.fn(candidates => candidates.length === 1),
}));
const selection = { mode: "TAXABLE" as const, rate: "16" as const, basis: null };
const declaration = { selection, profile: { version: 1 }, ruleId: "standard", defaultVersion: 2 };
const mapping = { externalId: "id", supplierSku: "id", name: "name", priceMinor: "price", vatMode: "mode", vatRate: "rate" };
function fixture() {
  const db = { productVariant: { findMany: vi.fn().mockResolvedValue([{ id: "variant", saleUnitId: "unit", product: { canonicalName: "Товар" } }]) },
    supplierMappingMemory: { findMany: vi.fn().mockResolvedValue([]) }, supplierOffer: { findFirst: vi.fn().mockResolvedValue(null) } };
  vi.mocked(resolveImportPrice).mockResolvedValue({ amountMinor: "11600", declaration } as never);
  return db;
}
describe("tax import preview", () => {
  it("rejects multiple rows targeting the same offer before processing", async () => {
    const db = fixture();
    const result = await previewImportTax(db as never, "supplier", "actor", { columnMapping: mapping,
      rows: [2, 3].map(rowNumber => ({ rowNumber, rawData: { id: "same", name: "Товар", price: "10000" } })) });
    expect(result.counts.errors).toBe(2); expect(result.items.every(item => item.issue?.includes("Несколько строк"))).toBe(true);
  });
  it("shows explicit, inherited and invalid rows before any mutation", async () => {
    const db = fixture();
    const rows: import("@marketplace/schemas").SupplierImportTaxPreviewInput["rows"] = [{ rowNumber: 2, rawData: { id: "1", name: "Товар", price: "10000" } },
      { rowNumber: 3, rawData: { id: "2", name: "Товар", price: "10000", mode: "TAXABLE", rate: "16" } },
      { rowNumber: 4, rawData: { id: "3", name: "Товар", price: "10000", mode: "TAXABLE", rate: "18" } }];
    const result = await previewImportTax(db as never, "supplier", "actor", { columnMapping: mapping, rows });
    expect(result.counts).toMatchObject({ inherited: 1, individual: 1, errors: 1 });
    expect(result.items[0]).toMatchObject({ amountMinor: "11600", selection });
    expect(result.items[2].issue).toBeTruthy();
  });
  it("binds the exact existing price and profile while preserving blank updates", async () => {
    const db = fixture(); const offer = { id: "offer", version: 1, prices: [{ id: "price", taxSnapshot: declaration }] };
    db.supplierOffer.findFirst.mockResolvedValue(offer);
    const input = { columnMapping: mapping, rows: [{ rowNumber: 2, rawData: { id: "1", name: "Товар", price: "10000" } }] };
    const first = await previewImportTax(db as never, "supplier", "actor", input);
    expect(first.counts.unchanged).toBe(1);
    expect(resolveImportPrice).toHaveBeenLastCalledWith(db, "supplier", "actor", input.rows[0].rawData, mapping, "10000", offer.prices[0]);
    expect((await previewImportTax(db as never, "supplier", "actor", input)).previewHash).toBe(first.previewHash);
    offer.prices[0].id = "new-price";
    expect((await previewImportTax(db as never, "supplier", "actor", input)).previewHash).not.toBe(first.previewHash);
  });
  it("does not present an unknown legacy treatment as zero VAT", async () => {
    const db = fixture(); vi.mocked(resolveImportPrice).mockResolvedValue({ amountMinor: "10000", declaration: null } as never);
    const result = await previewImportTax(db as never, "supplier", "actor", { columnMapping: mapping, rows: [{ rowNumber: 2, rawData: { id: "1", name: "Товар", price: "10000" } }] });
    expect(result.counts.unknown).toBe(1); expect(result.items[0].selection).toBeNull();
  });
});
