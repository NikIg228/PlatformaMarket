import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";

const approved = testDatabaseUrl({ ...process.env, DATABASE_URL: undefined });
assert.equal(process.env.DATABASE_URL, approved, "Use db:test with the approved disposable database");
Object.assign(process.env, { NODE_ENV: "test", AUTH_MODE: "jwt", ACCESS_CONTROL_MODE: "ROLE_BASED",
  JWT_SECRET: randomUUID() + randomUUID(), JWT_REQUIRE_MFA: "false" });
const { IdentitySigningStore, identityHash } = await import("../apps/api/src/modules/identity-signing/identity-signing.store.ts");
const { IdentitySigningService } = await import("../apps/api/src/modules/identity-signing/identity-signing.service.ts");
const { IdentitySigningProcessor } = await import("../apps/api/src/modules/identity-signing/identity-signing.processor.ts");
const { SecurityCryptoService } = await import("../apps/api/src/platform/security/security-crypto.service.ts");
const { organizationRequisitesSource } = await import("../apps/api/src/modules/organizations/organization-requisites.service.ts");
const { SigningAdmissionRules } = await import("../apps/api/src/modules/signing-admission/signing-admission.rules.ts");
const { SigningAdmissionStore } = await import("../apps/api/src/modules/signing-admission/signing-admission.store.ts");
const { SigningAdmissionService } = await import("../apps/api/src/modules/signing-admission/signing-admission.service.ts");
const db = new PrismaClient(), transactions = new IdentitySigningStore(db), crypto = new SecurityCryptoService();
const blobs = new Map(), storage = { get: async key => { assert.ok(blobs.has(key)); return blobs.get(key); } };
const rules = new SigningAdmissionRules(storage, crypto), commands = new SigningAdmissionStore();
const service = new SigningAdmissionService(transactions, commands, rules);
const identity = new IdentitySigningService(transactions, crypto, { configured: () => true });
const processor = new IdentitySigningProcessor(transactions, crypto, {});
const organizations = [], users = [], ownedPermissions = [], checks = [];
let counter = 0;
const denied = (promise, code) => assert.rejects(promise, error => error.getResponse?.().code === code);

