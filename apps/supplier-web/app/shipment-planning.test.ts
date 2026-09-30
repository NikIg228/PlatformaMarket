import { describe, expect, it } from "vitest";
import { shipmentPlanning } from "./shipment-planning";
import type { ShipmentOrder } from "./shipment-panel";

const order = (a: number, b: number, status = "PLANNED") => ({ items: [
  { id: "a", warehouseId: "A", acceptedQuantity: "5" }, { id: "b", warehouseId: "B", acceptedQuantity: "3" },
], shipments: [{ status, items: [{ supplierOrderItemId: "a", quantity: String(a) }, { supplierOrderItemId: "b", quantity: String(b) }] }] }) as ShipmentOrder;

describe("shipment warehouse planning", () => {
  it("selects the next warehouse after the first is completely planned", () => {
    const result = shipmentPlanning(order(5, 0), "A");
    expect(result.warehouseId).toBe("B");
    expect(result.warehouses.map(([id]) => id)).toEqual(["B"]);
    expect(result.remainingItems.map(({ item, quantity }) => [item.id, quantity])).toEqual([["b", 3]]);
  });
  it("preserves a partially planned selection and never mixes warehouses", () => {
    const result = shipmentPlanning(order(2, 1), "A");
    expect(result.warehouseId).toBe("A");
    expect(result.warehouses).toHaveLength(2);
    expect(result.remainingItems.map(({ item, quantity }) => [item.warehouseId, quantity])).toEqual([["A", 3]]);
    expect(shipmentPlanning(order(2, 1), "B").remainingItems[0].quantity).toBe(2);
  });
  it("reports all positions planned including refreshed concurrent allocations", () => {
    expect(shipmentPlanning(order(5, 3), "B")).toEqual({ warehouses: [], warehouseId: "", remainingItems: [] });
  });
  it.each(["CANCELLED", "RETURNED"])("allows quantities from %s shipments to be planned again", status => {
    expect(shipmentPlanning(order(5, 3, status), "B").remainingItems[0].quantity).toBe(3);
  });
  it("does not plan unaccepted or overallocated quantities", () => {
    const input = order(6, 0); input.items[1].acceptedQuantity = null;
    expect(shipmentPlanning(input, "A").warehouses).toEqual([]);
  });
});
