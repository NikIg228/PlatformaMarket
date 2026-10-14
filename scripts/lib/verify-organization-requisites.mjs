import { randomUUID } from "node:crypto";

export async function verifyOrganizationRequisites({ prisma, createBuyer, request, runId, assert }) {
  const actors = [];
  for (const index of [41, 42, 43, 44]) actors.push(await createBuyer(index));
  const [clinic, supplier, outsider, viewer] = actors;
  const orgIds = [clinic, supplier, outsider, viewer].map(actor => actor.organizationId);
  const route = "/organizations/current/requisites";
  const reject = `requisites_reject_${process.pid}`;
  const call = async (actor, body, status = body === undefined ? 200 : 201, suffix = "") => {
    const result = await request(route + suffix, { identity: actor, method: body === undefined ? "GET" : "POST", body });
    assert(result.status === status, `Requisites ${suffix || "current"}: expected ${status}, got ${result.status} ${JSON.stringify(result.body)}`);
    return result.body;
  };
  const blank = { legalForm: null, bankAccounts: [], defaultBankAccountId: null, taxPeriods: [] };
  const command = (current, fields = blank) => ({ expectedVersion: current.version, expectedOrganizationVersion: current.source.organizationVersion, idempotencyKey: randomUUID(), fields });
  const confirmation = current => ({ expectedVersion: current.version, expectedOrganizationVersion: current.source.organizationVersion, acknowledged: true, idempotencyKey: randomUUID() });
  try {
    await prisma.organizationCapability.create({ data: { organizationId: supplier.organizationId, capability: "SUPPLIER" } });
    await prisma.organizationProfile.update({ where: { organizationId: supplier.organizationId }, data: { additionalContacts: [1, 2].map(index => ({ contactName: `Reserve ${index}`, phone: "+77000000000", email: `reserve${index}@example.invalid` })) } });
    const viewerRole = await prisma.role.findFirstOrThrow({ where: { organizationId: viewer.organizationId } });
    await prisma.rolePermission.deleteMany({ where: { roleId: viewerRole.id, permission: { code: "organization.members.manage" } } });
    const initial = await call(clinic);
    assert(initial.version === 0 && initial.current === null && initial.canEdit, "Initial draft contract");
    await call({ ...outsider, organizationId: clinic.organizationId }, undefined, 403);
    await call({ ...outsider, organizationId: clinic.organizationId }, undefined, 403, "/history");
    assert(!(await call(viewer)).canEdit, "Viewer must be read-only");
    await call(viewer, command(await call(viewer)), 403);
    await call(viewer, { ...confirmation(initial), expectedVersion: 1 }, 403, "/confirm");
    await call(clinic, { ...command(initial), organizationId: outsider.organizationId }, 400);
    const draft = command(initial);
    const saved = await call(clinic, draft);
    assert(saved.version === 1, "First revision");
    assert((await call(clinic, draft)).revisionId === saved.revisionId, "Idempotent save replay");
    await call(clinic, { ...draft, fields: { ...blank, legalForm: "LEGAL_ENTITY" } }, 409);
    let current = await call(clinic);
    await call(clinic, confirmation(current), 409, "/confirm");
    await call(clinic, { ...confirmation(current), acknowledged: false }, 400, "/confirm");
    const complete = { ...blank, legalForm: "LEGAL_ENTITY" };
    await call(clinic, command(current, complete));
    current = await call(clinic);
    assert(current.readiness.complete && !current.readiness.ready, "Clinic complete without bank/tax but requires confirmation");
    const confirm = confirmation(current);
    await call(clinic, confirm, 201, "/confirm");
    await call(clinic, confirm, 201, "/confirm");
    assert((await call(clinic)).readiness.ready, "Confirmed clinic ready");
    assert(await prisma.outboxEvent.count({ where: { aggregateId: clinic.organizationId, eventType: "OrganizationRequisitesConfirmed" } }) === 1, "Confirmation replay emitted duplicate event");
    const immutableId = current.current.id;
    let immutable = false;
    try { await prisma.organizationRequisitesRevision.update({ where: { id: immutableId }, data: { fields: blank } }); } catch { immutable = true; }
    assert(immutable, "Database must reject payload edits");
    immutable = false;
    try { await prisma.organizationRequisitesRevision.update({ where: { id: immutableId }, data: { confirmedAt: null, confirmedById: null, confirmedByName: null } }); } catch { immutable = true; }
    assert(immutable, "Confirmation cannot be erased");
    await prisma.organization.update({ where: { id: clinic.organizationId }, data: { version: { increment: 1 }, legalName: `Changed ${runId}` } });
    const stale = await call(clinic);
    assert(!stale.readiness.ready && stale.readiness.issues.some(issue => issue.code === "SOURCE_CHANGED"), "Source changes invalidate readiness");
    await call(clinic, { ...confirm, idempotencyKey: randomUUID() }, 409, "/confirm");
    await call(clinic, command(stale, complete));
    current = await call(clinic);
    assert(current.current.confirmedAt === null, "New snapshot must not inherit confirmation");
    const history = await call(clinic, undefined, 200, "/history");
    assert(history.items.length === 3 && history.items[1].id === immutableId && history.items[1].source.legalName !== stale.source.legalName, "History must preserve source and prior confirmation");
    const page = await call(clinic, undefined, 200, "/history?beforeVersion=3");
    assert(page.items.map(value => value.version).join(",") === "2,1", "History cursor isolation");
    assert((await call(outsider, undefined, 200, "/history")).items.length === 0, "Foreign history leaked");
    const supplierInitial = await call(supplier), accountId = randomUUID();
    const supplierFields = { legalForm: "LEGAL_ENTITY", bankAccounts: [{ id: accountId, bankName: "Synthetic Bank", iban: "KZ86125KZT5004100100", bic: "FAKEKZXX", kbe: "17", currency: "KZT" }], defaultBankAccountId: accountId, taxPeriods: [{ id: randomUUID(), status: "VAT_PAYER", effectiveFrom: "2020-01-01", effectiveTo: null, reference: null }] };
    await call(supplier, command(supplierInitial, { ...supplierFields, bankAccounts: [{ ...supplierFields.bankAccounts[0], iban: "KZ00125KZT5004100100" }] }), 400);
    const race = await Promise.all(["A", "B"].map(name => request(route, { identity: supplier, method: "POST", body: command(supplierInitial, { ...supplierFields, bankAccounts: [{ ...supplierFields.bankAccounts[0], bankName: `Bank ${name}` }] }) })));
    assert(race.map(value => value.status).sort().join(",") === "201,409", "Concurrent first save needs one winner");
    current = await call(supplier);
    assert(current.readiness.complete && current.version === 1, "Supplier requires valid bank and effective tax period");
    const before = await prisma.auditLog.count({ where: { organizationId: supplier.organizationId } });
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${reject}"() RETURNS trigger AS $$ BEGIN IF NEW."aggregateId" = '${supplier.organizationId}' AND NEW."eventType" IN ('OrganizationRequisitesSaved', 'OrganizationRequisitesConfirmed') THEN RAISE EXCEPTION 'synthetic requisites outbox failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${reject}" BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION "${reject}"()`);
    const failedSave = command(current, supplierFields), failedConfirm = confirmation(current);
    // Ensure a real payload change whichever contender won.
    failedSave.fields.bankAccounts[0].bankName = "Rollback Bank";
    await call(supplier, failedSave, 500);
    await call(supplier, failedConfirm, 500, "/confirm");
    assert((await call(supplier)).version === 1 && (await call(supplier)).current.confirmedAt === null, "Rollback leaked revision or confirmation");
    assert(await prisma.auditLog.count({ where: { organizationId: supplier.organizationId } }) === before, "Rollback leaked audit");
    assert(await prisma.idempotencyRecord.count({ where: { key: { in: [failedSave.idempotencyKey, failedConfirm.idempotencyKey] } } }) === 0, "Rollback leaked replay records");
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${reject}" ON "OutboxEvent"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${reject}"()`);
    await call(supplier, failedConfirm, 201, "/confirm");
    assert((await call(supplier)).readiness.ready, "Retry after rollback must succeed");
    const supplierRole = await prisma.role.findFirstOrThrow({ where: { organizationId: supplier.organizationId } });
    await prisma.rolePermission.deleteMany({ where: { roleId: supplierRole.id, permission: { code: "organization.members.manage" } } });
    await call(supplier, failedConfirm, 403, "/confirm");
    console.log("Requisites PostgreSQL/API PASS: tenant/role/revocation, validation, immutable history, source change, replay, first-save race, save+confirm rollback/recovery");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${reject}" ON "OutboxEvent"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${reject}"()`);
    await prisma.organizationRequisitesRevision.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organizationRequisites.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: orgIds }, eventType: { in: ["OrganizationRequisitesSaved", "OrganizationRequisitesConfirmed"] } } });
    await prisma.idempotencyRecord.deleteMany({ where: { scope: { in: orgIds.flatMap(id => [`organization-requisites:${id}:save`, `organization-requisites:${id}:confirm`]) } } });
  }
}
