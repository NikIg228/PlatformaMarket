import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { SaveOrganizationRequisitesInput } from "@marketplace/schemas";
import { OrganizationRequisitesService } from "./organization-requisites.service";
import { requisitesDate, requisitesReadiness } from "./organization-requisites.rules";

const organizationId = "10000000-0000-4000-8000-000000000001", actorId = "10000000-0000-4000-8000-000000000002", cityId = "10000000-0000-4000-8000-000000000003";
const accountId = "10000000-0000-4000-8000-000000000004", context = { organizationId, actorId };
const fields: SaveOrganizationRequisitesInput["fields"] = {
  legalForm: "LEGAL_ENTITY", defaultBankAccountId: accountId,
  bankAccounts: [{ id: accountId, bankName: "Fixture bank", iban: "KZ86125KZT5004100100", bic: "FAKEKZXX", kbe: "17", currency: "KZT" }],
  taxPeriods: [{ id: accountId, status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null, reference: null }],
};
const input: SaveOrganizationRequisitesInput = { expectedVersion: 0, expectedOrganizationVersion: 1, idempotencyKey: "requisites-save-1", fields };
const confirmation = { expectedVersion: 1, expectedOrganizationVersion: 1, idempotencyKey: "confirm-requisites-1", acknowledged: true as const };

function setup() {
  const organization = { id: organizationId, version: 1, legalName: "Fixture supplier", displayName: "Fixture", bin: "999999999999", capabilities: [{ capability: "SUPPLIER" }] };
  const address = { organizationId, cityId, line1: "Fixture street 1", postalCode: null };
  const contact = { contactName: "Fixture contact", phone: "+77000000000", email: "fixture@example.invalid" };
  const profile = { ...contact, additionalContacts: [contact, contact], legalAddress: address, deliveryAddress: address };
  let head: { organizationId: string; version: number } | null = null;
  const rows = new Map<number, any>(), records = new Map<string, any>();
  const db: any = {
    organizationMembership: { findFirst: vi.fn(async () => ({ organization, user: { displayName: "Fixture owner" } })) },
    organizationProfile: { findUnique: vi.fn(async () => profile) },
    city: { findMany: vi.fn(async () => [{ id: cityId, nameRu: "Fixture city", region: { nameRu: "Fixture region", country: { nameRu: "Fixture country" } } }]) },
    organizationRequisites: {
      findUnique: vi.fn(async () => head), upsert: vi.fn(async () => head ??= { organizationId, version: 0 }),
      updateMany: vi.fn(async ({ where, data }: any) => { if (!head || head.version !== where.version || head.organizationId !== where.organizationId) return { count: 0 }; head.version = data.version; return { count: 1 }; }),
    },
    organizationRequisitesRevision: {
      findUniqueOrThrow: vi.fn(async ({ where }: any) => rows.get(where.organizationId_version.version)),
      findMany: vi.fn(async ({ where, take }: any) => [...rows.values()].filter(row => row.organizationId === where.organizationId && (!where.version || row.version < where.version.lt)).sort((a, b) => b.version - a.version).slice(0, take)),
      create: vi.fn(async ({ data }: any) => { const row = structuredClone({ id: randomUUID(), createdAt: new Date(), confirmedAt: null, confirmedById: null, confirmedByName: null, ...data }); rows.set(data.version, row); return row; }),
      updateMany: vi.fn(async ({ where, data }: any) => { const row = rows.get(where.version); if (!row || row.organizationId !== where.organizationId || row.id !== where.id || row.confirmedAt !== null) return { count: 0 }; Object.assign(row, data); return { count: 1 }; }),
    },
    idempotencyRecord: {
      findUnique: vi.fn(async ({ where }: any) => records.get(`${where.scope_key.scope}:${where.scope_key.key}`) ?? null),
      create: vi.fn(async ({ data }: any) => records.set(`${data.scope}:${data.key}`, data)),
    },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() },
  };
  db.$transaction = vi.fn(async (run: any) => run(db));
  return { db, organization, profile, rows, service: new OrganizationRequisitesService(db) };
}

