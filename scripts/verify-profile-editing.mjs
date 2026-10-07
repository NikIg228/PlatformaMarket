import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PersonalProfileService } from "../apps/api/dist/src/modules/identity/personal-profile.service.js";
import { OrganizationProfileService } from "../apps/api/dist/src/modules/organizations/organization-profile.service.js";
import { verifyProfileEmailChange } from "../apps/api/dist/src/modules/identity/profile-email-verification.js";
import { completeFixtureOrganization } from "./lib/organization-profile-fixture.mjs";

const target = new URL(process.env.POSTGRES_TEST_DATABASE_URL ?? "http://invalid");
assert(["127.0.0.1", "localhost"].includes(target.hostname) && target.pathname === "/dentmarket_audit_20260914", "Requires approved disposable database via npm run db:test");
assert.equal(process.env.DATABASE_URL, process.env.POSTGRES_TEST_DATABASE_URL);
const db = new PrismaClient();
const actorId = randomUUID(), organizationId = randomUUID(), sessionId = randomUUID();
const context = { actorId, organizationId, sessionId };
const organizationContext = { actorId, organizationId };
const rollback = new Error("intentional fixture rollback");
const profile = new PersonalProfileService(db, {}, {});
const organizations = new OrganizationProfileService(db);
try {
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, "dentmarket_audit_20260914");
  // Replay the additive migration against old-shaped temporary tables; rollback
  // makes this independent of the real test schema's already-applied migration.
  await assert.rejects(db.$transaction(async tx => {
    await tx.$executeRawUnsafe('CREATE TEMP TABLE "User" (id TEXT, email TEXT) ON COMMIT DROP');
    await tx.$executeRawUnsafe('CREATE TEMP TABLE "OrganizationProfile" ("organizationId" TEXT, "contactName" TEXT) ON COMMIT DROP');
    await tx.$executeRawUnsafe('INSERT INTO "User" VALUES (\'legacy\', \'legacy@example.invalid\')');
    await tx.$executeRawUnsafe('INSERT INTO "OrganizationProfile" VALUES (\'legacy\', \'Existing contact\')');
    const sql = await readFile(new URL("../apps/api/prisma/migrations/20261007190000_profile_contacts/migration.sql", import.meta.url), "utf8");
    for (const statement of sql.replace(/^--.*$/gm, "").split(";").filter(value => value.trim())) await tx.$executeRawUnsafe(statement);
    assert.deepEqual(await tx.$queryRawUnsafe('SELECT "phone", "avatarAssetId", "profileVersion" FROM "User"'), [{ phone: null, avatarAssetId: null, profileVersion: 1 }]);
    assert.deepEqual(await tx.$queryRawUnsafe('SELECT "contactName", "additionalContacts" FROM "OrganizationProfile"'), [{ contactName: "Existing contact", additionalContacts: [] }]);
    throw rollback;
  }), error => error === rollback);
  await db.organization.create({ data: { id: organizationId, legalName: "Synthetic profile verification", displayName: "Synthetic", bin: String(Date.now()).slice(-12), capabilities: { create: { capability: "BUYER" } } } });
  await db.user.create({ data: { id: actorId, email: `${actorId}@example.invalid`, displayName: "Synthetic Profile", memberships: { create: { organizationId, status: "ACTIVE" } } } });
  await db.authSession.create({ data: { id: sessionId, userId: actorId, familyId: randomUUID(), refreshTokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600_000), activeOrganizationId: organizationId, organizationIds: [organizationId] } });
  assert.equal((await profile.current(context)).phone, null);
  await assert.rejects(profile.current({ ...context, actorId: randomUUID() }), error => error.status === 401);
  const writes = await Promise.allSettled([profile.save({ expectedVersion: 1, displayName: "First Writer" }, context), profile.save({ expectedVersion: 1, displayName: "Second Writer" }, context)]);
  assert.equal(writes.filter(value => value.status === "fulfilled").length, 1);
  assert.equal(writes.find(value => value.status === "rejected").reason.status, 409);
  assert.equal(await db.auditLog.count({ where: { actorId, action: "identity.profile.updated" } }), 1);
  // A failure after the CAS must roll the data and audit back together.
  const broken = new PersonalProfileService({ $transaction: run => db.$transaction(tx => run(new Proxy(tx, { get: (target, key) => key === "auditLog" ? { create: () => { throw rollback; } } : target[key] }))) }, {}, {});
  await assert.rejects(broken.save({ expectedVersion: 2, phone: "+77000000001" }, context), error => error === rollback);
  assert.equal((await profile.current(context)).phone, null);
  await completeFixtureOrganization(db, organizationId);
  process.env.ACCESS_CONTROL_MODE = "FULL_ACCESS";
  const base = await organizations.current(organizationContext);
  const extra = [{ contactName: "Second Contact", phone: "+77000000002", email: "second@example.invalid" }];
  const input = { ...base.profile, additionalContacts: extra, expectedVersion: base.version, idempotencyKey: randomUUID() };
  const saved = await organizations.save(input, organizationContext);
  assert.deepEqual(saved.profile.additionalContacts, extra);
  assert.equal((await organizations.save(input, organizationContext)).version, saved.version);
  await assert.rejects(organizations.save({ ...input, idempotencyKey: randomUUID() }, organizationContext), error => error.status === 409);
  await assert.rejects(organizations.current({ ...organizationContext, organizationId: randomUUID() }), error => error.status === 403);
  process.env.ACCESS_CONTROL_MODE = "ROLE_BASED";
  await assert.rejects(organizations.save({ ...input, expectedVersion: saved.version, idempotencyKey: randomUUID() }, organizationContext), error => error.status === 403);
  const previousEmail = `${actorId}@example.invalid`, email = `changed-${actorId}@example.invalid`;
  const token = { userId: actorId, metadata: { purpose: "profile-email", previousEmail, email, sessionId } };
  await assert.rejects(db.$transaction(async tx => { await verifyProfileEmailChange(tx, token); throw rollback; }), error => error === rollback);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: actorId } })).email, previousEmail);
  assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: sessionId } })).status, "ACTIVE");
  await db.$transaction(tx => verifyProfileEmailChange(tx, token));
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: actorId } })).email, email);
  await assert.rejects(profile.current(context), error => error.status === 401);
  console.log("PASS profile migration upgrade, self/tenant/role denial, CAS concurrency, atomic rollback, contact persistence/idempotency, verified email/session revocation");
} finally {
  await db.securityEvent.deleteMany({ where: { actorId } });
  await db.auditLog.deleteMany({ where: { actorId } });
  await db.outboxEvent.deleteMany({ where: { aggregateId: organizationId } });
  await db.idempotencyRecord.deleteMany({ where: { scope: `organization-profile:${organizationId}` } });
  await db.organizationProfile.deleteMany({ where: { organizationId } });
  await db.address.deleteMany({ where: { organizationId } });
  await db.user.deleteMany({ where: { id: actorId } });
  await db.organization.deleteMany({ where: { id: organizationId } });
  await db.$disconnect();
}
