import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";

const approved = testDatabaseUrl({ ...process.env, DATABASE_URL: undefined });
assert.equal(process.env.DATABASE_URL, approved);
const fixtureRoot = path.resolve(".tmp", `admission-http-${randomUUID()}`);
await mkdir(fixtureRoot, { recursive: true });
const secret = randomUUID() + randomUUID();
Object.assign(process.env, { NODE_ENV: "test", PROCESS_ROLE: "api", DEPLOYMENT_PROFILE: "go_live", AUTH_MODE: "jwt",
  JWT_SECRET: secret, JWT_REQUIRE_MFA: "false", JWT_ISSUER: "admission-http", JWT_AUDIENCE: "admission-http", ACCESS_CONTROL_MODE: "ROLE_BASED",
  BACKGROUND_QUEUE_ENABLED: "false", OBJECT_STORAGE_DRIVER: "local", LOCAL_STORAGE_PATH: path.join(fixtureRoot, "storage"),
  LOG_LEVEL: "fatal", SENTRY_DSN: "", OTEL_EXPORTER_OTLP_ENDPOINT: "" });
const db = new PrismaClient(), organizations = [], users = [], ownedPermissions = [];
const hash = value => createHash("sha256").update(value).digest("hex");
let app;
try {
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, new URL(approved).pathname.slice(1));
  const { createMarketplaceApp } = await import("../apps/api/dist/src/bootstrap.js");
  const { SecurityCryptoService } = await import("../apps/api/dist/src/platform/security/security-crypto.service.js");
  const { ObjectStorageService } = await import("../apps/api/dist/src/platform/storage/object-storage.service.js");
  const { organizationRequisitesSource } = await import("../apps/api/dist/src/modules/organizations/organization-requisites.service.js");
  app = await createMarketplaceApp({ serverless: true }); await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api`, crypto = app.get(SecurityCryptoService), storage = app.get(ObjectStorageService);
  async function fixture(operator) {
    const organizationId = randomUUID(), actorId = randomUUID(), sessionId = randomUUID(); organizations.push(organizationId); users.push(actorId);
    const org = await db.organization.create({ data: { id: organizationId, legalName: "Synthetic HTTP admission", displayName: "Synthetic HTTP admission", bin: String(Date.now()).slice(-12),
      capabilities: { create: { capability: operator ? "MARKETPLACE_OPERATOR" : "BUYER" } } }, include: { capabilities: true } });
    await db.user.create({ data: { id: actorId, displayName: "Synthetic HTTP applicant", email: `${actorId}@example.invalid`, memberships: { create: { organizationId, status: "ACTIVE" } } } });
    await db.authSession.create({ data: { id: sessionId, userId: actorId, familyId: randomUUID(), refreshTokenHash: randomUUID(), organizationIds: [organizationId], expiresAt: new Date(Date.now() + 3600000) } });
    const membership = await db.organizationMembership.findUniqueOrThrow({ where: { userId_organizationId: { userId: actorId, organizationId } } });
    const permissions = [];
    for (const code of ["document.view", "document.upload", "organization.view", ...(operator ? ["compliance.review"] : [])]) {
      let p = await db.permission.findUnique({ where: { code } });
      if (!p) { p = await db.permission.create({ data: { code, description: "Synthetic HTTP permission" } }); ownedPermissions.push(p.id); }
      permissions.push(p);
    }
    const role = await db.role.create({ data: { organizationId, code: "admission-http", name: "Synthetic HTTP role", permissions: { create: permissions.map(p => ({ permissionId: p.id })) } } });
    await db.membershipRole.create({ data: { roleId: role.id, membershipId: membership.id } });
    const documentId = randomUUID(), bytes = Buffer.from("Synthetic immutable admission evidence"), key = `admission/${documentId}.pdf`;
    await storage.put(key, bytes, "application/pdf");
    await db.document.create({ data: { id: documentId, ownerOrganizationId: organizationId, kind: "OTHER", category: "OTHER", format: "PDF", source: "UPLOADED",
      status: "GENERATED", title: "Synthetic HTTP document", documentNumber: documentId, storageKey: key, fileName: "evidence.pdf", contentType: "application/pdf", byteSize: bytes.length,
      checksumSha256: hash(bytes), immutableAt: new Date() } });
    await db.organizationRequisites.create({ data: { organizationId, version: 1 } });
    await db.organizationRequisitesRevision.create({ data: { organizationId, version: 1, fields: { legalForm: "LEGAL_ENTITY", bankAccounts: [], defaultBankAccountId: null, taxPeriods: [] },
      source: await organizationRequisitesSource(db, org), createdById: actorId, createdByName: "Synthetic", confirmedById: actorId, confirmedByName: "Synthetic", confirmedAt: new Date() } });
    const identitySession = await db.identitySigningSession.create({ data: { userId: actorId, organizationId, authSessionId: sessionId, original: bytes.toString("utf8"),
      originalSha256: hash(bytes), expiresAt: new Date(Date.now() + 600000) } });
    const proof = await db.identitySigningEvidence.create({ data: { sessionId: identitySession.id, encryptedPayload: crypto.encrypt("Synthetic identity fixture"), payloadSha256: hash("Synthetic identity fixture"), policySha256: "a".repeat(64), accepted: true } });
    const iin = String(Date.now()).slice(-12);
    const binding = await db.signingIdentityBinding.create({ data: { userId: actorId, iinEncrypted: crypto.encrypt(iin), iinFingerprint: crypto.fingerprint(iin, "signing-identity-iin"),
      maskedIin: `********${iin.slice(-4)}`, evidenceId: proof.id, verifiedAt: new Date() } });
    const token = jwt.sign({ organization_ids: [organizationId], organization_id: organizationId, amr: ["password"] }, secret,
      { subject: actorId, jwtid: sessionId, issuer: "admission-http", audience: "admission-http", expiresIn: 600 });
    return { organizationId, actorId, sessionId, documentId, binding, token, org };
  }
  const applicant = await fixture(false), operator = await fixture(true);
  async function call(actor, route, body, headersOnly = false) {
    const response = await fetch(base + route, { method: body ? "POST" : "GET", headers: { "content-type": "application/json",
      ...(headersOnly ? { "x-user-id": actor.actorId, "x-organization-id": actor.organizationId, "x-session-id": actor.sessionId } : { authorization: `Bearer ${actor.token}` }) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  const route = `/organizations/${applicant.organizationId}/signing/admission`;
  assert.equal((await call(applicant, route, undefined, true)).status, 401);
  const initial = await call(applicant, route); assert.equal(initial.status, 200); assert.equal(initial.body.admission, null); assert.equal(initial.headers.get("cache-control"), "no-store");
  const input = { expectedOrganizationVersion: applicant.org.version, identityBinding: { id: applicant.binding.id, version: 1 }, basis: { kind: "LEGAL_ENTITY_HEAD",
    appointment: { description: "Appointment document", document: { id: applicant.documentId, version: 1 } } }, idempotencyKey: randomUUID() };
  const invalid = await call(applicant, route, { ...input, actorId: operator.actorId }); assert.equal(invalid.status, 400); assert.equal(invalid.body.code, "BAD_REQUEST"); assert(invalid.body.requestId);
  const created = await call(applicant, route, input); assert.equal(created.status, 201); assert.equal(created.body.status, "PENDING_REVIEW");
  const id = created.body.id;
  assert.equal((await call(applicant, "/operations/signing/admissions?offset=0&limit=10")).status, 403);
  assert.equal((await call(operator, "/operations/signing/admissions?offset=1x&limit=10")).status, 400);
  assert.equal((await call(operator, "/operations/signing/admissions?offset=0&limit=10&extra=1")).status, 400);
  assert.equal((await call(operator, "/operations/signing/admissions?offset=0&limit=10")).status, 200);
  assert.equal((await call(operator, `/operations/signing/admissions/${id}`)).body.id, id);
  const review = { decision: "APPROVE", expectedVersion: 1, checkedBasis: input.basis,
    verification: { source: "OFFICIAL_EXTRACT", evidenceDocument: { id: operator.documentId, version: 1 }, checkedAt: new Date().toISOString() },
    reviewNote: "Official source checked", idempotencyKey: randomUUID() };
  const result = await call(operator, `/operations/signing/admissions/${id}/review`, review);
  assert.equal(result.status, 200); assert.equal(result.body.status, "APPROVED");
  assert.equal((await call(applicant, route)).body.admission.status, "APPROVED");
  assert.deepEqual((await call(operator, `/operations/signing/admissions/${id}/review`, review)).body, result.body);
  const swagger = await (await fetch(`${await app.getUrl()}/docs-json`)).json();
  assert(swagger.paths["/api/operations/signing/admissions/{id}/review"]);
  assert(swagger.components.schemas.SigningAdmissionReviewRequest);
  const checks = { status: "PASS", coverage: "JWT HTTP creation/read/queue/detail/review, exact query parser, no-store, envelope, Swagger, real storage checksum, durable approval and replay", artifact: fixtureRoot };
  await writeFile(path.join(fixtureRoot, "checks.json"), JSON.stringify(checks, null, 2)); console.log(JSON.stringify(checks));
} finally {
  if (app) await app.close();
  await db.signingAdmissionCommand.deleteMany({ where: { actorId: { in: users } } });
  await db.signingPrincipalAuthority.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.signingPrincipalReview.deleteMany({ where: { admission: { organizationId: { in: organizations } } } });
  await db.signingPrincipalAdmission.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.document.deleteMany({ where: { ownerOrganizationId: { in: organizations } } });
  await db.signingIdentityBinding.deleteMany({ where: { userId: { in: users } } });
  await db.identitySigningEvidence.deleteMany({ where: { session: { userId: { in: users } } } });
  await db.identitySigningSession.deleteMany({ where: { userId: { in: users } } });
  await db.organizationRequisitesRevision.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.organizationRequisites.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.organization.deleteMany({ where: { id: { in: organizations } } });
  await db.permission.deleteMany({ where: { id: { in: ownedPermissions } } });
  await db.$disconnect();
}
