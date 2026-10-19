import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";

const approved = testDatabaseUrl({ ...process.env, DATABASE_URL: undefined });
assert.equal(process.env.DATABASE_URL, approved);
Object.assign(process.env, { NODE_ENV: "test", AUTH_MODE: "jwt", JWT_SECRET: randomUUID() + randomUUID(), JWT_REQUIRE_MFA: "false" });
const { IdentitySigningStore, identityHash } = await import("../apps/api/src/modules/identity-signing/identity-signing.store.ts");
const { IdentitySigningService } = await import("../apps/api/src/modules/identity-signing/identity-signing.service.ts");
const { IdentitySigningProcessor } = await import("../apps/api/src/modules/identity-signing/identity-signing.processor.ts");
const { SecurityCryptoService } = await import("../apps/api/src/platform/security/security-crypto.service.ts");
const db = new PrismaClient(), store = new IdentitySigningStore(db), crypto = new SecurityCryptoService();
const service = new IdentitySigningService(store, crypto, { configured: () => true });
const organizationId = randomUUID(), actors = [];
async function prepare() {
  const actor = { actorId: randomUUID(), organizationId, sessionId: randomUUID() }; actors.push(actor);
  await db.user.create({ data: { id: actor.actorId, displayName: "Synthetic worker user", email: `${actor.actorId}@example.invalid`, memberships: { create: { organizationId, status: "ACTIVE" } } } });
  await db.authSession.create({ data: { id: actor.sessionId, userId: actor.actorId, familyId: randomUUID(), refreshTokenHash: randomUUID(), organizationIds: [organizationId], expiresAt: new Date(Date.now() + 3600000) } });
  const session = await service.create(actor, { idempotencyKey: randomUUID() });
  await service.submit(actor, session.id, { sessionId: session.id, expectedSessionVersion: 1, cmsBase64: "AQID", idempotencyKey: randomUUID() });
  const claim = await db.identitySigningSession.update({ where: { id: session.id }, data: { leaseId: randomUUID(), leaseUntil: new Date(Date.now() + 90000), attempts: 1 } });
  return { actor, claim };
}
// These synthetic receipts test transaction state only. Cryptography is verified
// separately by verify-nca-identity using actual public SDK certificates and CMS.
function receipt(claim, iin) {
  const now = new Date().toISOString();
  return { protocol: 1, status: "VERIFIED", trustProfile: "TEST", policySha256: "a".repeat(64), iin,
    originalSha256: claim.originalSha256, cmsSha256: claim.cmsSha256, certificateSha256: "b".repeat(64),
    verifiedAt: now, timestampAt: now, validFrom: now, validUntil: new Date(Date.now() + 3600000).toISOString(), certificatesBase64: [], revocations: [] };
}
const processor = new IdentitySigningProcessor(store, crypto, {});
try {
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, new URL(approved).pathname.slice(1));
  assert.equal(await db.identitySigningSession.count({ where: { status: { in: ["VERIFYING", "UNKNOWN"] }, nextAttemptAt: { not: null } } }), 0, "No unrelated pending verification jobs may be present");
  await db.organization.create({ data: { id: organizationId, legalName: "Synthetic worker verification", displayName: "Synthetic worker verification", bin: String(Date.now()).slice(-12) } });
  const good = await prepare(), proof = receipt(good.claim, "000000000001");
  await processor.finalize(good.claim, proof);
  const view = await service.current(good.actor); assert.equal(view.status, "VERIFIED"); assert.equal(view.maskedIin, "********0001");
  assert.equal((await service.get(good.actor, good.claim.id)).status, "COMMITTED");
  const binding = await db.signingIdentityBinding.findFirstOrThrow({ where: { userId: good.actor.actorId } });
  assert.equal(crypto.decrypt(binding.iinEncrypted), proof.iin); assert.equal(binding.iinFingerprint, crypto.fingerprint(proof.iin, "signing-identity-iin"));
  const evidence = await db.identitySigningEvidence.findUniqueOrThrow({ where: { id: binding.evidenceId } });
  assert.equal(evidence.payloadSha256, identityHash(crypto.decrypt(evidence.encryptedPayload)));
  await processor.finalize(good.claim, proof);
  assert.equal(await db.signingIdentityBinding.count({ where: { userId: good.actor.actorId } }), 1);
  const cancelled = await prepare();
  await service.transition(cancelled.actor, cancelled.claim.id, { expectedSessionVersion: 2, idempotencyKey: randomUUID() }, "cancel");
  await processor.finalize(cancelled.claim, receipt(cancelled.claim, "000000000002"));
  assert.equal((await service.get(cancelled.actor, cancelled.claim.id)).status, "CANCELLED");
  assert.equal((await db.identitySigningEvidence.findUniqueOrThrow({ where: { sessionId: cancelled.claim.id } })).accepted, false);
  assert.equal(await db.signingIdentityBinding.count({ where: { userId: cancelled.actor.actorId } }), 0);
  for (const revoke of ["session", "membership"]) {
    const f = await prepare();
    if (revoke === "session") await db.authSession.update({ where: { id: f.actor.sessionId }, data: { status: "REVOKED", revokedAt: new Date() } });
    else await db.organizationMembership.updateMany({ where: { userId: f.actor.actorId }, data: { status: "BLOCKED" } });
    await processor.finalize(f.claim, receipt(f.claim, "000000000003"));
    assert.equal((await db.identitySigningSession.findUniqueOrThrow({ where: { id: f.claim.id } })).status, "EVIDENCE_ONLY");
    assert.equal(await db.signingIdentityBinding.count({ where: { userId: f.actor.actorId } }), 0);
  }
  const left = await prepare(), right = await prepare();
  await Promise.all([processor.finalize(left.claim, receipt(left.claim, "000000000004")), processor.finalize(right.claim, receipt(right.claim, "000000000004"))]);
  assert.equal(await db.signingIdentityBinding.count({ where: { userId: { in: [left.actor.actorId, right.actor.actorId] } } }), 1);
  const race = await db.identitySigningSession.findMany({ where: { id: { in: [left.claim.id, right.claim.id] } }, select: { status: true } });
  assert.deepEqual(race.map(item => item.status).sort(), ["COMMITTED", "EVIDENCE_ONLY"]);
  const rollback = await prepare(), originalAudit = store.audit;
  store.audit = async () => { throw new Error("Synthetic finalization audit failure"); };
  await assert.rejects(processor.finalize(rollback.claim, receipt(rollback.claim, "000000000005")), /Synthetic finalization audit failure/);
  store.audit = originalAudit;
  assert.equal(await db.signingIdentityBinding.count({ where: { userId: rollback.actor.actorId } }), 0);
  assert.equal(await db.identitySigningEvidence.count({ where: { sessionId: rollback.claim.id } }), 0);
  await processor.finalize(rollback.claim, receipt(rollback.claim, "000000000005"));
  const retry = await prepare();
  await processor.finalize(retry.claim, { protocol: 1, status: "REJECTED", code: "VERIFIER_UNAVAILABLE" });
  assert.equal((await service.get(retry.actor, retry.claim.id)).status, "UNKNOWN");
  await service.transition(retry.actor, retry.claim.id, { expectedSessionVersion: 3, idempotencyKey: randomUUID() }, "retry");
  const retried = await db.identitySigningSession.findUniqueOrThrow({ where: { id: retry.claim.id } });
  assert.equal(retried.cmsEncrypted, retry.claim.cmsEncrypted); assert.equal(retried.attempts, 0);
  await processor.finalize(retry.claim, receipt(retry.claim, "000000000006"));
  assert.equal(await db.signingIdentityBinding.count({ where: { userId: retry.actor.actorId } }), 0, "Stale lease cannot commit after retry");
  const worker = new IdentitySigningProcessor(store, crypto, { verify: async input => ({ ...receipt(retried, "000000000006"), originalSha256: identityHash(input.original), cmsSha256: identityHash(input.cms) }) });
  assert.equal(await worker.processOne(), true);
  assert.equal((await service.current(retry.actor)).status, "VERIFIED");
  const invalid = await prepare();
  await processor.finalize(invalid.claim, { protocol: 1, status: "REJECTED", code: "INVALID_SIGNATURE" });
  assert.equal((await service.get(invalid.actor, invalid.claim.id)).status, "REJECTED");
  assert.equal(await db.signingIdentityBinding.count({ where: { userId: invalid.actor.actorId } }), 0);
  const crashed = await prepare();
  await db.identitySigningSession.update({ where: { id: crashed.claim.id }, data: { attempts: 8, leaseUntil: new Date(0) } });
  assert.equal(await worker.processOne(), true);
  const recovered = await db.identitySigningSession.findUniqueOrThrow({ where: { id: crashed.claim.id } });
  assert.equal(recovered.status, "UNKNOWN"); assert.equal(recovered.nextAttemptAt, null);
  console.log("PASS identity worker transactions: atomic binding/evidence/audit, cancellation, logout, membership revocation, concurrent same-IIN exclusion, rollback, retained CMS retry, stale lease denial, invalid signature, exhausted crash recovery");
} finally {
  const users = actors.map(actor => actor.actorId);
  await db.signingIdentityBinding.deleteMany({ where: { userId: { in: users } } });
  await db.identitySigningEvidence.deleteMany({ where: { session: { userId: { in: users } } } });
  await db.identitySigningCommand.deleteMany({ where: { userId: { in: users } } });
  await db.identitySigningSession.deleteMany({ where: { userId: { in: users } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.organization.deleteMany({ where: { id: organizationId } });
  await db.$disconnect();
}
