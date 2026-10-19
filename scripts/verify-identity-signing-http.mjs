import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";

const approved = testDatabaseUrl({ ...process.env, DATABASE_URL: undefined });
assert.equal(process.env.DATABASE_URL, approved);
const sdk = process.env.NCA_SDK_ROOT, jdk = process.env.NCA_JAVA_HOME, deps = process.env.NCA_DEPENDENCIES;
assert(sdk && jdk && deps, "Public SDK test fixtures and Java paths are required");
const root = path.resolve(import.meta.dirname, ".."), fixtureRoot = path.join(root, ".tmp", `identity-http-${randomUUID()}`);
await mkdir(fixtureRoot, { recursive: true });
const classes = path.join(fixtureRoot, "classes"); await mkdir(classes);
const cp = [classes, path.join(deps, "*")].join(path.delimiter);
const bin = name => path.join(jdk, "bin", name + (process.platform === "win32" ? ".exe" : ""));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
async function run(binary, args, env = process.env) {
  await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { env, windowsHide: true, stdio: "ignore" });
    const timer = setTimeout(() => { child.kill(); reject(new Error("Public SDK fixture process timeout")); }, 55000);
    child.on("error", () => { clearTimeout(timer); reject(new Error("Public SDK fixture process failed")); });
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Public SDK fixture process exit ${code}`)); });
  });
}
await run(bin("javac"), ["-encoding", "UTF-8", "-cp", path.join(deps, "*"), "-d", classes,
  path.join(root, "scripts/nca-verifier/NcaIdentityVerifier.java"), path.join(root, "scripts/nca-verifier/NcaIdentityFixtures.java")]);
await run(bin("java"), ["-cp", cp, "NcaIdentityFixtures", sdk, fixtureRoot, "policy"]);
const policyPath = path.join(fixtureRoot, "test-policy.properties");
const secret = randomUUID() + randomUUID();
Object.assign(process.env, { NODE_ENV: "test", PROCESS_ROLE: "api", DEPLOYMENT_PROFILE: "go_live", AUTH_MODE: "jwt", JWT_SECRET: secret,
  JWT_REQUIRE_MFA: "false", JWT_ISSUER: "identity-http", JWT_AUDIENCE: "identity-http", BACKGROUND_QUEUE_ENABLED: "false",
  OBJECT_STORAGE_DRIVER: "local", LOCAL_STORAGE_PATH: path.join(fixtureRoot, "storage"), LOG_LEVEL: "fatal", SENTRY_DSN: "", OTEL_EXPORTER_OTLP_ENDPOINT: "",
  NCA_IDENTITY_JAVA_PATH: bin("java"), NCA_IDENTITY_CLASSPATH: cp, NCA_IDENTITY_POLICY_PATH: policyPath,
  NCA_IDENTITY_POLICY_SHA256: hash(await readFile(policyPath)) });
const db = new PrismaClient(), actorId = randomUUID(), organizationId = randomUUID(), sessionId = randomUUID();
let app;
try {
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, new URL(approved).pathname.slice(1));
  assert.equal(await db.identitySigningSession.count({ where: { status: { in: ["VERIFYING", "UNKNOWN"] }, nextAttemptAt: { not: null } } }), 0, "No unrelated pending verification jobs may be present");
  await db.organization.create({ data: { id: organizationId, legalName: "Synthetic identity HTTP", displayName: "Synthetic identity HTTP", bin: String(Date.now()).slice(-12) } });
  await db.user.create({ data: { id: actorId, displayName: "Synthetic identity HTTP user", email: `${actorId}@example.invalid`, memberships: { create: { organizationId, status: "ACTIVE" } } } });
  await db.authSession.create({ data: { id: sessionId, userId: actorId, familyId: randomUUID(), refreshTokenHash: randomUUID(), organizationIds: [organizationId], expiresAt: new Date(Date.now() + 3600000) } });
  const { createMarketplaceApp } = await import("../apps/api/dist/src/bootstrap.js");
  const { IdentitySigningProcessor } = await import("../apps/api/dist/src/modules/identity-signing/identity-signing.processor.js");
  app = await createMarketplaceApp({ serverless: true }); await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api`;
  const token = jwt.sign({ organization_ids: [organizationId], organization_id: organizationId, amr: ["password"] }, secret,
    { subject: actorId, jwtid: sessionId, issuer: "identity-http", audience: "identity-http", expiresIn: 600 });
  async function call(route, body, authenticated = true) {
    const response = await fetch(base + route, { method: body ? "POST" : "GET", headers: { "content-type": "application/json",
      ...(authenticated ? { authorization: `Bearer ${token}` } : { "x-user-id": actorId, "x-organization-id": organizationId, "x-session-id": sessionId }) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  assert.equal((await call("/identity/signing-binding", undefined, false)).status, 401);
  const initial = await call("/identity/signing-binding"); assert.equal(initial.status, 200); assert.equal(initial.body.verificationAvailable, true);
  assert.equal(initial.headers.get("cache-control"), "no-store");
  const invalid = await call("/identity/signing-binding/challenges", { idempotencyKey: randomUUID(), userId: actorId });
  assert.equal(invalid.status, 400); assert.equal(invalid.body.code, "BAD_REQUEST"); assert(invalid.body.requestId);
  const created = await call("/identity/signing-binding/challenges", { idempotencyKey: randomUUID() }); assert.equal(created.status, 201);
  const originalPath = path.join(fixtureRoot, "challenge.bin"), cmsPath = path.join(fixtureRoot, "signed.cms");
  const original = Buffer.from(created.body.signingInput.contentBase64, "base64");
  assert.equal(hash(original), created.body.signingInput.checksumSha256); await writeFile(originalPath, original);
  const readme = await readFile(path.join(sdk, "Keys and Certs/Gost2015/README.txt"), "utf8");
  const password = /сертификатам:\s*(\S+)/.exec(readme)?.[1]; assert(password, "Public SDK fixture password is missing");
  await run(bin("java"), ["-cp", cp, "NcaIdentityFixtures", sdk, fixtureRoot, "sign", originalPath, cmsPath, "valid"], { ...process.env, NCA_TEST_KEY_PASSWORD: password });
  const submit = { sessionId: created.body.id, expectedSessionVersion: created.body.version, cmsBase64: (await readFile(cmsPath)).toString("base64"), idempotencyKey: randomUUID() };
  const accepted = await call("/signing/sessions/cms", submit); assert.equal(accepted.status, 202); assert.equal(accepted.body.status, "VERIFYING");
  assert.equal(await app.get(IdentitySigningProcessor).processOne(), true);
  const finished = await call(`/signing/sessions/${created.body.id}`);
  assert.equal(finished.body.status, "COMMITTED", `Actual verifier result: ${finished.body.status}/${finished.body.reasonCode}`);
  const identity = await call("/identity/signing-binding"); assert.equal(identity.body.status, "VERIFIED"); assert.match(identity.body.maskedIin, /^\*{8}\d{4}$/);
  assert.equal(identity.body.iin, undefined); assert.equal(identity.body.certificatesBase64, undefined);
  assert.deepEqual((await call("/signing/sessions/cms", submit)).body, accepted.body);
  const conflict = await call(`/signing/sessions/${created.body.id}/cancel`, { expectedSessionVersion: finished.body.version, idempotencyKey: randomUUID() });
  assert.equal(conflict.status, 409); assert.equal(conflict.body.code, "SESSION_ALREADY_COMMITTED");
  const saved = await db.identitySigningEvidence.findUniqueOrThrow({ where: { sessionId: created.body.id } });
  assert.equal(saved.accepted, true); assert.equal(saved.policySha256, process.env.NCA_IDENTITY_POLICY_SHA256);
  await writeFile(path.join(fixtureRoot, "checks.json"), JSON.stringify({ status: "PASS", checks: ["JWT/no spoof", "strict inputs", "10-minute server challenge", "actual SDK CMS/TSP/CRLs", "async processing", "encrypted binding/evidence", "masked read", "constant replay", "committed cancellation denial"] }, null, 2));
  console.log("PASS HTTP identity end-to-end: JWT, challenge, real SDK CMS, independent Java verification with TSP/CRLs, atomic binding, masked view, replay and committed cancellation denial");
} finally {
  await app?.close();
  await db.signingIdentityBinding.deleteMany({ where: { userId: actorId } });
  await db.identitySigningEvidence.deleteMany({ where: { session: { userId: actorId } } });
  await db.identitySigningCommand.deleteMany({ where: { userId: actorId } });
  await db.identitySigningSession.deleteMany({ where: { userId: actorId } });
  await db.auditLog.deleteMany({ where: { actorId } });
  await db.user.deleteMany({ where: { id: actorId } });
  await db.organization.deleteMany({ where: { id: organizationId } });
  await db.$disconnect();
}
