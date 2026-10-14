import { describe, expect, it, vi } from "vitest";
import { updateIntegrationTax } from "./integration-tax";
import { currentVatProfile } from "../vat/vat-rules";
import { resolveImportPrice } from "../imports/import-vat";
vi.mock("../vat/vat-rules", async original => ({ ...await original<typeof import("../vat/vat-rules")>(), currentVatProfile: vi.fn() }));
vi.mock("../imports/import-vat", () => ({ resolveImportPrice: vi.fn() }));
const input = { expectedUpdatedAt: "2026-10-14T10:00:00.000Z", idempotencyKey: "repeat-tax", priceTax: { priceIncludesVat: false, expectedRequisitesVersion: 2, taxAcknowledged: true as const } };
const context = { actorId: "actor", organizationId: "supplier" };
function fixture() {
  const binding = { id: "binding", connectionId: "connection", dataType: "PRICE", warehouseId: null, offerId: null, priority: 57,
    updatedAt: new Date(input.expectedUpdatedAt), configuration: { existingOption: true }, connection: { displayName: "ERP", provider: "ONE_C" } };
  const db = { idempotencyRecord: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    integrationDataBinding: { findFirst: vi.fn().mockResolvedValue(binding), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue(binding) }, auditLog: { create: vi.fn() } };
  vi.mocked(currentVatProfile).mockResolvedValue({ version: 2 } as never);
  vi.mocked(resolveImportPrice).mockResolvedValue({ declaration: null } as never);
  return { db, binding, run: () => updateIntegrationTax(db as never, "supplier", "connection", "binding", input, context) };
}
describe("ERP tax binding update", () => {
  it("preserves scope, priority and unrelated configuration; writes audit and replay atomically", async () => {
    const f = fixture(); expect(await f.run()).toMatchObject({ priority: 57 });
    expect(f.db.integrationDataBinding.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ connection: { supplierOrganizationId: "supplier" } }) }));
    expect(f.db.integrationDataBinding.updateMany).toHaveBeenCalledWith({ where: { id: "binding", updatedAt: new Date(input.expectedUpdatedAt) }, data: { configuration: { existingOption: true, priceTax: input.priceTax, vatContext: { actorId: "actor", defaultTax: null } } } });
    expect(f.db.auditLog.create).toHaveBeenCalledOnce(); expect(f.db.idempotencyRecord.create).toHaveBeenCalledOnce();
  });
  it("replays without a second write and rejects key reuse for another payload", async () => {
    const f = fixture(); const response = await f.run(); const record = f.db.idempotencyRecord.create.mock.calls[0][0].data;
    f.db.idempotencyRecord.findUnique.mockResolvedValue(record); f.db.integrationDataBinding.updateMany.mockClear();
    expect(await f.run()).toEqual(response); expect(f.db.integrationDataBinding.updateMany).not.toHaveBeenCalled();
    await expect(updateIntegrationTax(f.db as never, "supplier", "connection", "binding", { ...input, priceTax: { ...input.priceTax, priceIncludesVat: true } }, context)).rejects.toThrow("Ключ повтора");
  });
  it.each(["version", "profile", "concurrent", "missing"])("rejects %s conflicts before audit/replay", async kind => {
    const f = fixture();
    if (kind === "version") f.binding.updatedAt = new Date("2026-10-14T11:00:00Z");
    if (kind === "profile") vi.mocked(currentVatProfile).mockResolvedValue({ version: 3 } as never);
    if (kind === "concurrent") f.db.integrationDataBinding.updateMany.mockResolvedValue({ count: 0 });
    if (kind === "missing") f.db.integrationDataBinding.findFirst.mockResolvedValue(null);
    await expect(f.run()).rejects.toThrow(); expect(f.db.auditLog.create).not.toHaveBeenCalled(); expect(f.db.idempotencyRecord.create).not.toHaveBeenCalled();
  });
  it("denies operator or another tenant before reads", async () => {
    const f = fixture(); await expect(updateIntegrationTax(f.db as never, "supplier", "connection", "binding", input, { ...context, organizationId: "operator" })).rejects.toThrow("представитель поставщика");
    expect(f.db.idempotencyRecord.findUnique).not.toHaveBeenCalled();
  });
});
