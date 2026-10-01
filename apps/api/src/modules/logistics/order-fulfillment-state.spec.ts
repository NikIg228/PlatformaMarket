import { describe, expect, it } from "vitest";
import { Prisma, type ShipmentStatus } from "@prisma/client";
import { fulfillmentOrderStatus } from "./order-fulfillment-state";
const d = (n: string) => new Prisma.Decimal(n);
const items = [{ id: "item", acceptedQuantity: d("3") }];
const shipment = (status: ShipmentStatus, quantity: string, step = "COMPLETED") => ({ status,
  items: [{ supplierOrderItemId: "item", deliveredQuantity: d(quantity) }], fulfillmentSteps: [{ status: step }] });
describe("whole order fulfillment", () => {
  it("does not regress receipt when another shipment starts packing", () => {
    expect(fulfillmentOrderStatus(items, [shipment("DELIVERED", "1"), shipment("PACKING", "0")])).toBe("PARTIALLY_FULFILLED");
  });
  it("requires every accepted unit, including unplanned quantities", () => {
    expect(fulfillmentOrderStatus(items, [shipment("DELIVERED", "1")])).toBe("PARTIALLY_FULFILLED");
    expect(fulfillmentOrderStatus(items, [shipment("DELIVERED", "1"), shipment("DELIVERED", "2")])).toBe("DELIVERED");
  });
  it("waits for installation after physical receipt and ignores cancelled quantities", () => {
    expect(fulfillmentOrderStatus(items, [shipment("PARTIALLY_DELIVERED", "3", "IN_PROGRESS")])).toBe("PARTIALLY_FULFILLED");
    expect(fulfillmentOrderStatus(items, [shipment("DELIVERED", "1"), shipment("CANCELLED", "2")])).toBe("PARTIALLY_FULFILLED");
  });
  it("keeps precise fractional quantities and the furthest active shipment", () => {
    expect(fulfillmentOrderStatus([{ id: "item", acceptedQuantity: d("0.3") }], [shipment("DELIVERED", "0.1"), shipment("DELIVERED", "0.2")])).toBe("DELIVERED");
    expect(fulfillmentOrderStatus(items, [shipment("IN_TRANSIT", "0"), shipment("READY", "0")])).toBe("IN_TRANSIT");
  });
});
