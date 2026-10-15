import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { OrderDiscrepancyCommand } from "@marketplace/schemas";
import { OrderDiscrepancyService } from "./order-discrepancy.service";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const buyer = { actorId: id(1), organizationId: id(2) }, supplier = { actorId: id(3), organizationId: id(4) };
const statement = { kind: "SHORTAGE" as const, reason: "Получено восемь", requestedResolution: "RESUPPLY" as const, attachmentIds: [],
  lines: [{ shipmentItemId: id(6), actualQuantity: "8", damagedQuantity: "0" }] };
const create: OrderDiscrepancyCommand = { action: "CREATE", shipmentId: id(5), sourceDocumentId: null, sourceDocumentVersion: null,
  sourceDocumentChecksum: null, sourceReceiptEventId: null, previousDiscrepancyId: null, statement,
  expectedOrderVersion: 1, expectedShipmentVersion: 1, idempotencyKey: "create-first" };
function setup() {
  const order = { id: id(7), buyerOrganizationId: buyer.organizationId, supplierOrganizationId: supplier.organizationId, version: 1 };
  const shipment = { id: id(5), shipmentNumber: "SH-1", version: 1, status: "DISPATCHED", items: [{ id: id(6), supplierOrderItemId: id(8), quantity: new Prisma.Decimal(10), deliveredQuantity: new Prisma.Decimal(0), supplierOrderItem: { offer: { packaging: { name: "10 штук" } }, productVariant: { product: { canonicalName: "Товар" }, saleUnit: { nameRu: "шт." } }, unitPriceMinor: new Prisma.Decimal(100), offerSnapshot: { vatRate: "16" }, giftForItemId: null } }] };
  const claims = new Map<string, any>(), events: any[] = [];
  const db: any = { $queryRaw: vi.fn(async () => []), supplierOrder: { findFirst: vi.fn(async () => order), findUniqueOrThrow: vi.fn(async () => order), update: vi.fn() },
    shipment: { findFirst: vi.fn(async ({ where }: any) => where.id === shipment.id ? shipment : null), update: vi.fn() },
    orderDiscrepancy: { create: vi.fn(async ({ data }: any) => { const row = { id: id(9), version: 1, status: "DRAFT", ...data }; claims.set(row.id, row); return row; }),
      findFirst: vi.fn(async ({ where }: any) => { const row = claims.get(where.id); return row && (!where.status?.not || row.status !== where.status.not) ? row : null; }),
      update: vi.fn(async ({ where, data }: any) => { const row = claims.get(where.id); Object.assign(row, { ...data, version: row.version + 1 }); return row; }) },
    orderDiscrepancyEvent: { findUnique: vi.fn(async ({ where }: any) => events.find(e => e.organizationId === where.supplierOrderId_organizationId_idempotencyKey.organizationId && e.idempotencyKey === where.supplierOrderId_organizationId_idempotencyKey.idempotencyKey)),
      create: vi.fn(async ({ data }: any) => { events.push(data); return data; }) },
    document: { findFirst: vi.fn(async () => null) }, uploadAsset: { count: vi.fn(async () => 0), findFirst: vi.fn() },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() } };
  db.$transaction = vi.fn(async (run: any) => run(db));
  const access = { hasAll: vi.fn(async () => true) }, uploads = { quarantine: vi.fn() }, storage = { get: vi.fn() };
  return { db, order, shipment, claims, events, access, uploads, storage, service: new OrderDiscrepancyService(db, access as never, uploads as never, storage as never) };
}
const existing = (version: number, key: string) => ({ discrepancyId: id(9), expectedOrderVersion: 1, expectedShipmentVersion: 1, expectedExceptionVersion: version, idempotencyKey: key });
describe("order discrepancy transaction boundary", () => {
  it("keeps drafts private, submits one immutable statement and requires bilateral counter acceptance", async () => {
    const f = setup(); await f.service.execute(id(7), create, buyer);
    await expect(f.service.execute(id(7), { ...existing(1, "respond-draft"), action: "RESPOND", decision: "AGREE", resolution: "RESUPPLY", reason: "Согласовано" }, supplier)).rejects.toMatchObject({ status: 404 });
    await f.service.execute(id(7), { ...existing(1, "submit-first"), action: "SUBMIT" }, buyer);
    const reply = { ...existing(2, "counter-first"), action: "RESPOND" as const, decision: "COUNTER" as const, resolution: "REDUCTION" as const, reason: "Предлагаем уменьшить" };
    expect(await f.service.execute(id(7), reply, supplier)).toMatchObject({ status: "RESOLUTION_PROPOSED", version: 3 });
    expect(await f.service.execute(id(7), { ...existing(3, "accept-first"), action: "DECIDE", accepted: true, reason: "Согласны с уменьшением" }, buyer)).toMatchObject({ status: "AGREED", version: 4 });
    expect(f.events.find(event => event.action === "SUBMIT").details.statement).toEqual(statement);
    expect(f.claims.get(id(9)).statement).toEqual(statement);
    expect(f.claims.get(id(9)).source.lines[0].uom).toBe("10 штук");
    expect(f.db.supplierOrder.update).not.toHaveBeenCalled(); expect(f.db.shipment.update).not.toHaveBeenCalled();
    expect(f.db.outboxEvent.create).toHaveBeenCalledTimes(3);
  });
  it("returns original result on replay even after versions change, rejecting payload/key and actor mismatch", async () => {
    const f = setup(), first = await f.service.execute(id(7), create, buyer); f.order.version++;
    expect(await f.service.execute(id(7), create, buyer)).toEqual(first);
    await expect(f.service.execute(id(7), { ...create, expectedOrderVersion: 2 }, buyer)).rejects.toThrow("Ключ повтора");
    await expect(f.service.execute(id(7), create, { ...buyer, actorId: id(11) })).rejects.toThrow("Ключ повтора");
    expect(f.db.orderDiscrepancy.create).toHaveBeenCalledTimes(1);
  });
  it("denies missing roles, another tenant, wrong party and inaccessible attachments before mutation", async () => {
    const f = setup(); f.access.hasAll.mockResolvedValue(false);
    await expect(f.service.execute(id(7), create, buyer)).rejects.toMatchObject({ status: 403 });
    expect(f.db.supplierOrder.findFirst).not.toHaveBeenCalled(); f.access.hasAll.mockResolvedValue(true);
    f.db.supplierOrder.findFirst.mockResolvedValueOnce(null);
    await expect(f.service.execute(id(7), create, buyer)).rejects.toMatchObject({ status: 404 });
    await expect(f.service.execute(id(7), create, supplier)).rejects.toMatchObject({ status: 403 });
    await expect(f.service.execute(id(7), { ...create, statement: { ...statement, attachmentIds: [id(12)] } }, buyer)).rejects.toThrow("Вложение");
    expect(f.db.orderDiscrepancy.create).not.toHaveBeenCalled();
  });
  it("rejects stale order/shipment/claim, foreign document and changed shipment at submission", async () => {
    const f = setup();
    await expect(f.service.execute(id(7), { ...create, expectedOrderVersion: 2 }, buyer)).rejects.toThrow("изменились");
    await expect(f.service.execute(id(7), { ...create, shipmentId: id(20) }, buyer)).rejects.toMatchObject({ status: 404 });
    await expect(f.service.execute(id(7), { ...create, sourceDocumentId: id(30), sourceDocumentVersion: 1 }, buyer)).rejects.toThrow("накладной");
    await f.service.execute(id(7), create, buyer);
    await expect(f.service.execute(id(7), { ...existing(2, "submit-stale"), action: "SUBMIT" }, buyer)).rejects.toThrow("изменились");
    f.shipment.version++;
    await expect(f.service.execute(id(7), { ...existing(1, "submit-new-ship"), expectedShipmentVersion: 2, action: "SUBMIT" }, buyer)).rejects.toThrow("Исходная партия");
    expect(f.events).toHaveLength(1);
  });
  it("does not serve unpublished evidence to a supplier or read storage on unauthorized download", async () => {
    const f = setup(); await f.service.execute(id(7), create, buyer);
    await expect(f.service.download(id(7), id(9), id(12), supplier)).rejects.toMatchObject({ status: 404 });
    await expect(f.service.download(id(7), id(9), id(12), buyer)).rejects.toMatchObject({ status: 404 });
    expect(f.storage.get).not.toHaveBeenCalled();
  });
});
