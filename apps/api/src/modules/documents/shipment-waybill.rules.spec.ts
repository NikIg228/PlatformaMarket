import { waybillTestShipment } from "./shipment-waybill.test-fixture";
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { invoiceTestId as id, invoiceTestRevision } from "./order-invoice.test-fixture";
import { waybillIssues, waybillLines, waybillSnapshot, type WaybillShipment } from "./shipment-waybill.rules";

describe("shipment waybill rules", () => {
  it("uses only the actual partial batch and its VAT", () => {
    const s = waybillTestShipment();
    const result = waybillSnapshot(s, invoiceTestRevision(1), invoiceTestRevision(2), 1, { id: id(91), name: "Автор" });
    expect(result.totalMinor).toBe("5800"); expect(result.baseMinor).toBe("5000"); expect(result.vatMinor).toBe("800");
    expect(result.lines[0]).toMatchObject({ quantity: "1", orderedQuantity: "2", totalMinor: "5800" });
  });
  it("rejects a foreign order line, excessive quantity and a different warehouse", () => {
    for (const change of [(s: WaybillShipment) => { s.items[0].supplierOrderItemId = id(99); },
      (s: WaybillShipment) => { s.items[0].quantity = new Prisma.Decimal(3); },
      (s: WaybillShipment) => { s.supplierOrder.items[0].warehouseId = id(99); }]) {
      const s = waybillTestShipment(); change(s); expect(() => waybillLines(s)).toThrow("Позиции партии");
    }
  });
  it("blocks unknown tax and inconsistent agreed amounts", () => {
    const s = waybillTestShipment(); s.supplierOrder.items[0].offerSnapshot = {};
    expect(() => waybillLines(s)).toThrow("налоговые");
    s.supplierOrder.items[0].totalPriceMinor = new Prisma.Decimal(1);
    expect(() => waybillLines(s)).toThrow("Цена позиции");
  });
  it("allows packing/ready only and requires payment and a real destination", () => {
    const s = waybillTestShipment(); expect(waybillIssues(s)).toEqual([]);
    s.status = "DISPATCHED"; expect(waybillIssues(s)).not.toEqual([]);
    s.status = "READY"; s.supplierOrder.paymentStatus = "UNPAID"; expect(waybillIssues(s)).not.toEqual([]);
    s.supplierOrder.paymentStatus = "PAID"; s.destinationAddress = null; expect(waybillIssues(s)).not.toEqual([]);
    s.pickup = true; expect(waybillIssues(s)).toEqual([]);
    s.warehouse.addressLine = null; expect(waybillIssues(s)).toContain("Укажите адрес склада перед подготовкой накладной");
  });
});
