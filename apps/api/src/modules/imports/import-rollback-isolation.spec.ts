import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ImportsService } from "./imports.service";
import { SupplierAccessService } from "../suppliers/supplier-access.service";

type Row = Record<string, unknown>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const supplier = id(1), foreign = id(2), batchId = id(3), productId = id(4), variantId = id(5), offerId = id(6);
const at = new Date("2026-10-01T00:00:00Z");

// Interpret the relevant Prisma filters; dependencies are real fixture records,
// not a flag returned unconditionally for the proposed guard.
function matches(value: unknown, filter: unknown): boolean {
  if (filter instanceof Date) return value instanceof Date && value.getTime() === filter.getTime();
  if (!filter || typeof filter !== "object") return value === filter;
  const row = value as Row;
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "AND") return (Array.isArray(expected) ? expected : [expected]).every((part) => matches(value, part));
    if (key === "OR") return (expected as unknown[]).some((part) => matches(value, part));
    if (key === "NOT") return !matches(value, expected);
    if (key === "in") return (expected as unknown[]).includes(value);
    if (key === "notIn") return !(expected as unknown[]).includes(value);
    if (key === "not") return !matches(value, expected);
    if (key === "some") return Array.isArray(value) && value.some((item) => matches(item, expected));
    return row != null && matches(row[key], expected);
  });
}

