import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const target = new URL(process.env.POSTGRES_TEST_DATABASE_URL ?? "http://invalid");
assert(["localhost", "127.0.0.1"].includes(target.hostname) && target.pathname === "/dentmarket_audit_20260914", "Requires approved isolated test database");
assert.equal(process.env.DATABASE_URL, process.env.POSTGRES_TEST_DATABASE_URL);
const root = path.resolve(import.meta.dirname, ".."), fixtureRoot = path.join(root, ".tmp", `profile-http-${randomUUID()}`);
assert(fixtureRoot.startsWith(path.join(root, ".tmp", "profile-http-")));
await mkdir(fixtureRoot, { recursive: true });
let infected = false;
const scanner = createServer(socket => {
  let received = Buffer.alloc(0);
  socket.on("data", data => {
    received = Buffer.concat([received, data]);
    if (received.length > 14 && received.subarray(-4).equals(Buffer.alloc(4))) socket.end(infected ? "stream: Synthetic-Test FOUND\0" : "stream: OK\0");
  });
  socket.on("error", () => {});
});
await new Promise(resolve => scanner.listen(0, "127.0.0.1", resolve));
const secret = randomUUID() + randomUUID();
Object.assign(process.env, { NODE_ENV: "test", DEPLOYMENT_PROFILE: "go_live", PROCESS_ROLE: "api", AUTH_MODE: "jwt", JWT_SECRET: secret,
  JWT_REQUIRE_MFA: "false", JWT_ISSUER: "profile-test", JWT_AUDIENCE: "profile-test", BACKGROUND_QUEUE_ENABLED: "false", OBJECT_STORAGE_DRIVER: "local", LOCAL_STORAGE_PATH: path.join(fixtureRoot, "storage"),
  AV_SCAN_MODE: "required", CLAMAV_HOST: "127.0.0.1", CLAMAV_PORT: String(scanner.address().port), AUTH_LOCAL_MAIL_ENABLED: "true", API_HOST: "127.0.0.1", LOG_LEVEL: "fatal", OTEL_EXPORTER_OTLP_ENDPOINT: "", SENTRY_DSN: "" });
process.chdir(fixtureRoot);
const db = new PrismaClient();
const actorId = randomUUID(), organizationId = randomUUID(), sessionId = randomUUID();
let app;
try {
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, "dentmarket_audit_20260914");
  await db.organization.create({ data: { id: organizationId, legalName: "Synthetic HTTP profile", displayName: "Synthetic HTTP profile", bin: String(Date.now()).slice(-12), capabilities: { create: { capability: "BUYER" } } } });
  await db.user.create({ data: { id: actorId, displayName: "Synthetic HTTP User", email: `${actorId}@example.invalid`, emailVerifiedAt: new Date(), memberships: { create: { organizationId, status: "ACTIVE" } } } });
  await db.authSession.create({ data: { id: sessionId, userId: actorId, familyId: randomUUID(), refreshTokenHash: randomUUID(), organizationIds: [organizationId], activeOrganizationId: organizationId, expiresAt: new Date(Date.now() + 3600_000), authMethods: ["password"] } });
  const { createMarketplaceApp } = await import("../apps/api/dist/src/bootstrap.js");
  app = await createMarketplaceApp({ serverless: true }); await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api`;
  const token = jwt.sign({ organization_ids: [organizationId], organization_id: organizationId, amr: ["password"] }, secret, { subject: actorId, jwtid: sessionId, issuer: "profile-test", audience: "profile-test", expiresIn: 300 });
  const call = async (route, body, authenticated = true, extra = {}) => {
    const response = await fetch(base + route, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", ...(authenticated ? { authorization: `Bearer ${token}` } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15_000) });
    return { response, status: response.status, body: await response.json() };
  };
  const denied = await call("/auth/profile", undefined, false, { "x-user-id": actorId, "x-organization-id": organizationId, "x-session-id": sessionId });
  assert.equal(denied.status, 401); assert.equal(denied.body.code, "UNAUTHORIZED"); assert.equal(denied.body.path, "/api/auth/profile");
  const initial = await call("/auth/profile"); assert.equal(initial.status, 200); assert.equal(initial.body.version, 1); assert.equal(initial.response.headers.get("cache-control"), "no-store");
  assert.equal((await call("/auth/profile", { expectedVersion: 1, phone: "" })).status, 400);
  assert.equal((await call("/auth/profile", { expectedVersion: 1, actorId: randomUUID(), displayName: "Wrong" })).status, 400);
  assert.equal((await call("/auth/profile", { expectedVersion: 1, phone: "+77000000001", displayName: "Updated HTTP User" })).status, 201);
  assert.equal((await call("/auth/profile", { expectedVersion: 1, displayName: "Stale" })).status, 409);
  const picture = { expectedVersion: 2, fileName: "avatar.png", contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR1sAAAAASUVORK5CYII=" };
  infected = true; assert.equal((await call("/auth/profile/avatar", picture)).status, 400); infected = false;
  assert.equal((await call("/auth/profile/avatar", { ...picture, fileName: "avatar.jpg" })).status, 400);
  const uploaded = await call("/auth/profile/avatar", picture); assert.equal(uploaded.status, 201); assert.equal(uploaded.body.version, 3);
  const avatar = await call("/auth/profile/avatar"); assert.equal(avatar.status, 200); assert.equal(avatar.body.contentBase64, picture.contentBase64); assert.equal(avatar.response.headers.get("cache-control"), "no-store");
  const email = `new-${actorId}@example.invalid`;
  const requested = await call("/auth/profile/email", { expectedVersion: 3, email }); assert.equal(requested.status, 201); assert.equal(requested.body.delivery, "LOCAL_FILE");
  assert.equal((await call("/auth/profile")).body.email, `${actorId}@example.invalid`);
  const mailDirectory = path.join(fixtureRoot, ".tmp", "auth-mail"), names = await readdir(mailDirectory); assert.equal(names.length, 1);
  const mail = JSON.parse(await readFile(path.join(mailDirectory, names[0]), "utf8")); assert.equal(mail.to, email);
  const proof = new URL(mail.text.match(/https?:\/\/\S+\/verify-email\?token=\S+/)[0]).searchParams.get("token");
  const verified = await call("/auth/email/verify", { token: proof }, false); assert.equal(verified.status, 201); assert.equal(verified.body.user.email, email); assert.equal(verified.body.verified, true); assert.equal(verified.body.refreshToken, undefined);
  assert.equal((await call("/auth/profile")).status, 401);
  assert.equal((await call("/auth/email/verify", { token: proof }, false)).status, 401);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: actorId } })).email, email);
  console.log("PASS HTTP profile auth/header spoof denial, schema/errors/no-store, persistence/conflict, scan rejection/clean avatar, local verification mail, one-use proof and old-session revocation");
} finally {
  await app?.close(); await new Promise(resolve => scanner.close(resolve));
  await db.securityEvent.deleteMany({ where: { actorId } }); await db.auditLog.deleteMany({ where: { actorId } });
  await db.uploadAsset.deleteMany({ where: { uploadedById: actorId, purpose: "profile-avatar" } });
  await db.user.deleteMany({ where: { id: actorId } }); await db.organization.deleteMany({ where: { id: organizationId } }); await db.$disconnect();
  process.chdir(root);
  assert(fixtureRoot.startsWith(path.join(root, ".tmp", "profile-http-")));
  await rm(fixtureRoot, { recursive: true, force: true });
}
