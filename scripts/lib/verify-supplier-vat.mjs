import { randomUUID } from "node:crypto";
import { completeFixtureOrganization } from "./organization-profile-fixture.mjs";
import { verifyVatFlows } from "./verify-vat-flows.mjs";

export async function verifySupplierVat({ prisma, createBuyer, createCartWithItem, request, runId, assert, supplierId, offers }) {
  const actor = await createBuyer(31), outsider = await createBuyer(32);
  const role = await prisma.role.create({ data: { organizationId: supplierId, code: `${runId}-vat`, name: "VAT fixture",
    permissions: { create: ["catalog.product.view", "pricing.manage", "organization.view", "organization.members.manage", "import.manage", "integration.view", "integration.manage"].map(code => ({ permission: { connect: { code } } })) } } });
  await prisma.organizationMembership.create({ data: { userId: actor.userId, organizationId: supplierId, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
  const identity = { userId: actor.userId, organizationId: supplierId }, route = `/suppliers/${supplierId}/vat`;
  const trigger = `vat_reject_${process.pid}`;
  const call = async (path, body, expected = body === undefined ? 200 : 201, who = identity) => {
    const result = await request(path, { identity: who, method: body === undefined ? "GET" : "POST", body });
    assert(result.status === expected, `VAT ${path}: expected ${expected}, got ${result.status} ${JSON.stringify(result.body)}`);
    return result.body;
  };
  const requisites = "/organizations/current/requisites";
  const ids = offers.slice(0, 2).map(offer => offer.offerId);
  try {
    await completeFixtureOrganization(prisma, supplierId);
    const head = await call(requisites), bankId = randomUUID();
    await call(requisites, { expectedVersion: head.version, expectedOrganizationVersion: head.source.organizationVersion,
      idempotencyKey: randomUUID(), fields: { legalForm: "LEGAL_ENTITY", bankAccounts: [{ id: bankId, bankName: "Synthetic Bank", iban: "KZ86125KZT5004100100", bic: "FAKEKZXX", kbe: "17", currency: "KZT" }],
        defaultBankAccountId: bankId, taxPeriods: [{ id: randomUUID(), status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null, reference: null }] } });
    const saved = await call(requisites);
    await call(requisites + "/confirm", { expectedVersion: saved.version, expectedOrganizationVersion: saved.source.organizationVersion, acknowledged: true, idempotencyKey: randomUUID() });
    const selection = { mode: "TAXABLE", rate: "16", basis: null }, tax = { selection, expectedRequisitesVersion: saved.version, acknowledged: true };
    const before = await prisma.offerPrice.findMany({ where: { offerId: { in: ids }, status: "ACTIVE" }, orderBy: { offerId: "asc" } });
    assert(before.every(price => price.taxSnapshot === null), "Migration must leave legacy prices unclassified");
    await call(route, undefined, 403, { ...outsider, organizationId: supplierId });
    const saveDefault = { expectedVersion: 0, expectedRequisitesVersion: saved.version, selection, acknowledged: true, idempotencyKey: randomUUID() };
    await call(route, saveDefault); await call(route, saveDefault);
    assert(await prisma.offerPrice.count({ where: { id: { in: before.map(price => price.id) }, status: "ACTIVE" } }) === before.length, "Changing default rewrote existing prices");
    await call(route, { ...saveDefault, idempotencyKey: randomUUID() }, 409);
    await call(route, { ...saveDefault, expectedVersion: 1, selection: { mode: "TAXABLE", rate: "5", basis: null }, idempotencyKey: randomUUID() }, 400);
    const preview = await call(route + "/offers/preview", { offerIds: ids, tax });
    await prisma.supplierOffer.update({ where: { id: ids[0] }, data: { version: { increment: 1 } } });
    await call(route + "/offers/apply", { offerIds: ids, tax, previewHash: preview.previewHash, idempotencyKey: randomUUID() }, 409);
    const fresh = await call(route + "/offers/preview", { offerIds: ids, tax });
    const apply = { offerIds: ids, tax, previewHash: fresh.previewHash, idempotencyKey: randomUUID() };
    const applied = await call(route + "/offers/apply", apply);
    assert(applied.updatedOfferIds.length === ids.length, "Bulk did not update all selected offers");
    await call(route + "/offers/apply", apply);
    const after = await prisma.offerPrice.findMany({ where: { offerId: { in: ids }, status: "ACTIVE" }, orderBy: { offerId: "asc" } });
    assert(after.every((price, index) => price.amountMinor.eq(before[index].amountMinor) &&
      price.freshnessExpiresAt?.getTime() === before[index].freshnessExpiresAt?.getTime() &&
      price.lastConfirmedAt?.getTime() === before[index].lastConfirmedAt?.getTime() && price.taxSnapshot.selection.rate === "16"), "Bulk changed gross/freshness or lost tax declaration");
    const nextTax = { ...tax, selection: { mode: "ZERO_RATED", rate: "0", basis: "Synthetic supplier declaration" } };
    const rollbackPreview = await call(route + "/offers/preview", { offerIds: ids, tax: nextTax });
    const rollbackCommand = { offerIds: ids, tax: nextTax, previewHash: rollbackPreview.previewHash, idempotencyKey: randomUUID() };
    const historyCount = await prisma.offerPriceHistory.count({ where: { offerId: { in: ids } } });
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger AS $$ BEGIN IF NEW."aggregateId" = '${ids[1]}' AND NEW."eventType" = 'OfferTaxChanged' THEN RAISE EXCEPTION 'synthetic VAT rollback'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    await call(route + "/offers/apply", rollbackCommand, 500);
    assert(await prisma.offerPrice.count({ where: { id: { in: after.map(price => price.id) }, status: "ACTIVE" } }) === after.length, "Rollback left a partially changed batch");
    assert(await prisma.offerPriceHistory.count({ where: { offerId: { in: ids } } }) === historyCount, "Rollback leaked price history");
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "OutboxEvent"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${trigger}"()`);
    const race = await Promise.all([1, 2].map(() => request(route + "/offers/apply", { identity, method: "POST", body: { ...rollbackCommand, idempotencyKey: randomUUID() } })));
    assert(race.map(result => result.status).sort().join(",") === "201,409", `Bulk race expected one winner: ${JSON.stringify(race)}`);
    await verifyVatFlows({ prisma, request, assert, supplierId, identity, tax, offers, createBuyer, createCartWithItem, runId });
    await prisma.organization.update({ where: { id: supplierId }, data: { version: { increment: 1 } } });
    await call(route + "/offers/preview", { offerIds: ids, tax }, 409);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permission: { code: "pricing.manage" } } });
    await call(route, { ...saveDefault, expectedVersion: 1, idempotencyKey: randomUUID() }, 403);
    console.log("Supplier VAT PostgreSQL/API PASS: legacy upgrade, tenant/role, default isolation, replay, stale preview, gross/freshness preservation, batch rollback, concurrency, profile invalidation");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "OutboxEvent"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
    await prisma.supplierVatSettings.deleteMany({ where: { supplierOrganizationId: supplierId } });
    await prisma.organizationRequisitesRevision.deleteMany({ where: { organizationId: supplierId } });
    await prisma.organizationRequisites.deleteMany({ where: { organizationId: supplierId } });
    await prisma.idempotencyRecord.deleteMany({ where: { scope: { in: [`supplier-vat:${supplierId}:${actor.userId}`, `offer-vat-bulk:${supplierId}:${actor.userId}`, `organization-requisites:${supplierId}:save`, `organization-requisites:${supplierId}:confirm`] } } });
  }
}