describe("requisites draft lifecycle", () => {
  it("reads a new profile without writes, with missing-field reasons", async () => {
    const t = setup(), current = await t.service.current(context);
    expect(current).toMatchObject({ version: 0, current: null, canEdit: true, readiness: { complete: false, ready: false } });
    expect(current.readiness.issues.map(issue => issue.code)).toEqual(["LEGAL_FORM_REQUIRED", "BANK_ACCOUNT_REQUIRED", "TAX_STATUS_REQUIRED", "UNCONFIRMED"]);
    expect(t.db.organizationRequisites.upsert).not.toHaveBeenCalled();
  });
  it("denies foreign/inactive membership before reading sensitive data or writing", async () => {
    const t = setup(); t.db.organizationMembership.findFirst.mockResolvedValue(null);
    await expect(t.service.current(context)).rejects.toMatchObject({ status: 403 });
    await expect(t.service.save(input, context)).rejects.toMatchObject({ status: 403 });
    await expect(t.service.history({}, context)).rejects.toMatchObject({ status: 403 });
    await expect(t.service.confirm(confirmation, context)).rejects.toMatchObject({ status: 403 });
    expect(t.db.organizationProfile.findUnique).not.toHaveBeenCalled(); expect(t.db.organizationRequisitesRevision.findMany).not.toHaveBeenCalled();
    expect(t.db.organizationRequisites.upsert).not.toHaveBeenCalled();
    expect(t.db.organizationMembership.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId, userId: actorId, status: "ACTIVE", user: { status: "ACTIVE" } }) }));
  });
  it("allows a viewer to read but not mutate", async () => {
    const t = setup(); t.db.organizationMembership.findFirst.mockImplementation(async ({ where }: any) => where.roles.some.role.permissions.some.permission.code === "organization.members.manage" ? null : { organization: t.organization, user: { displayName: "Viewer" } });
    expect((await t.service.current(context)).canEdit).toBe(false);
    await expect(t.service.save(input, context)).rejects.toMatchObject({ status: 403 });
    await expect(t.service.confirm(confirmation, context)).rejects.toMatchObject({ status: 403 });
    expect(t.db.organizationRequisites.upsert).not.toHaveBeenCalled();
  });
  it("creates an unconfirmed immutable snapshot, and replays without duplicate version/audit", async () => {
    const t = setup(), result = await t.service.save(input, context);
    expect(await t.service.save(input, context)).toEqual(result);
    expect(t.db.organizationRequisitesRevision.create).toHaveBeenCalledTimes(1);
    expect(t.db.auditLog.create).toHaveBeenCalledTimes(1); expect(t.db.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(await t.service.current(context)).toMatchObject({ version: 1, readiness: { complete: true, confirmed: false, ready: false }, current: { fields, source: { legalName: "Fixture supplier" } } });
    t.organization.legalName = "Changed supplier"; t.organization.version++;
    expect(t.rows.get(1).source.legalName).toBe("Fixture supplier");
    expect((await t.service.current(context)).readiness.issues.map(issue => issue.code)).toContain("SOURCE_CHANGED");
  });
  it("does not create a new version for an identical save, but renews a changed source snapshot", async () => {
    const t = setup(), original = await t.service.save(input, context);
    expect(await t.service.save({ ...input, expectedVersion: 1, idempotencyKey: "no-change-save" }, context)).toEqual(original);
    t.organization.version++; t.profile.legalAddress.line1 = "Changed legal address";
    expect(await t.service.save({ ...input, expectedVersion: 1, expectedOrganizationVersion: 2, idempotencyKey: "new-source-save" }, context)).toMatchObject({ version: 2 });
    expect(t.rows.get(1).source.profile.legalAddress.line1).toBe("Fixture street 1");
    expect(t.rows.get(2).source.profile.legalAddress.line1).toBe("Changed legal address");
  });
  it("rejects stale source, stale version, reused key payload and invalid bank data", async () => {
    const t = setup();
    await expect(t.service.save({ ...input, expectedOrganizationVersion: 2 }, context)).rejects.toMatchObject({ status: 409 });
    await t.service.save(input, context);
    await expect(t.service.save({ ...input, fields: { ...fields, legalForm: "INDIVIDUAL_ENTREPRENEUR" } }, context)).rejects.toMatchObject({ status: 409 });
    await expect(t.service.save({ ...input, idempotencyKey: "stale-save-key" }, context)).rejects.toMatchObject({ status: 409 });
    await expect(t.service.save({ ...input, fields: { ...fields, bankAccounts: [{ ...fields.bankAccounts[0], iban: "KZ00" }] } }, context)).rejects.toMatchObject({ status: 400 });
    expect(t.db.auditLog.create).toHaveBeenCalledTimes(1);
  });
  it("keeps history bounded and scoped to the current organization", async () => {
    const t = setup();
    for (let version = 0; version < 22; version++) await t.service.save({ ...input, expectedVersion: version, idempotencyKey: `history-version-${version}`, fields: { ...fields, taxPeriods: [{ ...fields.taxPeriods[0], reference: `version ${version}` }] } }, context);
    const first = await t.service.history({}, context);
    expect(first.items).toHaveLength(20); expect(first.nextBeforeVersion).toBe(3);
    expect((await t.service.history({ beforeVersion: 3 }, context)).items.map(item => item.version)).toEqual([2, 1]);
    expect(t.db.organizationRequisitesRevision.findMany).toHaveBeenLastCalledWith({ where: { organizationId, version: { lt: 3 } }, orderBy: { version: "desc" }, take: 21 });
  });
  it("does not require a buyer to provide supplier payment details, and uses Kazakhstan date boundaries", async () => {
    const t = setup(); t.organization.capabilities = [{ capability: "BUYER" }];
    await t.service.save({ ...input, fields: { ...fields, bankAccounts: [], defaultBankAccountId: null, taxPeriods: [] } }, context);
    const result = await t.service.current(context); expect(result.readiness.complete).toBe(true);
    expect(requisitesDate(new Date("2026-01-01T19:00:00Z"))).toBe("2026-01-02");
    const supplier = { ...result.source, requiresPaymentDetails: true };
    const current = { ...result.current!, fields: { ...fields, taxPeriods: [{ ...fields.taxPeriods[0], effectiveTo: "2026-01-01" }] }, source: supplier };
    expect(requisitesReadiness(supplier, current, new Date("2026-01-01T18:59:59Z")).complete).toBe(true);
    expect(requisitesReadiness(supplier, current, new Date("2026-01-01T19:00:00Z")).issues.map(issue => issue.code)).toContain("TAX_STATUS_REQUIRED");
  });
});