function fixture(dependency?: string) {
  const candidate = { id: id(7), supplierOrganizationId: supplier, status: "APPROVED", approvedProductId: productId, approvedVariantId: variantId };
  const item = { id: id(8), externalId: "synthetic-row", matchedVariantId: variantId, complianceStatus: "READY", complianceReasons: [], productCandidate: candidate };
  const row = { id: id(9), batchId, rowNumber: 1, status: "PUBLISHED", errorCode: null, errorMessage: null, externalItem: item };
  const balance = { id: id(10), supplierOrganizationId: supplier, offerId, quantityOnHand: "10", quantityReserved: "0", quantityAvailable: "10", availabilityStatus: "IN_STOCK", freshnessStatus: "FRESH", version: 1, reservations: [] as Row[] };
  const price = { id: id(11), offerId, status: "ACTIVE", amountMinor: "10000", currency: "KZT" };
  const publication = { offerId, status: "PUBLISHED", marketplaceVisible: true, blockedReason: null, publishedAt: at };
  const offer = { id: offerId, supplierOrganizationId: supplier, sourceId: id(12), sourceType: "IMPORT", externalId: "synthetic-row", status: "ACTIVE", version: 1, createdAt: at, publication,
    productVariantId: variantId, productVariant: { productId }, prices: [price], inventoryBalances: [balance], _count: { supplierOrderItems: 0 } };
  const variant: Row = { id: variantId, productId, status: "ACTIVE", version: 1,
    supplierOffers: [{ id: offerId, supplierOrganizationId: supplier }], inventoryBalances: [{ supplierOrganizationId: supplier }],
    inventoryLots: [], inventoryReservations: [], supplierItems: [], mappingMemories: [], approvedCandidates: [candidate], contractPrices: [] };
  const product: Row = { id: productId, status: "ACTIVE", version: 1, externalMetadata: { batchId }, approvedCandidates: [candidate], contentSources: [], correctionRequests: [] };
  const tableFor: Record<string, string> = { balance: "inventoryBalances", lot: "inventoryLots", reservation: "inventoryReservations", item: "supplierItems", mapping: "mappingMemories", candidate: "approvedCandidates", contract: "contractPrices" };
  if (dependency === "offer" || dependency === "own-independent-offer") (variant.supplierOffers as Row[]).push({ id: id(99), supplierOrganizationId: dependency === "offer" ? foreign : supplier, status: "ARCHIVED" });
  if (tableFor[dependency ?? ""]) (variant[tableFor[dependency!]] as Row[]).push({ id: id(99), supplierOrganizationId: foreign });
  if (dependency === "content") (product.contentSources as Row[]).push({ supplierOrganizationId: foreign });
  if (dependency === "correction") (product.correctionRequests as Row[]).push({ supplierOrganizationId: foreign });
  if (dependency === "parent-mismatch") variant.productId = id(99);
  let state = { batch: { id: batchId, supplierOrganizationId: supplier, sourceId: id(12), status: "COMPLETED", updatedAt: at, startedAt: at, createdAt: at, checksum: "a".repeat(64), processedRows: 1, errorRows: 0, rollbackEvidence: null as unknown, rows: [row] },
    tables: { product: [product], productVariant: [variant], productPackaging: [{ id: id(13), productVariantId: variantId, status: "ACTIVE", version: 1 }], supplierOffer: [offer], inventoryBalance: [balance], offerPrice: [price], offerPublication: [publication], supplierExternalItem: [item], productCandidate: [candidate], supplierMappingMemory: [], supplierItemMatchCandidate: [] } as Record<string, Row[]>,
    audit: [] as unknown[], outbox: [] as unknown[] };
  if (dependency === "sibling") state.tables.productVariant.push({ id: id(99), productId, status: "ACTIVE", supplierOffers: [] });
  const records = (table: string): Row[] => table === "importRow" ? state.batch.rows : state.tables[table];
  const apply = (target: Row, data: Row) => Object.entries(data).forEach(([key, value]) => {
    target[key] = value && typeof value === "object" && "increment" in value ? Number(target[key]) + Number(value.increment) : value;
  });
  const delegate = (table: string) => ({
    findFirst: vi.fn(async ({ where }: { where: Row }) => structuredClone(records(table).find((entry) => matches(entry, where)) ?? null)),
    findMany: vi.fn(async ({ where }: { where: Row }) => structuredClone(records(table).filter((entry) => matches(entry, where)))),
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => { const found = records(table).filter((entry) => matches(entry, where)); found.forEach((entry) => apply(entry, data)); return { count: found.length }; }),
    update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => { const found = records(table).find((entry) => matches(entry, where))!; apply(found, data); return found; }),
  });
  const batch = {
    findFirst: vi.fn(async ({ where }: { where: Row }) => matches(state.batch, where) ? structuredClone(state.batch) : null),
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => { if (!matches(state.batch, where)) return { count: 0 }; apply(state.batch, data); return { count: 1 }; }),
    update: vi.fn(async ({ data }: { data: Row }) => { apply(state.batch, data); return state.batch; }),
  };
  const tx = { importBatch: batch, $queryRaw: vi.fn(async () => [{ id: productId }]), product: delegate("product"), productVariant: delegate("productVariant"), productPackaging: delegate("productPackaging"), supplierOffer: delegate("supplierOffer"), inventoryBalance: delegate("inventoryBalance"), offerPrice: delegate("offerPrice"), offerPublication: delegate("offerPublication"), supplierExternalItem: delegate("supplierExternalItem"), productCandidate: delegate("productCandidate"), importRow: delegate("importRow"), supplierItemMatchCandidate: delegate("supplierItemMatchCandidate"),
    supplierMappingMemory: { ...delegate("supplierMappingMemory"), create: vi.fn() }, uploadAsset: { findFirst: vi.fn(async () => ({ id: id(14) })) },
    auditLog: { create: vi.fn(async ({ data }: { data: unknown }) => { state.audit.push(data); }) }, outboxEvent: { create: vi.fn(async ({ data }: { data: unknown }) => { state.outbox.push(data); }) } };
  const prisma = { importBatch: batch, organizationCapability: { findUnique: vi.fn(async () => null) }, $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
    const saved = structuredClone(state); try { return await callback(tx); } catch (error) { state = saved; throw error; }
  }) };
  const search = { rebuildProduct: vi.fn() };
  const service = new ImportsService(prisma as never, new SupplierAccessService(prisma as never), {} as never, {} as never, {} as never, search as never, {} as never);
  const input = { reason: "Synthetic rollback of this import", expectedUpdatedAt: at.toISOString() };
  const rollback = () => service.rollbackBatch(supplier, batchId, input, { actorId: id(15), organizationId: supplier });
  return { service, input, rollback, tx, prisma, search, state: () => state, snapshot: () => JSON.stringify(state) };
}

