import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { resupplyView, type ResupplySource } from "./order-resupply.rules";
import { consumeResupplyInventory } from "./order-resupply-inventory";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const d = (value: number) => new Prisma.Decimal(value);
function fixture() {
  const order = { paymentStatus: "PAID", status: "PARTIALLY_DELIVERED", supplierOrganizationId: id(1) };
  const claim = { id: id(2), status: "AGREED", resolution: "RESUPPLY", statement: { kind: "SHORTAGE", reason: "Получено восемь", requestedResolution: "RESUPPLY", attachmentIds: [],
    lines: [{ shipmentItemId: id(3), actualQuantity: "8", damagedQuantity: "0" }] },
  source: { orderVersion: 1, shipmentVersion: 1, shipmentNumber: "SHP-1", documentId: null, documentVersion: null,
    documentChecksum: null, documentSnapshot: null, sourceReceiptEventId: null,
    lines: [{ shipmentItemId: id(3), orderItemId: id(4), name: "Товар", uom: "шт.", sentQuantity: "10", recordedReceivedQuantity: "0", unitPriceMinor: "100", taxSnapshot: null, isGift: false }] } };
  const source = { id: id(5), status: "PARTIALLY_DELIVERED", warehouseId: id(6), warehouse: { status: "ACTIVE", supplierOrganizationId: id(1), name: "Склад" },
    fulfillmentSteps: [], resupplyShipment: null, resupplyDiscrepancyId: null, recipientName: "Клиника", method: "SUPPLIER_DELIVERY",
    items: [{ id: id(3), supplierOrderItemId: id(4), quantity: d(10), deliveredQuantity: d(8), resupplyQuantity: d(0),
      supplierOrderItem: { productVariantId: id(7), unitPriceMinor: d(100), reservation: { id: id(8), inventoryBalanceId: id(9), status: "CONSUMED", externalReservation: null } } }] } as unknown as ResupplySource;
  return { order, claim, source };
}
describe("agreed shortage resupply", () => {
  it("derives only the missing two from the immutable statement, retaining documentary incompleteness", () => {
    const f = fixture(), before = JSON.stringify(f);
    expect(resupplyView(f.order, f.claim, f.source)).toMatchObject({ canDispatch: true, documentStatus: "INCOMPLETE", lines: [{ quantity: "2", originalReceivedQuantity: "8" }] });
    expect(JSON.stringify(f)).toBe(before);
  });
  it.each(["REJECTED", "SUBMITTED", "RESOLUTION_PROPOSED"])("does not execute %s claims", status => {
    const f = fixture(); f.claim.status = status; expect(resupplyView(f.order, f.claim, f.source)).toBeNull();
  });
  it("requires actual buyer receipt, rejects mixed damage and external reservations", () => {
    const f = fixture(); f.source.items[0].deliveredQuantity = d(0);
    expect(resupplyView(f.order, f.claim, f.source)?.canDispatch).toBe(false);
    f.source.items[0].deliveredQuantity = d(8); f.claim.statement.lines[0].damagedQuantity = "1";
    expect(resupplyView(f.order, f.claim, f.source)?.canDispatch).toBe(false);
    f.claim.statement.lines[0].damagedQuantity = "0";
    f.source.items[0].supplierOrderItem.reservation!.externalReservation = {} as never;
    expect(resupplyView(f.order, f.claim, f.source)?.canDispatch).toBe(false);
  });
  it("does not offer a second dispatch when a replacement exists, including after full goods receipt", () => {
    const f = fixture(); f.source.resupplyShipment = { id: id(10), shipmentNumber: "RS-1", status: "DELIVERED", dispatchedAt: new Date(), deliveredAt: new Date(), carrierName: null, trackingNumber: null,
      items: [{ supplierOrderItemId: id(4), deliveredQuantity: d(2) }] } as never;
    f.order.status = "DELIVERED";
    expect(resupplyView(f.order, f.claim, f.source)).toMatchObject({ canDispatch: false, documentStatus: "INCOMPLETE", lines: [{ deliveredQuantity: "2" }] });
  });
  it("consumes only additional stock with a distinct trace, preserving the paid reservation", async () => {
    const f = fixture(), plan = resupplyView(f.order, f.claim, f.source)!;
    const balance = { id: id(9), supplierOrganizationId: id(1), warehouseId: id(6), productVariantId: id(7), freshnessStatus: "FRESH", freshnessExpiresAt: null,
      quantityOnHand: d(20), quantityReserved: d(5), safetyStock: d(3), quantityAvailable: d(12), version: 1 };
    const tx = { $queryRaw: vi.fn(), inventoryBalance: { findUniqueOrThrow: vi.fn(async () => balance), updateMany: vi.fn(async (_input: { data: Record<string, unknown> }) => ({ count: 1 })) },
      inventoryLot: { findFirst: vi.fn(async () => null), count: vi.fn(async () => 0) },
      inventoryReservation: { create: vi.fn(async (_input: { data: Record<string, unknown> }) => ({ id: id(11) })), update: vi.fn() }, auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() } };
    await consumeResupplyInventory(tx as never, f.source, plan.lines, id(10), f.claim.id, { organizationId: id(1), actorId: id(12) });
    expect(tx.inventoryBalance.updateMany.mock.calls[0][0].data).toMatchObject({ quantityOnHand: { decrement: d(2) }, quantityAvailable: { decrement: d(2) } });
    expect(tx.inventoryReservation.create.mock.calls[0][0].data).toMatchObject({ quantity: d(2), status: "CONSUMED", referenceType: "ORDER_RESUPPLY" });
    expect(tx.inventoryReservation.create.mock.calls[0][0].data).not.toHaveProperty("supplierOrderItemId");
    expect(tx.inventoryReservation.update).not.toHaveBeenCalled();
    balance.quantityAvailable = d(1);
    await expect(consumeResupplyInventory(tx as never, f.source, plan.lines, id(10), f.claim.id, { organizationId: id(1), actorId: id(12) })).rejects.toThrow("остатка");
    balance.quantityAvailable = d(12); balance.freshnessStatus = "STALE";
    await expect(consumeResupplyInventory(tx as never, f.source, plan.lines, id(10), f.claim.id, { organizationId: id(1), actorId: id(12) })).rejects.toThrow("Обновите");
    balance.freshnessStatus = "FRESH"; tx.inventoryLot.count.mockResolvedValue(1);
    await expect(consumeResupplyInventory(tx as never, f.source, plan.lines, id(10), f.claim.id, { organizationId: id(1), actorId: id(12) })).rejects.toThrow("пригодная");
    expect(tx.inventoryReservation.create).toHaveBeenCalledTimes(1);
  });
});
