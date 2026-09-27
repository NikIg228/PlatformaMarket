import { expect, it, vi } from "vitest";
import { InventoryService } from "./inventory.service";

it("manual draft initialization cannot reassign another offer's warehouse balance", async () => {
  const updateMany = vi.fn();
  const tx = { inventoryBalance: { findUnique: vi.fn().mockResolvedValue({ offerId: "previous" }), updateMany } };
  const db = { warehouse: { findFirst: vi.fn().mockResolvedValue({}) }, productVariant: { findUnique: vi.fn().mockResolvedValue({}) }, supplierOffer: { findFirst: vi.fn().mockResolvedValue({}) },
    $transaction: (run: (client: typeof tx) => unknown) => run(tx) };
  const access = { assertCanManage: vi.fn(), requireProfile: vi.fn() };
  const freshness = { resolvePolicy: vi.fn().mockResolvedValue({ staleAfterMinutes: 60 }) };
  const service = new InventoryService(db as never, access as never, freshness as never);
  await expect(service.setBalance("supplier", { warehouseId: "w", productVariantId: "v", offerId: "new", quantityOnHand: 8, quantityReserved: 0, safetyStock: 0, source: "MANUAL", initialForOffer: true }, { actorId: "actor", organizationId: "supplier" })).rejects.toThrow("уже существует остаток");
  expect(access.assertCanManage).toHaveBeenCalledWith("supplier", { actorId: "actor", organizationId: "supplier" });
  expect(updateMany).not.toHaveBeenCalled();
});

it("resuming a manual offer preserves both reservations and warehouse safety stock", async () => {
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = {
    inventoryBalance: { findUnique: vi.fn().mockResolvedValue({ id: "balance", version: 2, offerId: "offer", quantityReserved: 3, safetyStock: 2 }), updateMany, findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "balance" }) },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() },
  };
  const db = { warehouse: { findFirst: vi.fn().mockResolvedValue({}) }, productVariant: { findUnique: vi.fn().mockResolvedValue({}) }, supplierOffer: { findFirst: vi.fn().mockResolvedValue({}) },
    $transaction: (run: (client: typeof tx) => unknown) => run(tx) };
  const service = new InventoryService(db as never, { assertCanManage: vi.fn(), requireProfile: vi.fn() } as never, { resolvePolicy: vi.fn().mockResolvedValue({ staleAfterMinutes: 60 }) } as never);
  const input = { warehouseId: "w", productVariantId: "v", offerId: "offer", quantityOnHand: 8, quantityReserved: 0, safetyStock: 0, source: "MANUAL" as const, initialForOffer: true };
  await service.setBalance("supplier", input, { actorId: "actor", organizationId: "supplier" });
  expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ safetyStock: 2, quantityAvailable: 3 }) }));
  expect(updateMany.mock.calls[0]?.[0].data).not.toHaveProperty("quantityReserved");
  updateMany.mockClear();
  await expect(service.setBalance("supplier", { ...input, quantityOnHand: 4 }, { actorId: "actor", organizationId: "supplier" })).rejects.toThrow("cannot invalidate");
  expect(updateMany).not.toHaveBeenCalled();
});