describe("import rollback shared catalog isolation", () => {
  it.each(["offer", "own-independent-offer", "sibling", "balance", "lot", "reservation", "item", "mapping", "candidate", "contract", "content", "correction", "parent-mismatch"])("refuses archival with outside-batch dependency: %s", async (dependency) => {
    const f = fixture(dependency); const before = f.snapshot();
    await expect(f.rollback()).rejects.toBeInstanceOf(ConflictException);
    expect(f.snapshot()).toBe(before);
    expect(f.tx.product.updateMany).not.toHaveBeenCalled();
    expect(f.tx.productVariant.updateMany).not.toHaveBeenCalled();
    expect(f.tx.productPackaging.updateMany).not.toHaveBeenCalled();
    expect(f.tx.auditLog.create).not.toHaveBeenCalled();
    expect(f.tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(f.search.rebuildProduct).not.toHaveBeenCalled();
  });

  it("keeps exclusive rollback effects, evidence, search rebuild and idempotent replay", async () => {
    const f = fixture(); const response = await f.rollback();
    expect(response).toMatchObject({ batchId, status: "ROLLED_BACK", preserved: { checksum: "a".repeat(64), rawRows: 1, uploadAsset: true }, effects: { rows: 1, offers: 1, prices: 1, inventoryBalances: 1, products: 1 } });
    expect(f.state().tables.product[0].status).toBe("ARCHIVED");
    expect(f.state().tables.productVariant[0].status).toBe("ARCHIVED");
    expect(f.state().tables.productPackaging[0].status).toBe("INACTIVE");
    expect(f.state().tables.supplierOffer[0].status).toBe("ARCHIVED");
    expect(f.state().audit).toHaveLength(1); expect(f.state().outbox).toHaveLength(1);
    await expect(f.rollback()).resolves.toEqual(response);
    expect(f.state().audit).toHaveLength(1); expect(f.state().outbox).toHaveLength(1);
    expect(f.search.rebuildProduct).toHaveBeenCalledTimes(2);
  });

  it("preserves stale, foreign-tenant and already-used offer denials", async () => {
    const f = fixture();
    await expect(f.service.rollbackBatch(supplier, batchId, { ...f.input, expectedUpdatedAt: new Date(0).toISOString() }, { actorId: id(15), organizationId: supplier })).rejects.toMatchObject({ status: 409 });
    await expect(f.service.rollbackBatch(supplier, batchId, f.input, { actorId: id(15), organizationId: foreign })).rejects.toMatchObject({ status: 403 });
    f.state().tables.supplierOffer[0]._count = { supplierOrderItems: 1 };
    const before = f.snapshot(); await expect(f.rollback()).rejects.toMatchObject({ status: 409 }); expect(f.snapshot()).toBe(before);
  });

  it("keeps rollback of an offer matched to an existing shared card local to that supplier", async () => {
    const f = fixture();
    (f.state().batch.rows[0].externalItem as Row).productCandidate = null;
    f.state().tables.product[0].externalMetadata = { batchId: "another-batch" };
    await expect(f.rollback()).resolves.toMatchObject({ effects: { offers: 1, products: 0 } });
    expect(f.state().tables.supplierOffer[0].status).toBe("ARCHIVED");
    expect(f.state().tables.product[0].status).toBe("ACTIVE");
    expect(f.state().tables.productVariant[0].status).toBe("ACTIVE");
    expect(f.state().tables.productPackaging[0].status).toBe("ACTIVE");
    expect(f.tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("preserves rejected-row-only rollback without inventing catalog effects", async () => {
    const f = fixture();
    f.state().batch.rows[0].status = "REJECTED";
    (f.state().batch.rows[0] as Row).externalItem = null;
    await expect(f.rollback()).resolves.toMatchObject({ effects: { rows: 1, offers: 0, products: 0 } });
    expect(f.state().tables.product[0].status).toBe("ACTIVE");
    expect(f.tx.product.updateMany).not.toHaveBeenCalled();
    expect(f.tx.$queryRaw).not.toHaveBeenCalled();
  });

  it.each(["40001", "40P01"])("keeps raw PostgreSQL %s conflicts retryable as HTTP 409", async (code) => {
    const f = fixture();
    f.prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Synthetic catalog conflict", { code: "P2010", clientVersion: "test", meta: { code } }));
    await expect(f.rollback()).rejects.toMatchObject({ status: 409 });
  });
});