async function organization(capability = "BUYER", form = "LEGAL_ENTITY") {
  const id = randomUUID(); organizations.push(id);
  const result = await db.organization.create({ data: { id, legalName: "Synthetic admission", displayName: "Synthetic admission",
    bin: String(Date.now() + counter++).slice(-12), capabilities: { create: { capability } } }, include: { capabilities: true } });
  await db.organizationRequisites.create({ data: { organizationId: id, version: 1 } });
  return { ...result, form };
}
async function actor(org, permission = false) {
  const value = { actorId: randomUUID(), organizationId: org.id, sessionId: randomUUID() }; users.push(value.actorId);
  await db.user.create({ data: { id: value.actorId, displayName: "Synthetic admission user", email: `${value.actorId}@example.invalid`,
    memberships: { create: { organizationId: org.id, status: "ACTIVE" } } } });
  await db.authSession.create({ data: { id: value.sessionId, userId: value.actorId, familyId: randomUUID(), refreshTokenHash: randomUUID(),
    organizationIds: [org.id], expiresAt: new Date(Date.now() + 3600000) } });
  if (permission) {
    let p = await db.permission.findUnique({ where: { code: "compliance.review" } });
    if (!p) { p = await db.permission.create({ data: { code: "compliance.review", description: "Synthetic admission test" } }); ownedPermissions.push(p.id); }
    const role = await db.role.create({ data: { organizationId: org.id, code: randomUUID(), name: "Synthetic reviewer",
      permissions: { create: { permissionId: p.id } } } });
    const membership = await db.organizationMembership.findUniqueOrThrow({ where: { userId_organizationId: { userId: value.actorId, organizationId: org.id } } });
    await db.membershipRole.create({ data: { membershipId: membership.id, roleId: role.id } });
  }
  return value;
}
async function requisites(org, user) {
  await db.organizationRequisitesRevision.create({ data: { organizationId: org.id, version: 1,
    fields: { legalForm: org.form, bankAccounts: [], defaultBankAccountId: null, taxPeriods: [] },
    source: await organizationRequisitesSource(db, org), createdById: user.actorId, createdByName: "Synthetic",
    confirmedById: user.actorId, confirmedByName: "Synthetic", confirmedAt: new Date() } });
}
async function verified(user, iin = String(Date.now() + counter++).slice(-12)) {
  // Synthetic verified receipts isolate admission state transitions. Actual NCA
  // cryptography has a separate SDK/HTTP gate; this script does not certify it.
  const session = await identity.create(user, { idempotencyKey: randomUUID() });
  await identity.submit(user, session.id, { sessionId: session.id, expectedSessionVersion: 1, cmsBase64: "AQID", idempotencyKey: randomUUID() });
  const claim = await db.identitySigningSession.update({ where: { id: session.id }, data: { leaseId: randomUUID(), leaseUntil: new Date(Date.now() + 90000) } });
  const now = new Date().toISOString();
  await processor.finalize(claim, { protocol: 1, status: "VERIFIED", trustProfile: "TEST", policySha256: "a".repeat(64), iin,
    originalSha256: claim.originalSha256, cmsSha256: claim.cmsSha256, certificateSha256: "b".repeat(64),
    verifiedAt: now, timestampAt: now, validFrom: now, validUntil: new Date(Date.now() + 3600000).toISOString(), certificatesBase64: [], revocations: [] });
  return db.signingIdentityBinding.findFirstOrThrow({ where: { userId: user.actorId, status: "ACTIVE" } });
}
async function document(org, previous = null) {
  const id = randomUUID(), bytes = Buffer.from(`Synthetic admission evidence ${id}`), storageKey = `admission-test/${id}`;
  blobs.set(storageKey, bytes);
  return db.document.create({ data: { id, ownerOrganizationId: org.id, kind: "OTHER", category: "OTHER", format: "PDF", source: "UPLOADED",
    status: "GENERATED", title: "Synthetic basis", documentNumber: previous?.documentNumber ?? id,
    version: previous ? previous.version + 1 : 1, previousVersionId: previous?.id, storageKey, fileName: "basis.pdf", contentType: "application/pdf",
    byteSize: bytes.length, checksumSha256: identityHash(bytes), immutableAt: new Date() } });
}
async function candidate(form = "LEGAL_ENTITY") {
  const org = await organization("BUYER", form), user = await actor(org);
  await requisites(org, user);
  const binding = await verified(user, form === "INDIVIDUAL_ENTREPRENEUR" ? org.bin : undefined), basis = await document(org);
  const input = { expectedOrganizationVersion: org.version, identityBinding: { id: binding.id, version: binding.version },
    basis: form === "LEGAL_ENTITY" ? { kind: "LEGAL_ENTITY_HEAD", appointment: { description: "Appointment", document: { id: basis.id, version: 1 } } }
      : { kind: "INDIVIDUAL_ENTREPRENEUR", registrationNotice: { description: "Accepted registration notice", document: { id: basis.id, version: 1 } } },
    idempotencyKey: randomUUID() };
  return { org, user, binding, basis, input };
}
try {
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, new URL(approved).pathname.slice(1));
  const operatorOrg = await organization("MARKETPLACE_OPERATOR"), operator = await actor(operatorOrg, true);
  const evidence = await document(operatorOrg);
  const approve = input => ({ decision: "APPROVE", expectedVersion: 1, checkedBasis: input.basis,
    verification: { source: "OFFICIAL_EXTRACT", evidenceDocument: { id: evidence.id, version: 1 }, checkedAt: new Date().toISOString() },
    reviewNote: "Verified official source", idempotencyKey: randomUUID() });
  const good = await candidate();
  await denied(service.submit(good.user, good.org.id, { ...good.input, actorId: operator.actorId }), "BAD_REQUEST");
  await denied(service.submit(good.user, operatorOrg.id, good.input), "NOT_FOUND");
  await denied(service.submit(good.user, good.org.id, { ...good.input, identityBinding: { id: randomUUID(), version: 1 } }), "IDENTITY_NOT_VERIFIED");
  const [first, replay] = await Promise.all([service.submit(good.user, good.org.id, good.input), service.submit(good.user, good.org.id, good.input)]);
  assert.deepEqual(first, replay); assert.equal(first.status, "PENDING_REVIEW");
  assert.equal(await db.signingPrincipalAuthority.count({ where: { organizationId: good.org.id } }), 0);
  await denied(service.submit(good.user, good.org.id, { ...good.input, expectedOrganizationVersion: 999 }), "IDEMPOTENCY_CONFLICT");
  await denied(service.submit(good.user, good.org.id, { ...good.input, idempotencyKey: randomUUID() }), "VERSION_CONFLICT");
  const peer = await actor(good.org);
  assert.equal((await service.current(peer, good.org.id)).admission, null);
  await denied(service.detail(peer, first.id), "FORBIDDEN");
  const restrictedOperator = await actor(operatorOrg);
  await denied(service.queue(restrictedOperator, { offset: 0, limit: 10 }), "FORBIDDEN");
  await denied(service.queue(good.user, { offset: 0, limit: 10 }), "FORBIDDEN");
  const queue = await service.queue(operator, { offset: 0, limit: 50 }); assert.ok(queue.items.some(row => row.id === first.id));
  const decision = approve(good.input);
  await denied(service.review(operator, first.id, { ...decision, verification: { ...decision.verification, checkedAt: new Date(Date.now() + 86400000).toISOString() } }), "BAD_REQUEST");
  await denied(service.review(operator, first.id, { ...decision, verification: { ...decision.verification, evidenceDocument: { id: good.basis.id, version: 1 } } }), "NOT_FOUND");
  const approvedView = await service.review(operator, first.id, decision);
  assert.equal(approvedView.status, "APPROVED"); assert.deepEqual(await service.review(operator, first.id, decision), approvedView);
  assert.equal(await db.signingPrincipalAuthority.count({ where: { organizationId: good.org.id, status: "ACTIVE" } }), 1);
  assert.equal(await db.auditLog.count({ where: { entityId: first.id, action: "signing.admission.approved" } }), 1);
  assert.deepEqual(await service.submit(good.user, good.org.id, good.input), first, "Replay returns original creation response");
  assert.equal((await service.current(good.user, good.org.id)).admission.status, "APPROVED");
  await denied(service.submit(peer, good.org.id, { ...good.input, idempotencyKey: randomUUID() }), "SUPPORT_REQUIRED");
  checks.push("JWT/member/operator isolation, strict input, concurrent creation replay, original response replay, atomic approval and audit");

  const rejected = await candidate(), pending = await service.submit(rejected.user, rejected.org.id, rejected.input);
  await service.review(operator, pending.id, { decision: "REJECT", expectedVersion: 1, reason: "Need complete appointment document", idempotencyKey: randomUUID() });
  const corrected = await service.submit(rejected.user, rejected.org.id, { ...rejected.input, idempotencyKey: randomUUID() });
  assert.notEqual(corrected.id, pending.id);
  const originalSave = commands.save.bind(commands);
  commands.save = async (...args) => { await originalSave(...args); throw new Error("injected audit rollback"); };
  await assert.rejects(service.review(operator, corrected.id, approve(rejected.input)), /injected audit rollback/);
  commands.save = originalSave;
  assert.equal((await service.detail(operator, corrected.id)).status, "PENDING_REVIEW");
  assert.equal(await db.signingPrincipalReview.count({ where: { admissionId: corrected.id } }), 0);
  assert.equal(await db.signingPrincipalAuthority.count({ where: { organizationId: rejected.org.id } }), 0);
  checks.push("rejection, corrected application, transaction rollback of decision/authority/audit/replay");

  for (const mutation of ["binding", "membership", "requisites", "bytes", "document-version"]) {
    const item = await candidate(), application = await service.submit(item.user, item.org.id, item.input);
    if (mutation === "binding") await db.signingIdentityBinding.update({ where: { id: item.binding.id }, data: { status: "REVOKED" } });
    if (mutation === "membership") await db.organizationMembership.update({ where: { userId_organizationId: { userId: item.user.actorId, organizationId: item.org.id } }, data: { status: "BLOCKED" } });
    if (mutation === "requisites") await db.organization.update({ where: { id: item.org.id }, data: { version: { increment: 1 } } });
    if (mutation === "bytes") blobs.set(item.basis.storageKey, Buffer.from("tampered"));
    if (mutation === "document-version") await document(item.org, item.basis);
    await denied(service.review(operator, application.id, approve(item.input)), { binding: "IDENTITY_NOT_VERIFIED", membership: "FORBIDDEN", requisites: "VERSION_CONFLICT", bytes: "CONTENT_MISMATCH", "document-version": "VERSION_CONFLICT" }[mutation]);
    assert.equal(await db.signingPrincipalAuthority.count({ where: { organizationId: item.org.id } }), 0);
  }
  checks.push("approval revalidates identity/membership/requisites/document version and stored bytes");

  const ip = await candidate("INDIVIDUAL_ENTREPRENEUR"), ipApplication = await service.submit(ip.user, ip.org.id, ip.input);
  assert.equal((await service.review(operator, ipApplication.id, approve(ip.input))).status, "APPROVED");
  const mismatch = await candidate("INDIVIDUAL_ENTREPRENEUR");
  await db.signingIdentityBinding.update({ where: { id: mismatch.binding.id }, data: { iinFingerprint: crypto.fingerprint(randomUUID(), "signing-identity-iin") } });
  await denied(service.submit(mismatch.user, mismatch.org.id, mismatch.input), "SUPPORT_REQUIRED");
  const wrongKind = await candidate();
  await denied(service.submit(wrongKind.user, wrongKind.org.id, { ...wrongKind.input, basis: ip.input.basis }), "UNSUPPORTED_SUBJECT");
  checks.push("IP admission matches verified IIN without corporate BIN; mismatched owner and legal form denied");

  const race = await candidate(), second = await actor(race.org), secondBinding = await verified(second);
  const secondInput = { ...race.input, identityBinding: { id: secondBinding.id, version: 1 }, idempotencyKey: randomUUID() };
  const a = await service.submit(race.user, race.org.id, race.input), b = await service.submit(second, race.org.id, secondInput);
  const otherOperator = await actor(operatorOrg, true);
  const outcomes = await Promise.allSettled([service.review(operator, a.id, approve(race.input)), service.review(otherOperator, b.id, approve(secondInput))]);
  assert.equal(outcomes.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(outcomes.find(x => x.status === "rejected").reason.getResponse().code, "SUPPORT_REQUIRED");
  assert.equal(await db.signingPrincipalAuthority.count({ where: { organizationId: race.org.id, status: "ACTIVE" } }), 1);
  await db.authSession.update({ where: { id: operator.sessionId }, data: { status: "REVOKED", revokedAt: new Date() } });
  await denied(service.detail(operator, first.id), "UNAUTHORIZED");
  checks.push("two applicant/two operator approval race yields one authority; revoked JWT session denied");
  console.log(JSON.stringify({ status: "PASS", checks }, null, 2));
} finally {
  await db.signingAdmissionCommand.deleteMany({ where: { actorId: { in: users } } });
  await db.signingPrincipalAuthority.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.signingPrincipalReview.deleteMany({ where: { admission: { organizationId: { in: organizations } } } });
  await db.signingPrincipalAdmission.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.document.deleteMany({ where: { ownerOrganizationId: { in: organizations } } });
  await db.signingIdentityBinding.deleteMany({ where: { userId: { in: users } } });
  await db.identitySigningEvidence.deleteMany({ where: { session: { userId: { in: users } } } });
  await db.identitySigningCommand.deleteMany({ where: { userId: { in: users } } });
  await db.identitySigningSession.deleteMany({ where: { userId: { in: users } } });
  await db.organizationRequisitesRevision.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.organizationRequisites.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.organization.deleteMany({ where: { id: { in: organizations } } });
  await db.permission.deleteMany({ where: { id: { in: ownedPermissions } } });
  await db.$disconnect();
}
