import { describe, expect, it, vi } from "vitest";
import { ResupplyDocumentService } from "./resupply-document.service";
import { DocumentsService } from "./documents.service";
import { resupplyDocumentFixture, rdId as id } from "./resupply-document.test-fixture";
const context = { actorId: id(91), organizationId: id(1) };
const input = { kind: "TRANSFER" as const, expectedOrderVersion: 2, expectedShipmentVersion: 3, expectedExceptionVersion: 4, expectedResupplyVersion: 2, idempotencyKey: "draft-request-one" };
function setup() {
  const claim = resupplyDocumentFixture(), docs: any[] = [];
  const db: any = { $queryRaw: vi.fn(), supplierOrder: { findFirst: vi.fn(async () => claim.supplierOrder) },
    orderDiscrepancy: { findFirst: vi.fn(async () => claim), count: vi.fn(async () => 0) },
    user: { findUniqueOrThrow: vi.fn(async () => ({ displayName: "Сотрудник" })) },
    document: { findFirst: vi.fn(async ({ where }: any) => docs.filter(d => where.storageKey ? d.storageKey === where.storageKey :
      typeof where.externalId === "string" ? d.externalId === where.externalId : where.id ? d.id === where.id : d.documentNumber === where.documentNumber).at(-1) ?? null),
      findMany: vi.fn(async () => docs), create: vi.fn(async ({ data }: any) => { docs.push(data); return data; }) },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() } };
  db.$transaction = vi.fn(async (run: any) => { const before = docs.length; try { return await run(db); } catch (e) { docs.splice(before); throw e; } });
  const access = { hasAll: vi.fn(async () => true) }, renderer = { render: vi.fn(async () => Buffer.from("draft PDF")) },
    storage = { put: vi.fn(), delete: vi.fn(), get: vi.fn(async () => Buffer.from("draft PDF")) };
  return { claim, docs, db, access, renderer, storage, service: new ResupplyDocumentService(db, access as never, renderer as never, storage as never) };
}
describe("resupply working draft service", () => {
  it("persists one immutable snapshot on replay, exposes both parties and preserves operational state", async () => {
    const f = setup(), before = JSON.stringify(f.claim);
    const first = await f.service.prepare(id(10), id(2), input, context);
    expect(await f.service.prepare(id(10), id(2), input, context)).toEqual(first);
    expect(f.db.document.create).toHaveBeenCalledTimes(1); expect(f.storage.put).toHaveBeenCalledTimes(1);
    expect(f.docs[0]).toMatchObject({ status: "DRAFT", kind: "OTHER", requiredSignatureCount: 2 });
    expect(f.docs[0].participants.create).toContainEqual({ organizationId: id(20), role: "RECIPIENT" });
    expect(JSON.stringify(f.claim)).toBe(before);
    expect((await f.service.list(id(10), id(2), { ...context, organizationId: id(20) })).documents).toHaveLength(1);
    await expect(f.service.prepare(id(10), id(2), { ...input, kind: "SETTLEMENT" }, context)).rejects.toThrow("Ключ повтора");
  });
  it("denies missing permission, buyer writes, foreign order and claim", async () => {
    const f = setup(); f.access.hasAll.mockResolvedValue(false);
    await expect(f.service.prepare(id(10), id(2), input, context)).rejects.toMatchObject({ status: 403 });
    expect(f.db.supplierOrder.findFirst).not.toHaveBeenCalled();
    f.access.hasAll.mockResolvedValue(true);
    await expect(f.service.prepare(id(10), id(2), input, { ...context, organizationId: id(20) })).rejects.toMatchObject({ status: 403 });
    f.db.supplierOrder.findFirst.mockResolvedValueOnce(null);
    await expect(f.service.list(id(10), id(2), context)).rejects.toMatchObject({ status: 404 });
    f.db.orderDiscrepancy.findFirst.mockResolvedValue(null);
    await expect(f.service.prepare(id(10), id(2), input, context)).rejects.toMatchObject({ status: 404 });
    expect(f.db.document.create).not.toHaveBeenCalled();
  });
  it("rejects stale versions and unresolved replacement statements", async () => {
    const f = setup();
    await expect(f.service.prepare(id(10), id(2), { ...input, expectedResupplyVersion: 1 }, context)).rejects.toThrow("изменились");
    f.db.orderDiscrepancy.count.mockResolvedValue(1);
    await expect(f.service.prepare(id(10), id(2), { ...input, kind: "SETTLEMENT" }, context)).rejects.toThrow("отдельное заявление");
    expect(f.storage.put).not.toHaveBeenCalled();
  });
  it("rolls back a failed event and retries without a phantom document", async () => {
    const f = setup(); f.db.outboxEvent.create.mockRejectedValueOnce(new Error("outbox unavailable"));
    await expect(f.service.prepare(id(10), id(2), input, context)).rejects.toThrow("outbox unavailable");
    expect(f.docs).toHaveLength(0); expect(f.storage.delete).toHaveBeenCalledTimes(1);
    expect(await f.service.prepare(id(10), id(2), input, context)).toMatchObject({ version: 1, status: "PREVIEW" });
  });
  it("keeps prior bytes on new version and checks checksum on download", async () => {
    const f = setup(), first = await f.service.prepare(id(10), id(2), input, context), saved = JSON.stringify(f.docs[0]);
    const next = await f.service.prepare(id(10), id(2), { ...input, idempotencyKey: "new-draft-request" }, context);
    expect(next.version).toBe(2); expect(f.docs[1].previousVersionId).toBe(first.documentId);
    expect(JSON.stringify(f.docs[0])).toBe(saved);
    f.storage.get.mockResolvedValue(Buffer.from("corrupted"));
    await expect(f.service.download(id(10), id(2), first.documentId, context)).rejects.toThrow("целостности");
  });
  it("blocks generic regeneration, mock/EDS signing and local EDS signing", async () => {
    const s = new DocumentsService({} as never, {} as never, {} as never, {} as never, {} as never);
    vi.spyOn(s, "get").mockResolvedValue({ externalId: "RESUPPLY_DOCUMENT_PREVIEW:test", status: "DRAFT" } as never);
    await expect(s.createVersion(id(3), { reason: "change", data: {} }, context)).rejects.toThrow("только из заявления");
    for (const method of ["MOCK", "EDS"] as const) await expect(s.createSignatureSession(id(3), { method, expiresInMinutes: 60 }, context)).rejects.toThrow("не утверждены");
    await expect(s.createLocalEdsSignatureSession(id(3), { method: "EDS", expiresInMinutes: 60 }, context)).rejects.toThrow("не утверждены");
  });
});
