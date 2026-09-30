import { describe, expect, it, vi } from "vitest";
import { assertShipmentLotsUsable, lotIsUsable } from "./lot-eligibility";

const at = new Date("2026-09-30T12:00:00Z");
describe("lot eligibility at the fulfillment boundary", () => {
  it.each(["RECALLED", "EXPIRED", "UNDER_REVIEW", "QUARANTINED"])("never ships or consumes a %s lot", status => {
    expect(lotIsUsable({ status, expirationDate: null }, at)).toBe(false);
    expect(lotIsUsable({ status, expirationDate: null }, at, true)).toBe(false);
  });
  it("blocks expiration even while status remains ACTIVE, including the exact boundary", () => {
    expect(lotIsUsable({ status: "ACTIVE", expirationDate: new Date(at.getTime() + 1) }, at)).toBe(true);
    expect(lotIsUsable({ status: "ACTIVE", expirationDate: at }, at)).toBe(false);
    expect(lotIsUsable({ status: "ACTIVE", expirationDate: new Date(at.getTime() - 1) }, at)).toBe(false);
  });
  it("allows paid depleted goods to ship but never to be consumed again", () => {
    expect(lotIsUsable({ status: "DEPLETED", expirationDate: null }, at)).toBe(false);
    expect(lotIsUsable({ status: "DEPLETED", expirationDate: null }, at, true)).toBe(true);
  });
  it("rereads lot state after acquiring locks and rejects a recall observed there", async () => {
    const tx = { $queryRaw: vi.fn(), inventoryLot: { findMany: vi.fn()
      .mockResolvedValueOnce([{ id: "lot", inventoryBalanceId: "balance" }])
      .mockResolvedValueOnce([{ id: "lot", warehouseId: "warehouse", status: "RECALLED", expirationDate: null }]) } };
    await expect(assertShipmentLotsUsable(tx as never, "supplier", [{ inventoryLotId: "lot", warehouseId: "warehouse" }])).rejects.toThrow(/Отгрузка запрещена/);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(tx.inventoryLot.findMany.mock.invocationCallOrder[1]);
  });
  it("rejects a foreign or missing lot before acquiring inventory locks", async () => {
    const tx = { $queryRaw: vi.fn(), inventoryLot: { findMany: vi.fn().mockResolvedValue([]) } };
    await expect(assertShipmentLotsUsable(tx as never, "supplier", [{ inventoryLotId: "foreign", warehouseId: "warehouse" }])).rejects.toThrow(/недоступна/);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
