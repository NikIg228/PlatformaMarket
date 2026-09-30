import { describe, expect, it, vi } from "vitest";
import { CatalogService } from "./catalog.service";
import { updateProductSchema } from "@marketplace/schemas";
describe("operator-approved catalogue name", () => {
  const context = { actorId: "operator", organizationId: "platform" };
  function fixture(count = 1) {
    const original = { id: "product", canonicalName: "Original model A2 4g", catalogName: null, version: 2 };
    const tx = { product: { updateMany: vi.fn().mockResolvedValue({ count }), findUniqueOrThrow: vi.fn().mockResolvedValue({ ...original, catalogName: "Model A2 4g", version: 3 }) }, auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() } };
    const db = { product: { findUnique: vi.fn().mockResolvedValue(original) }, $transaction: vi.fn(callback => callback(tx)) };
    const authority = { assertPlatformOperator: vi.fn() };
    return { service: new CatalogService(db as never, authority as never), tx, db, authority };
  }
  it("requires platform authority before reading or writing and audits an optimistic-version change", async () => {
    const f = fixture(); await f.service.updateProduct("product", { version: 2, catalogName: "Model A2 4g" }, context);
    expect(f.authority.assertPlatformOperator).toHaveBeenCalledWith(context);
    expect(f.tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "product", version: 2 }, data: expect.objectContaining({ catalogName: "Model A2 4g", canonicalName: undefined }) }));
    expect(f.tx.auditLog.create).toHaveBeenCalled(); expect(f.tx.outboxEvent.create).toHaveBeenCalled();
  });
  it("rejects stale version and unauthorized writer without publishing a name", async () => {
    const f = fixture(0); await expect(f.service.updateProduct("product", { version: 1, catalogName: "Model" }, context)).rejects.toThrow("reload"); expect(f.tx.auditLog.create).not.toHaveBeenCalled();
    f.authority.assertPlatformOperator.mockRejectedValueOnce(new Error("Forbidden")); f.db.product.findUnique.mockClear(); await expect(f.service.updateProduct("product", { version: 2, catalogName: "Model" }, context)).rejects.toThrow("Forbidden"); expect(f.db.product.findUnique).not.toHaveBeenCalled();
  });
  it("allows explicit clearing but rejects an empty approved name", () => {
    expect(updateProductSchema.safeParse({ version: 1, catalogName: null }).success).toBe(true);
    expect(updateProductSchema.safeParse({ version: 1, catalogName: " " }).success).toBe(false);
  });
});
