import assert from "node:assert/strict";
import { randomUUID, randomBytes, randomInt, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { startLocalAuthFixture } from "./lib/local-auth-fixture.mjs";
import { auditEnvironment } from "./lib/registration-resume-fixture.mjs";

// Service probes use the same isolated DB, with an in-memory mail adapter.
Object.assign(process.env, auditEnvironment(), { API_HOST: "127.0.0.1", AUTH_LOCAL_MAIL_ENABLED: "true", AUTH_EMAIL_BASE_URL: "http://127.0.0.1:3103" });
const require = createRequire(import.meta.url);
const { AuthSessionsService } = require("../apps/api/dist/src/modules/identity/auth-sessions.service.js");
const { OnboardingService } = require("../apps/api/dist/src/modules/onboarding/onboarding.service.js");
const fixture = await startLocalAuthFixture({ web: false, operator: false });
const { db, request, runId, mail } = fixture;
const peer = new PrismaClient({ datasourceUrl: process.env.POSTGRES_TEST_DATABASE_URL });
const mailModule = require("../apps/api/dist/src/modules/identity/auth-mail.delivery.js");
const originalDelivery = mailModule.deliverAuthMail;
const delivered = [];
mailModule.deliverAuthMail = async (_config, message) => { delivered.push(message); return "LOCAL_FILE"; };
const service = client => new AuthSessionsService(client, {}, new OnboardingService(client), {});
const sessions = service(db);
const digest = value => createHash("sha256").update(value).digest("hex");
const rejected = (operation, status) => assert.rejects(operation, error => error.getStatus?.() === status);
const newBin = () => `98${String(randomInt(0, 1e10)).padStart(10, "0")}`;
const linkToken = message => new URL(message.match(/http:\/\/127\.0\.0\.1:3103\/verify-email\?[^\s]+/)[0]).searchParams.get("token");

async function registration(index, http = false) {
  const email = `${runId}-old-${index}@example.invalid`, password = randomBytes(24).toString("base64url");
  const input = { email, ownerDisplayName: "Synthetic Owner", legalName: `Synthetic ${runId}`, organizationDisplayName: "Synthetic Clinic", bin: newBin(), capability: "BUYER", termsAccepted: true, privacyAccepted: true, marketingConsent: false, consentVersion: "2026-07-17", source: "session_recovery_test", idempotencyKey: `${runId}-${index}` };
  const intent = http ? await request("/onboarding/registrations", input) : await new OnboardingService(db).createIntent(input);
  const signUp = { email, displayName: input.ownerDisplayName, password, registrationToken: intent.registrationToken };
  if (http) await request("/auth/register", signUp); else await sessions.registerEmail(signUp, {});
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const row = await db.registrationIntent.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
  const oldToken = http ? new URL(await mail(email, "/verify-email")).searchParams.get("token") : linkToken(delivered.at(-1).text);
  return { user, row, input, password, oldToken, registrationToken: intent.registrationToken, email: `${runId}-new-${index}@example.invalid` };
}

async function unlinkFixture(index) {
  const user = await db.user.create({ data: { email: `${runId}-social-${index}@example.invalid`, displayName: "Synthetic social user" } });
  for (const provider of ["GOOGLE", "APPLE"]) {
    await db.externalIdentity.create({ data: { userId: user.id, provider, subject: randomUUID(), email: user.email, emailVerified: true } });
    await db.authSession.create({ data: { userId: user.id, familyId: randomUUID(), refreshTokenHash: digest(randomUUID()), authMethods: [provider.toLowerCase()], expiresAt: new Date(Date.now() + 60000) } });
  }
  return user;
}

function transactionProxy(client, decorate) {
  return new Proxy(client, { get(target, key) {
    if (key === "$transaction") return (callback, options) => target.$transaction(tx => callback(decorate(tx)), options);
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  } });
}

try {
  const social = await unlinkFixture(1);
  let locked, secondStarted, release;
  const firstLocked = new Promise(resolve => { locked = resolve; });
  const secondEntered = new Promise(resolve => { secondStarted = resolve; });
  const continueFirst = new Promise(resolve => { release = resolve; });
  const firstDb = transactionProxy(db, tx => new Proxy(tx, { get(target, key) {
    if (key === "$queryRaw") return async query => { const value = await target.$queryRaw(query); locked(); await continueFirst; return value; };
    return Reflect.get(target, key);
  } }));
  const secondDb = transactionProxy(peer, tx => new Proxy(tx, { get(target, key) {
    if (key === "$queryRaw") return query => { secondStarted(); return target.$queryRaw(query); };
    return Reflect.get(target, key);
  } }));
  const first = service(firstDb).unlink(social.id, "GOOGLE");
  await firstLocked;
  const second = service(secondDb).unlink(social.id, "APPLE");
  const outcomesPromise = Promise.allSettled([first, second]);
  await secondEntered; release();
  const outcomes = await outcomesPromise;
  assert.equal(outcomes.filter(item => item.status === "fulfilled").length, 1);
  assert.equal(outcomes.find(item => item.status === "rejected")?.reason.getStatus(), 409);
  assert.equal(await db.externalIdentity.count({ where: { userId: social.id } }), 1);
  assert.equal(await db.authSession.count({ where: { userId: social.id, status: "ACTIVE" } }), 1);
  assert.equal(await db.auditLog.count({ where: { actorId: social.id, action: "identity.social.unlinked" } }), 1);

  const rollbackUser = await unlinkFixture(2);
  const brokenAudit = transactionProxy(db, tx => new Proxy(tx, { get(target, key) {
    if (key === "auditLog") return { create: async () => { throw new Error("SESSION_TEST_AUDIT_FAILURE"); } };
    return Reflect.get(target, key);
  } }));
  await assert.rejects(() => service(brokenAudit).unlink(rollbackUser.id, "GOOGLE"), /SESSION_TEST_AUDIT_FAILURE/);
  assert.equal(await db.externalIdentity.count({ where: { userId: rollbackUser.id } }), 2);
  assert.equal(await db.authSession.count({ where: { userId: rollbackUser.id, status: "ACTIVE" } }), 2);
  await rejected(() => sessions.unlink(undefined, "GOOGLE"), 401);

  const firstRegistration = await registration(1, true);
  const correction = { registrationToken: firstRegistration.registrationToken, password: firstRegistration.password, email: firstRegistration.email, returnTo: "/catalog" };
  await request("/auth/registration/email", { ...correction, email: "invalid" }, 400);
  await request("/auth/registration/email", { ...correction, password: "wrong-password-value" }, 401);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: firstRegistration.user.id } })).failedLoginAttempts, 1);
  const accepted = await request("/auth/registration/email", correction);
  assert.equal(accepted.email, correction.email); assert.equal(accepted.delivery, "LOCAL_FILE");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: firstRegistration.user.id } })).email, firstRegistration.input.email);
  await request("/auth/email/verify", { token: firstRegistration.oldToken }, 401);
  const newToken = new URL(await mail(correction.email, "/verify-email")).searchParams.get("token");
  const verified = await request("/auth/email/verify", { token: newToken });
  assert.equal(verified.user.id, firstRegistration.user.id); assert.equal(verified.user.email, correction.email);
  const completed = await db.registrationIntent.findUniqueOrThrow({ where: { id: firstRegistration.row.id } });
  assert.equal(completed.status, "CLAIMED"); assert.equal(completed.email, correction.email);
  for (const key of ["bin", "capability", "legalName", "organizationDisplayName", "ownerDisplayName", "consentVersion", "marketingConsent", "offerDocumentHash"]) assert.deepEqual(completed[key], firstRegistration.row[key]);
  assert.equal(completed.termsAcceptedAt.getTime(), firstRegistration.row.termsAcceptedAt.getTime());
  assert.equal(await db.organization.count({ where: { bin: firstRegistration.row.bin } }), 1);
  await request("/auth/email/verify", { token: newToken }, 401);
  await request("/auth/login", { email: firstRegistration.input.email, password: firstRegistration.password }, 401);
  await request("/auth/login", { email: correction.email, password: firstRegistration.password });
  await request("/auth/registration/email", correction, 401);

  const pending = await registration(2);
  const input = { registrationToken: pending.registrationToken, password: pending.password, email: pending.email };
  await sessions.correctRegistrationEmail(input);
  const tokenA = linkToken(delivered.at(-1).text);
  await sessions.correctRegistrationEmail({ ...input, email: `${runId}-latest@example.invalid` });
  const tokenB = linkToken(delivered.at(-1).text);
  await rejected(() => sessions.verifyEmail(tokenA, {}), 401);
  // Failure after token consumption and address changes must roll back all of them.
  const failingOnboarding = { claim: async () => { throw new Error("SESSION_TEST_CLAIM_FAILURE"); } };
  await assert.rejects(() => new AuthSessionsService(db, {}, failingOnboarding, {}).verifyEmail(tokenB, {}), /SESSION_TEST_CLAIM_FAILURE/);
  assert.equal((await db.emailAuthToken.findUniqueOrThrow({ where: { tokenHash: digest(tokenB) } })).consumedAt, null);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: pending.user.id } })).email, pending.input.email);
  assert.equal((await db.registrationIntent.findUniqueOrThrow({ where: { id: pending.row.id } })).email, pending.input.email);
  const doubleVerify = await Promise.allSettled([sessions.verifyEmail(tokenB, {}), service(peer).verifyEmail(tokenB, {})]);
  assert.equal(doubleVerify.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(await db.organization.count({ where: { bin: pending.row.bin } }), 1);

  const deliveryFailure = await registration(3);
  const retryInput = { registrationToken: deliveryFailure.registrationToken, password: deliveryFailure.password, email: deliveryFailure.email };
  mailModule.deliverAuthMail = async () => { throw new Error("SESSION_TEST_DELIVERY_FAILURE"); };
  await assert.rejects(() => sessions.correctRegistrationEmail(retryInput), /SESSION_TEST_DELIVERY_FAILURE/);
  assert.equal(await db.emailAuthToken.count({ where: { userId: deliveryFailure.user.id, consumedAt: null } }), 0);
  mailModule.deliverAuthMail = async (_config, message) => { delivered.push(message); return "LOCAL_FILE"; };
  await sessions.correctRegistrationEmail(retryInput);
  const retryToken = linkToken(delivered.at(-1).text);
  await db.registrationIntent.update({ where: { id: deliveryFailure.row.id }, data: { expiresAt: new Date(0) } });
  await rejected(() => sessions.verifyEmail(retryToken, {}), 401);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: deliveryFailure.user.id } })).emailVerifiedAt, null);

  const foreign = await registration(4);
  await rejected(() => sessions.correctRegistrationEmail({ registrationToken: foreign.registrationToken, password: firstRegistration.password, email: foreign.email }), 401);
  await rejected(() => sessions.correctRegistrationEmail({ registrationToken: foreign.registrationToken, password: foreign.password, email: correction.email }), 409);
  assert.equal((await db.emailAuthToken.findUniqueOrThrow({ where: { tokenHash: digest(foreign.oldToken) } })).consumedAt, null);

  console.log("Session recovery PG/API PASS: concurrent social unlink leaves one method; scoped revocation/audit rollback; actual local-mail email correction; old/replayed/expired proofs denied; same account/BIN/consents; claim rollback and concurrent single completion; failed delivery retry; foreign password/address denial");
} finally {
  mailModule.deliverAuthMail = originalDelivery;
  const users = await db.user.findMany({ where: { email: { startsWith: runId, endsWith: "@example.invalid" } }, select: { id: true } });
  const userIds = users.map(row => row.id);
  const intents = await db.registrationIntent.findMany({ where: { idempotencyKey: { startsWith: runId } }, select: { id: true, organizationId: true } });
  const organizations = intents.map(row => row.organizationId).filter(Boolean);
  await db.authSession.deleteMany({ where: { userId: { in: userIds } } });
  await db.emailAuthToken.deleteMany({ where: { userId: { in: userIds } } });
  await db.externalIdentity.deleteMany({ where: { userId: { in: userIds } } });
  await db.securityEvent.deleteMany({ where: { actorId: { in: userIds } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await db.outboxEvent.deleteMany({ where: { aggregateId: { in: organizations } } });
  await db.platformOfferAcceptance.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.organizationSubscription.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.organizationMembership.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.role.deleteMany({ where: { organizationId: { in: organizations } } });
  await db.registrationIntent.deleteMany({ where: { id: { in: intents.map(row => row.id) } } });
  await db.organization.deleteMany({ where: { id: { in: organizations } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await peer.$disconnect();
  await fixture.stop();
}
