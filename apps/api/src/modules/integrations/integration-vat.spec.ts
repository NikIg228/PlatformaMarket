import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { type VatPriceSnapshot } from "@marketplace/schemas";
import { IntegrationExecutionService } from "./integration-execution.service";
import { resolveImportPrice } from "../imports/import-vat";
vi.mock("../imports/import-vat", () => ({ resolveImportPrice: vi.fn() }));
const tax = { selection: { mode: "TAXABLE", rate: "16", basis: null }, ruleId: "KZ_STANDARD_2026_V1", profile: { version: 1 } } as VatPriceSnapshot;
function fixture() {
  const price = { source: "API", amountMinor: new Prisma.Decimal("11600"), currency: "KZT", taxSnapshot: null };
  const db = {
    integrationDataBinding: { findMany: vi.fn().mockResolvedValue([{ configuration: {} }]) },
    offerPrice: { findFirst: vi.fn().mockResolvedValue(price), updateMany: vi.fn(), create: vi.fn() },
    offerPriceHistory: { create: vi.fn() }, supplierOffer: { update: vi.fn() }, outboxEvent: { create: vi.fn() },
    $queryRaw: vi.fn(), $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((run: (db: unknown) => unknown) => run(db));
  const service = new IntegrationExecutionService(db as never, {} as never, {} as never,
    { resolveSyncOverride: vi.fn().mockResolvedValue({ protected: false }), resolvePolicy: vi.fn().mockResolvedValue({ staleAfterMinutes: 15 }) } as never, {} as never);
  const internal = service as unknown as {
    pullPrices(...args: unknown[]): Promise<{ updated: number; unchanged: number }>;
    resolveExternalTarget(): Promise<unknown>; refreshSearchPrice(): Promise<void>; resolveOpenReconciliation(): Promise<void>;
  };
  vi.spyOn(internal, "resolveExternalTarget").mockResolvedValue({ variantId: "variant", offer: { id: "offer", productVariant: { productId: "product" } } });
  vi.spyOn(internal, "refreshSearchPrice").mockResolvedValue(); vi.spyOn(internal, "resolveOpenReconciliation").mockResolvedValue();
  const run = () => internal.pullPrices({ connectionId: "connection" }, "source", "supplier", {}, null, {}, { items: [{ externalId: "external", valueMinor: 10000, currency: "KZT", raw: {} }] });
  return { db, run };
}
describe("ERP price tax persistence", () => {
  it("compares normalized gross, so repeated net feeds do not rewrite or add VAT twice", async () => {
    const f = fixture();
    vi.mocked(resolveImportPrice).mockResolvedValue({ amountMinor: "11600", includesVat: true, vatRate: null, taxSnapshot: Prisma.DbNull, declaration: null });
    expect(await f.run()).toMatchObject({ updated: 0, unchanged: 1 });
    expect(f.db.offerPrice.create).not.toHaveBeenCalled(); expect(f.db.$queryRaw).toHaveBeenCalledOnce();
  });
  it("persists a tax-only change even when the payable amount is identical", async () => {
    const f = fixture();
    vi.mocked(resolveImportPrice).mockResolvedValue({ amountMinor: "11600", includesVat: true, vatRate: 16, taxSnapshot: tax as unknown as Prisma.InputJsonValue, declaration: tax });
    expect(await f.run()).toMatchObject({ updated: 1, unchanged: 0 });
    expect(f.db.offerPrice.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amountMinor: "11600", taxSnapshot: tax, vatRate: 16 }) });
    expect(f.db.offerPriceHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ taxSnapshot: tax }) });
  });
  it("fails before price mutation when tax normalization rejects a row", async () => {
    const f = fixture(); vi.mocked(resolveImportPrice).mockRejectedValue(new Error("Налоговый профиль изменился"));
    await expect(f.run()).rejects.toThrow("Налоговый профиль изменился");
    expect(f.db.offerPrice.updateMany).not.toHaveBeenCalled(); expect(f.db.offerPrice.create).not.toHaveBeenCalled();
  });
});
