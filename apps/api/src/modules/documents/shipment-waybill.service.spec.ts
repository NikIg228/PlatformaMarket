import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShipmentWaybillService } from "./shipment-waybill.service";
import { invoiceRequisites } from "./order-invoice.rules";
import { invoiceTestId as id, invoiceTestRevision } from "./order-invoice.test-fixture";
import { waybillTestShipment } from "./shipment-waybill.test-fixture";
vi.mock("./order-invoice.rules", async original => ({ ...await original<object>(), invoiceRequisites: vi.fn() }));
const context = { actorId: id(91), organizationId: id(20) };
const input = { expectedOrderVersion: 1, expectedShipmentVersion: 2, idempotencyKey: "prepare-batch-one" };
function setup() {
  const shipment = waybillTestShipment(), documents = new Map<string, any>(); let next = 100;
  const db: any = { $queryRaw: vi.fn(async () => []),
    shipment: { findFirst: vi.fn(async () => shipment), findFirstOrThrow: vi.fn(async () => shipment) },
    document: {
      findFirst: vi.fn(async ({ where }: any) => [...documents.values()].filter(row => where.externalId ? row.externalId === where.externalId : row.documentNumber === where.documentNumber).at(-1) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => documents.get(where.id)),
      findMany: vi.fn(async ({ where }: any) => where.kind === "WAYBILL" ? [...documents.values()] : []),
      create: vi.fn(async ({ data }: any) => { const row = { id: id(next++), checksumSha256: null, immutableAt: null, ...data }; documents.set(row.id, row); return row; }),
      update: vi.fn(async ({ where, data }: any) => Object.assign(documents.get(where.id), data)),
      updateMany: vi.fn(async ({ where, data }: any) => { const row = documents.get(where.id); if (row && where.status.in.includes(row.status)) Object.assign(row, data); return { count: 1 }; }),
    }, user: { findUniqueOrThrow: vi.fn(async () => ({ displayName: "Поставщик" })) }, auditLog: { create: vi.fn() },
  };
  db.$transaction = vi.fn(async (run: any) => run(db));
  const renderer = { render: vi.fn(async () => Buffer.from("waybill-preview")) };
  const storage = { put: vi.fn() }, access = { hasAll: vi.fn(async () => true) };
  return { db, shipment, documents, renderer, storage, access, service: new ShipmentWaybillService(db, access as never, renderer as never, storage as never) };
}
beforeEach(() => vi.mocked(invoiceRequisites).mockImplementation(async (_db, org) => ({ current: invoiceTestRevision(org === id(20) ? 1 : 2), issues: [] })));
describe("shipment waybill preparation", () => {
  it("reserves one draft on replay, uses batch amounts and never signs it", async () => {
    const f = setup(), first = await f.service.prepare(id(10), id(60), input, context);
    expect(await f.service.prepare(id(10), id(60), input, context)).toEqual(first);
    expect(first).toMatchObject({ status: "PREVIEW", version: 1, snapshot: { totalMinor: "5800", shipmentId: id(60) } });
    expect(f.db.document.create).toHaveBeenCalledTimes(1); expect(f.renderer.render).toHaveBeenCalledTimes(1);
    expect([...f.documents.values()][0]).toMatchObject({ status: "DRAFT", immutableAt: null, requiredSignatureCount: 2 });
    await expect(f.service.prepare(id(10), id(60), { ...input, expectedShipmentVersion: 3 }, context)).rejects.toThrow("Ключ повтора");
  });
  it("resumes the same version after storage failure", async () => {
    const f = setup(); f.storage.put.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(f.service.prepare(id(10), id(60), input, context)).rejects.toThrow("storage unavailable");
    expect([...f.documents.values()][0].status).toBe("FAILED");
    expect(await f.service.prepare(id(10), id(60), input, context)).toMatchObject({ status: "PREVIEW", version: 1 });
    expect(f.db.document.create).toHaveBeenCalledTimes(1);
  });
  it("denies missing permission and foreign shipments before any write", async () => {
    const f = setup(); f.access.hasAll.mockResolvedValue(false);
    await expect(f.service.prepare(id(10), id(60), input, context)).rejects.toMatchObject({ status: 403 });
    expect(f.db.shipment.findFirst).not.toHaveBeenCalled();
    f.access.hasAll.mockResolvedValue(true); f.db.shipment.findFirst.mockResolvedValue(null);
    await expect(f.service.prepare(id(10), id(60), input, context)).rejects.toMatchObject({ status: 404 });
    expect(f.db.document.create).not.toHaveBeenCalled();
  });
  it("rejects stale request versions and a replay after the shipment changes", async () => {
    const f = setup();
    await expect(f.service.prepare(id(10), id(60), { ...input, expectedOrderVersion: 9 }, context)).rejects.toThrow("изменились");
    const first = await f.service.prepare(id(10), id(60), input, context);
    f.shipment.version++;
    await expect(f.service.prepare(id(10), id(60), input, context)).rejects.toThrow("устарели");
    expect((await f.service.list(id(10), id(60), context)).waybills[0].status).toBe("STALE");
    const second = await f.service.prepare(id(10), id(60), { ...input, expectedShipmentVersion: 3, idempotencyKey: "prepare-new-version" }, context);
    expect(second.version).toBe(2); expect(second.documentId).not.toBe(first.documentId);
    expect(f.documents.get(second.documentId).previousVersionId).toBe(first.documentId);
  });
  it("rejects changed requisites and blocks missing confirmation without requiring a bank account", async () => {
    const f = setup();
    vi.mocked(invoiceRequisites).mockResolvedValue({ current: invoiceTestRevision(), issues: [{ party: "SUPPLIER", code: "BANK_ACCOUNT_REQUIRED", message: "Нет банковского счёта" }] });
    await f.service.prepare(id(10), id(60), input, context);
    vi.mocked(invoiceRequisites).mockResolvedValue({ current: { ...invoiceTestRevision(), version: 2 }, issues: [] });
    await expect(f.service.prepare(id(10), id(60), input, context)).rejects.toThrow("устарели");
    vi.mocked(invoiceRequisites).mockResolvedValue({ current: null, issues: [{ party: "BUYER", code: "UNCONFIRMED", message: "Подтвердите реквизиты" }] });
    await expect(f.service.prepare(id(10), id(60), { ...input, idempotencyKey: "new-missing-requisites" }, context)).rejects.toThrow("Подтвердите реквизиты");
  });
});
