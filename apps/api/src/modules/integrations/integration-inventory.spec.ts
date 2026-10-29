import { describe, expect, it, vi } from "vitest";
import { writeSyncedInventory } from "./integration-inventory";
import { RetryableIntegrationError } from "./adapters/integration-adapter";

describe("ERP inventory snapshot fence", () => {
  const identity = { supplierOrganizationId: "supplier", warehouseId: "warehouse", productVariantId: "variant" };
  it("conflicts instead of restoring availability after a competing reservation", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 }), findUniqueOrThrow = vi.fn();
    await expect(writeSyncedInventory({ inventoryBalance: { updateMany, findUniqueOrThrow } } as never,
      { id: "balance", version: 2 }, identity, { quantityOnHand: 10, quantityAvailable: 10 }, 0)).rejects.toBeInstanceOf(RetryableIntegrationError);
    expect(updateMany.mock.calls[0][0].where).toEqual({ id: "balance", version: 2 });
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  });
  it("retains reservations and safety stock on a non-racing update", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue({ id: "balance", quantityReserved: 8, quantityAvailable: 1 });
    await expect(writeSyncedInventory({ inventoryBalance: { updateMany, findUniqueOrThrow } } as never,
      { id: "balance", version: 3 }, identity, { quantityOnHand: 10, quantityAvailable: 1 }, 1)).resolves.toMatchObject({ quantityReserved: 8 });
    expect(updateMany.mock.calls[0][0].data).not.toHaveProperty("quantityReserved");
    expect(updateMany.mock.calls[0][0].data).not.toHaveProperty("safetyStock");
  });
  it("uses create, not overwrite, for a first balance and propagates an insert race", async () => {
    const create = vi.fn().mockRejectedValue(new Error("unique conflict"));
    await expect(writeSyncedInventory({ inventoryBalance: { create } } as never, null, identity,
      { quantityOnHand: 10, quantityAvailable: 9 }, 1)).rejects.toThrow("unique conflict");
    expect(create.mock.calls[0][0].data).toMatchObject({ ...identity, quantityReserved: 0, safetyStock: 1 });
  });
});
