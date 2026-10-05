import { expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { applyImportedInventory } from "./import-inventory";
const input = { supplierOrganizationId: "supplier", warehouseId: "warehouse", productVariantId: "variant", offerId: "offer", quantity: "4.125" };
function fixture() {
  const inventoryBalance = { findUnique: vi.fn().mockResolvedValue({ id: "balance", version: 7, quantityReserved: new Prisma.Decimal("1.125"), safetyStock: new Prisma.Decimal("0.25") }), updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn() };
  return { inventoryBalance, tx: { inventoryBalance } as unknown as Prisma.TransactionClient };
}
it("preserves reserved and safety stock and calculates exact available stock under a version guard", async () => {
  const { tx, inventoryBalance: db } = fixture(); await applyImportedInventory(tx, input);
  const write = db.updateMany.mock.calls[0]![0];
  expect(write.where).toEqual({ id: "balance", version: 7 });
  expect(write.data.quantityAvailable.toString()).toBe("2.75");
  expect(write.data).not.toHaveProperty("quantityReserved"); expect(write.data).not.toHaveProperty("safetyStock");
  expect(write.data.availabilityStatus).toBe("LOW_STOCK");
});
it("rejects an on-hand quantity below existing commitments before writing", async () => {
  const { tx, inventoryBalance: db } = fixture();
  await expect(applyImportedInventory(tx, { ...input, quantity: "1" })).rejects.toThrow("меньше суммы");
  expect(db.updateMany).not.toHaveBeenCalled(); expect(db.create).not.toHaveBeenCalled();
});
it("rejects a concurrent reservation change so the enclosing import row rolls back", async () => {
  const { tx, inventoryBalance: db } = fixture(); db.updateMany.mockResolvedValue({ count: 0 });
  await expect(applyImportedInventory(tx, input)).rejects.toThrow("изменились во время импорта");
});
it("creates a new balance and marks zero remaining availability out of stock", async () => {
  const { tx, inventoryBalance: db } = fixture(); db.findUnique.mockResolvedValueOnce(null);
  await applyImportedInventory(tx, { ...input, quantity: "0" });
  expect(db.create.mock.calls[0]![0].data).toMatchObject({ quantityReserved: 0, safetyStock: 0, availabilityStatus: "OUT_OF_STOCK" });
});