describe("requisites confirmation lifecycle", () => {
  it("confirms only metadata once and preserves an earlier confirmed revision on amendment", async () => {
    const t = setup(); const saved = await t.service.save(input, context);
    const content = structuredClone(t.rows.get(1).fields);
    expect(await t.service.confirm(confirmation, context)).toEqual(saved);
    expect(await t.service.confirm(confirmation, context)).toEqual(saved);
    expect(await t.service.confirm({ ...confirmation, idempotencyKey: "confirmation-new-key" }, context)).toEqual(saved);
    expect((await t.service.current(context)).readiness.ready).toBe(true);
    expect(t.db.organizationRequisitesRevision.updateMany).toHaveBeenCalledTimes(1);
    expect(t.db.auditLog.create).toHaveBeenCalledTimes(2);
    expect(t.rows.get(1).fields).toEqual(content);
    expect(t.rows.get(1).confirmedById).toBe(actorId);
    await t.service.save({ ...input, expectedVersion: 1, idempotencyKey: "amend-requisites", fields: { ...fields, bankAccounts: [{ ...fields.bankAccounts[0], bankName: "Amended bank name" }] } }, context);
    expect(await t.service.current(context)).toMatchObject({ version: 2, readiness: { confirmed: false, ready: false } });
    expect(t.rows.get(1).confirmedAt).toBeInstanceOf(Date); expect(t.rows.get(1).fields).toEqual(content);
  });
  it("blocks incomplete, expired or stale source snapshots without confirmation writes", async () => {
    const t = setup(); await t.service.save({ ...input, fields: { ...fields, taxPeriods: [] } }, context);
    await expect(t.service.confirm(confirmation, context)).rejects.toMatchObject({ status: 409, response: { code: "ORGANIZATION_REQUISITES_INCOMPLETE" } });
    expect(t.db.organizationRequisitesRevision.updateMany).not.toHaveBeenCalled();
    await t.service.save({ ...input, expectedVersion: 1, idempotencyKey: "complete-draft" }, context);
    t.organization.version++;
    await expect(t.service.confirm({ ...confirmation, expectedVersion: 2 }, context)).rejects.toMatchObject({ status: 409 });
    await expect(t.service.confirm({ ...confirmation, expectedVersion: 2, expectedOrganizationVersion: 2 }, context)).rejects.toMatchObject({ status: 409, response: { code: "ORGANIZATION_REQUISITES_INCOMPLETE" } });
    expect(t.db.organizationRequisitesRevision.updateMany).not.toHaveBeenCalled();
  });
  it("rejects a stale revision and a lost update, and never accepts an unacknowledged command", async () => {
    const t = setup(); await t.service.save(input, context);
    await expect(t.service.confirm({ ...confirmation, expectedVersion: 2 }, context)).rejects.toMatchObject({ status: 409 });
    await expect(t.service.confirm({ ...confirmation, acknowledged: false } as never, context)).rejects.toMatchObject({ status: 400 });
    t.db.organizationRequisitesRevision.updateMany.mockResolvedValue({ count: 0 });
    await expect(t.service.confirm(confirmation, context)).rejects.toMatchObject({ status: 409 });
    expect(t.db.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
