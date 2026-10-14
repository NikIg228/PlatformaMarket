import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { SupplierVatService } from "./supplier-vat.service";
import { assertVatCurrent, currentVatProfile, declareVat, resolvePriceVat, validateVatSelection } from "./vat-rules";
import type { VatProfile, VatSelection } from "@marketplace/schemas";

const supplier = "00000000-0000-4000-8000-000000000001", actor = "00000000-0000-4000-8000-000000000002";
const offerId = "00000000-0000-4000-8000-000000000003", periodId = "00000000-0000-4000-8000-000000000004";
const revisionId = "00000000-0000-4000-8000-000000000005";
const context = { actorId: actor, organizationId: supplier };
const selection: VatSelection = { mode: "TAXABLE", rate: "16", basis: null };
const profile: VatProfile = { revisionId, version: 1, organizationVersion: 1, taxPeriodId: periodId, status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null };
function fixture() {
  const revision = { id: revisionId, version: 1, confirmedAt: new Date(),
    fields: { legalForm: "LEGAL_ENTITY", bankAccounts: [], defaultBankAccountId: null,
      taxPeriods: [{ id: periodId, status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null, reference: null }] },
    source: { organizationVersion: 1, legalName: "Поставщик", displayName: "Поставщик", identifier: "123456789012", profile: null,
      legalAddressText: null, deliveryAddressText: null, profileComplete: true, requiresPaymentDetails: true } };
  const offer = { id: offerId, version: 1, status: "ACTIVE", sourceType: "MANUAL", productVariant: { product: { canonicalName: "Товар" } },
    prices: [{ id: "00000000-0000-4000-8000-000000000006", amountMinor: new Prisma.Decimal("100000"), currency: "KZT", taxSnapshot: null,
      source: "MANUAL", validTo: null, lastConfirmedAt: new Date("2026-10-01T00:00:00Z"), freshnessExpiresAt: new Date("2026-11-01T00:00:00Z") }] };
  const db = {
    organizationRequisites: { findUnique: vi.fn().mockResolvedValue({ version: 1 }) },
    organizationRequisitesRevision: { findUnique: vi.fn().mockResolvedValue(revision) }, organization: { findUnique: vi.fn().mockResolvedValue({ version: 1 }) },
    supplierProfile: { findFirst: vi.fn().mockResolvedValue({ organizationId: supplier }) },
    supplierVatSettings: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
    supplierOffer: { findMany: vi.fn().mockResolvedValue([offer]), update: vi.fn() },
    offerPrice: { update: vi.fn(), create: vi.fn() }, offerPriceHistory: { create: vi.fn() },
    idempotencyRecord: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() }, $queryRaw: vi.fn(), $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((run: (db: unknown) => unknown) => run(db));
  const permissions = { hasAll: vi.fn().mockResolvedValue(true) };
  const service = new SupplierVatService(db as never, permissions as never);
  return { db, service, permissions, revision, offer };
}
describe("supplier VAT profile and inheritance", () => {
  it("keeps valid current profile editable when an old default needs reconfirmation", async () => {
    const f = fixture();
    f.db.supplierVatSettings.findUnique.mockResolvedValue({ version: 2, defaultTax: declareVat(selection, { ...profile, version: 2 }, actor) });
    const state = await f.service.current(supplier, context);
    expect(state.profileIssue).toBeNull(); expect(state.profile).toEqual(profile);
    expect(state.defaultIssue).toContain("Налоговый профиль поставщика изменился");
  });
  it("requires confirmed current requisites and the applicable dated tax status", async () => {
    const f = fixture(); expect(await currentVatProfile(f.db as never, supplier, "2026-10-14")).toEqual(profile);
    f.revision.confirmedAt = null as never; await expect(currentVatProfile(f.db as never, supplier)).rejects.toMatchObject({ status: 409 });
    f.revision.confirmedAt = new Date(); f.db.organization.findUnique.mockResolvedValue({ version: 2 });
    await expect(currentVatProfile(f.db as never, supplier)).rejects.toMatchObject({ status: 409 });
  });
  it("rejects contradictory payer modes, missing basis and inapplicable rates", () => {
    expect(() => validateVatSelection({ mode: "NOT_VAT_PAYER", rate: null, basis: null }, profile)).toThrow();
    expect(() => validateVatSelection(selection, { ...profile, status: "NOT_VAT_PAYER" })).toThrow();
    expect(() => validateVatSelection({ mode: "TAXABLE", rate: "10", basis: "Перечень №1204" }, profile, "2026-10-14")).toThrow();
    expect(() => validateVatSelection({ mode: "EXEMPT", rate: null, basis: null }, profile)).toThrow();
  });
  it("applies a default only to a new price and preserves an existing exception or legacy unknown", async () => {
    const f = fixture(), defaults = declareVat(selection, profile, actor, "SUPPLIER_DEFAULT", 2);
    f.db.supplierVatSettings.findUnique.mockResolvedValue({ defaultTax: defaults, version: 2 });
    const fresh = await resolvePriceVat(f.db as never, supplier, actor, null); expect(fresh).toMatchObject({ source: "SUPPLIER_DEFAULT", defaultVersion: 2 });
    const exception = declareVat({ mode: "ZERO_RATED", rate: "0", basis: "Подтверждённое основание" }, profile, actor);
    expect(await resolvePriceVat(f.db as never, supplier, actor, { taxSnapshot: exception })).toEqual(exception);
    expect(await resolvePriceVat(f.db as never, supplier, actor, { taxSnapshot: null })).toBeNull();
    expect(f.db.supplierVatSettings.findUnique).toHaveBeenCalledTimes(1);
  });
  it("gives an explicit row priority and rejects stale profile versions", async () => {
    const f = fixture(), explicit = { selection, expectedRequisitesVersion: 1, acknowledged: true as const };
    const result = await resolvePriceVat(f.db as never, supplier, actor, null, explicit,
      { ...explicit, selection: { mode: "EXEMPT", rate: null, basis: "Подтверждённое основание" } });
    expect(result?.selection).toEqual(selection); expect(result?.source).toBe("EXPLICIT");
    await expect(resolvePriceVat(f.db as never, supplier, actor, null, { ...explicit, expectedRequisitesVersion: 2 })).rejects.toMatchObject({ status: 409 });
    const old = declareVat(selection, { ...profile, version: 2 }, actor);
    await expect(assertVatCurrent(f.db as never, supplier, old)).rejects.toMatchObject({ status: 409 });
  });
  it("does not fabricate classification for a legacy price without declarations", async () => {
    const f = fixture(); expect(await resolvePriceVat(f.db as never, supplier, actor, null)).toBeNull();
    expect(f.db.organizationRequisites.findUnique).not.toHaveBeenCalled();
  });
  it("uses the captured import default even when current settings have changed", async () => {
    const f = fixture(), frozen = declareVat(selection, profile, actor, "SUPPLIER_DEFAULT", 2);
    expect(await resolvePriceVat(f.db as never, supplier, actor, null, undefined, undefined, frozen)).toEqual(frozen);
    expect(await resolvePriceVat(f.db as never, supplier, actor, null, undefined, undefined, null)).toBeNull();
    expect(f.db.supplierVatSettings.findUnique).not.toHaveBeenCalled();
    f.db.organization.findUnique.mockResolvedValue({ version: 2 });
    await expect(resolvePriceVat(f.db as never, supplier, actor, null, undefined, undefined, frozen)).rejects.toMatchObject({ status: 409 });
  });
});
describe("default settings and atomic bulk command boundaries", () => {
  const command = { expectedVersion: 0, expectedRequisitesVersion: 1, selection, acknowledged: true as const, idempotencyKey: "settings-key-01" };
  const bulk = { offerIds: [offerId], tax: { selection, expectedRequisitesVersion: 1, acknowledged: true as const } };
  it("denies tenant/role access before reading supplier data", async () => {
    const f = fixture(); await expect(f.service.current(supplier, { ...context, organizationId: actor })).rejects.toMatchObject({ status: 403 });
    expect(f.db.supplierProfile.findFirst).not.toHaveBeenCalled();
    f.permissions.hasAll.mockResolvedValue(false); await expect(f.service.save(supplier, command, context)).rejects.toMatchObject({ status: 403 });
    expect(f.db.$transaction).not.toHaveBeenCalled();
  });
  it("saves only the default with version/audit/outbox and never rewrites offers", async () => {
    const f = fixture(); await f.service.save(supplier, command, context);
    expect(f.db.supplierVatSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ defaultTax: expect.objectContaining({ selection }) }) }));
    expect(f.db.offerPrice.create).not.toHaveBeenCalled(); expect(f.db.auditLog.create).toHaveBeenCalledTimes(1);
    expect(f.db.outboxEvent.create).toHaveBeenCalledTimes(1); expect(f.db.idempotencyRecord.create).toHaveBeenCalledTimes(1);
  });
  it("rejects stale settings and reused keys with changed payload", async () => {
    const f = fixture(); f.db.supplierVatSettings.findUnique.mockResolvedValue({ version: 2 });
    await expect(f.service.save(supplier, command, context)).rejects.toMatchObject({ status: 409 });
    expect(f.db.supplierVatSettings.upsert).not.toHaveBeenCalled();
    f.db.idempotencyRecord.findUnique.mockResolvedValue({ requestHash: "other", responseBody: {} });
    await expect(f.service.save(supplier, command, context)).rejects.toMatchObject({ status: 409 });
  });
  it("returns a read-only preview and applies tax without changing money or freshness", async () => {
    const f = fixture(), preview = await f.service.preview(supplier, bulk, context);
    expect(preview.changedCount).toBe(1); expect(f.db.offerPrice.create).not.toHaveBeenCalled();
    const result = await f.service.apply(supplier, { ...bulk, previewHash: preview.previewHash, idempotencyKey: "bulk-key-01" }, context);
    expect(result.updatedOfferIds).toEqual([offerId]);
    expect(f.db.offerPrice.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amountMinor: f.offer.prices[0].amountMinor,
      lastConfirmedAt: f.offer.prices[0].lastConfirmedAt, freshnessExpiresAt: f.offer.prices[0].freshnessExpiresAt,
      includesVat: true, vatRate: 16, taxSnapshot: expect.objectContaining({ selection }) }) });
  });
  it("rejects a changed offer after preview before any write", async () => {
    const f = fixture(), preview = await f.service.preview(supplier, bulk, context); f.offer.version++;
    await expect(f.service.apply(supplier, { ...bulk, previewHash: preview.previewHash, idempotencyKey: "bulk-key-01" }, context)).rejects.toMatchObject({ status: 409 });
    expect(f.db.offerPrice.update).not.toHaveBeenCalled();
  });
  it("rejects foreign selections and ERP-managed offers", async () => {
    const f = fixture(); f.db.supplierOffer.findMany.mockResolvedValue([]);
    await expect(f.service.preview(supplier, bulk, context)).rejects.toMatchObject({ status: 404 });
    f.db.supplierOffer.findMany.mockResolvedValue([f.offer]); f.offer.sourceType = "API";
    await expect(f.service.preview(supplier, bulk, context)).rejects.toMatchObject({ status: 409 });
  });
  it("maps serializable conflicts to a recoverable domain error", async () => {
    const f = fixture(); f.db.$transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" }));
    await expect(f.service.save(supplier, command, context)).rejects.toMatchObject({ status: 409 });
  });
});
