import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderInvoiceService } from "./order-invoice.service";
import { invoiceRequisites } from "./order-invoice.rules";
import { invoiceTestId as id, invoiceTestOrder, invoiceTestRevision } from "./order-invoice.test-fixture";
vi.mock("./order-invoice.rules", async importOriginal => ({ ...await importOriginal<object>(), invoiceRequisites: vi.fn() }));
const context = { actorId: id(91), organizationId: id(20) };
function setup() {
  const order = invoiceTestOrder(), documents = new Map<string, any>(), rows = new Map<string, any>(); let next = 100;
  const db: any = { $queryRaw: vi.fn(async () => []),
    supplierOrder: { findFirst: vi.fn(async () => ({ id: order.id })), findUniqueOrThrow: vi.fn(async () => order) },
    orderInvoicePreparation: {
      findUnique: vi.fn(async ({ where }: any) => [...rows.values()].find(row => row.idempotencyKey === where.supplierOrderId_idempotencyKey.idempotencyKey) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => ({ ...rows.get(where.documentId), document: documents.get(where.documentId) })),
      findFirst: vi.fn(async ({ where }: any) => { const row = where.documentId ? rows.get(where.documentId) : [...rows.values()].at(-1); return row ? { ...row, document: documents.get(row.documentId) } : null; }),
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: any) => { const row = { confirmedAt: null, confirmedByName: null, ...data }; rows.set(data.documentId, row); return row; }),
      update: vi.fn(async ({ where, data }: any) => Object.assign(rows.get(where.documentId), data)),
    },
    invoiceNumberCounter: { upsert: vi.fn(async () => ({ value: 1n })) },
    document: {
      create: vi.fn(async ({ data }: any) => { const row = { id: id(next++), checksumSha256: null, immutableAt: null, ...data }; documents.set(row.id, row); return row; }),
      update: vi.fn(async ({ where, data }: any) => Object.assign(documents.get(where.id), data)),
      updateMany: vi.fn(async ({ where, data }: any) => { const row = documents.get(where.id); if (row && (!where.status || where.status.in.includes(row.status))) Object.assign(row, data); return { count: row ? 1 : 0 }; }),
    }, user: { findUniqueOrThrow: vi.fn(async () => ({ displayName: "Поставщик" })) }, auditLog: { create: vi.fn() },
  };
  db.$transaction = vi.fn(async (run: any) => run(db));
  const renderer = { render: vi.fn(async (_snapshot: unknown, confirmed?: unknown) => Buffer.from(confirmed ? "final-pdf" : "preview-pdf")) };
  const storage = { put: vi.fn(), get: vi.fn(async () => Buffer.from("preview-pdf")) }, access = { hasAll: vi.fn(async () => true) };
  return { db, order, documents, rows, renderer, storage, access, service: new OrderInvoiceService(db, access as never, renderer as never, storage as never) };
}
beforeEach(() => vi.mocked(invoiceRequisites).mockImplementation(async (_db, organizationId) => ({ current: invoiceTestRevision(organizationId === id(20) ? 1 : 2), issues: [] })));
describe("invoice preparation and confirmation", () => {
  it("reserves one number/version on replay, with immutable snapshot", async () => {
    const f = setup(), input = { expectedVersion: 1, idempotencyKey: "prepare-one" };
    const first = await f.service.prepare(id(10), input, context);
    expect(await f.service.prepare(id(10), input, context)).toEqual(first);
    expect(first).toMatchObject({ status: "PREVIEW", version: 1, snapshot: { totalMinor: "11600", baseMinor: "10000", vatMinor: "1600" } });
    expect(f.db.invoiceNumberCounter.upsert).toHaveBeenCalledTimes(1); expect(f.renderer.render).toHaveBeenCalledTimes(1);
    await expect(f.service.prepare(id(10), { ...input, expectedVersion: 2 }, context)).rejects.toThrow(/Ключ/);
  });
  it("resumes a failed renderer with the same reservation", async () => {
    const f = setup(), input = { expectedVersion: 1, idempotencyKey: "prepare-one" };
    f.renderer.render.mockRejectedValueOnce(new Error("render unavailable"));
    await expect(f.service.prepare(id(10), input, context)).rejects.toThrow("render unavailable");
    expect([...f.documents.values()][0].status).toBe("FAILED");
    expect(await f.service.prepare(id(10), input, context)).toMatchObject({ status: "PREVIEW", version: 1 });
    expect(f.db.invoiceNumberCounter.upsert).toHaveBeenCalledTimes(1); expect(f.db.document.create).toHaveBeenCalledTimes(1);
  });
  it("refuses denied roles/foreign orders before reserving a number", async () => {
    const f = setup(); f.access.hasAll.mockResolvedValue(false);
    await expect(f.service.prepare(id(10), { expectedVersion: 1, idempotencyKey: "prepare-one" }, context)).rejects.toMatchObject({ status: 403 });
    expect(f.db.supplierOrder.findFirst).not.toHaveBeenCalled();
    f.access.hasAll.mockResolvedValue(true); f.db.supplierOrder.findFirst.mockResolvedValue(null);
    await expect(f.service.prepare(id(10), { expectedVersion: 1, idempotencyKey: "prepare-one" }, context)).rejects.toMatchObject({ status: 404 });
    expect(f.db.invoiceNumberCounter.upsert).not.toHaveBeenCalled();
  });
  it("does not reserve a number for missing requisites", async () => {
    const f = setup(); vi.mocked(invoiceRequisites).mockResolvedValue({ current: null, issues: [{ party: "BUYER", code: "UNCONFIRMED", message: "Реквизиты не подтверждены" }] });
    await expect(f.service.prepare(id(10), { expectedVersion: 1, idempotencyKey: "prepare-one" }, context)).rejects.toMatchObject({ status: 409 });
    expect(f.db.invoiceNumberCounter.upsert).not.toHaveBeenCalled();
  });
  it("confirms the reviewed snapshot and stores final bytes plus actor metadata", async () => {
    const f = setup(), draft = await f.service.prepare(id(10), { expectedVersion: 1, idempotencyKey: "prepare-one" }, context);
    const result = await f.service.confirm(f.db, id(10), draft.documentId, draft.checksum!, context);
    expect(result.status).toBe("GENERATED"); expect(result.immutableAt).toBeInstanceOf(Date);
    expect(result.checksumSha256).toBe(createHash("sha256").update("final-pdf").digest("hex"));
    expect(f.rows.get(draft.documentId).confirmedById).toBe(context.actorId);
    await expect(f.service.confirm(f.db, id(10), draft.documentId, draft.checksum!, context)).rejects.toMatchObject({ status: 409 });
  });
  it("rejects altered previews, changed orders and changed requisites", async () => {
    const f = setup(), draft = await f.service.prepare(id(10), { expectedVersion: 1, idempotencyKey: "prepare-one" }, context);
    await expect(f.service.confirm(f.db, id(10), draft.documentId, "0".repeat(64), context)).rejects.toMatchObject({ status: 409 });
    f.order.version++;
    await expect(f.service.confirm(f.db, id(10), draft.documentId, draft.checksum!, context)).rejects.toThrow(/изменились/);
    f.order.version--;
    vi.mocked(invoiceRequisites).mockImplementation(async (_db, organizationId) => ({ current: { ...invoiceTestRevision(organizationId === id(20) ? 1 : 2), version: 2 }, issues: [] }));
    await expect(f.service.confirm(f.db, id(10), draft.documentId, draft.checksum!, context)).rejects.toThrow(/изменились/);
    expect(f.db.orderInvoicePreparation.update).not.toHaveBeenCalled();
  });
  it("does not replace the current invoice before successful new confirmation", async () => {
    const f = setup(); f.order.manualInvoiceDocumentId = id(98);
    const draft = await f.service.prepare(id(10), { expectedVersion: 1, idempotencyKey: "prepare-one" }, context);
    expect(f.db.document.updateMany).not.toHaveBeenCalled();
    f.order.transferClaims = [{ status: "PENDING" }] as typeof f.order.transferClaims;
    await expect(f.service.confirm(f.db, id(10), draft.documentId, draft.checksum!, context)).rejects.toMatchObject({ status: 409 });
    expect(f.db.orderInvoicePreparation.update).not.toHaveBeenCalled();
  });
});
