import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { FileScannerService } from "/workspace/apps/api/dist/src/platform/security/file-scanner.service.js";
import { generateTotp } from "/workspace/apps/api/dist/src/platform/security/totp.js";

assert.equal(process.env.LIMITED_TEST_STAND, "true");
const file = "/credentials/accounts.json";
const credentials = JSON.parse(readFileSync(file, "utf8"));
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, retryStrategy: () => null });
const results = [];
const pass = name => { results.push(name); console.log(`PASS ${name}`); };
const call = async (path, { token, body, headers = {} } = {}) => {
  const response = await fetch(`http://api:4000/api${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  return { status: response.status, data };
};
try {
  const [tls] = await prisma.$queryRaw`SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()`;
  assert.equal(tls.ssl, true); pass("PostgreSQL transport uses TLS");
  await redis.connect(); assert.equal(await redis.ping(), "PONG"); pass("Redis TLS and authentication");
  assert.equal((await call("/health/ready")).status, 200); pass("API database/storage/queue readiness");
  assert.equal((await call("/organizations")).status, 401); pass("Anonymous protected request denied");
  assert.equal((await call("/auth/login", { body: { email: credentials.accounts[0].email, password: "invalid-password" } })).status, 401); pass("Invalid password denied");
  const tokens = {};
  for (const account of credentials.accounts) {
    const login = await call(account.role === "operator" ? "/auth/operator/login" : "/auth/login", { body: { email: account.email, password: account.password } });
    assert.equal(login.status, 201, `${account.role} login`);
    let token = login.data.accessToken;
    assert(token);
    if (account.role !== "operator") {
      assert.equal((await call("/organizations/current/profile", { token })).status, 401);
      if (!account.totpSecret) {
        const enrollment = await call("/identity/mfa/totp/enroll", { token, body: {} });
        assert.equal(enrollment.status, 201);
        account.totpSecret = enrollment.data.secret;
        account.recoveryCodes = enrollment.data.recoveryCodes;
        writeFileSync(file, JSON.stringify(credentials, null, 2) + "\n", { mode: 0o600 });
        const verified = await call("/identity/mfa/totp/verify", { token, body: { code: generateTotp(account.totpSecret) } });
        assert.equal(verified.status, 201); token = verified.data.accessToken;
      } else {
        const challenge = await call("/identity/mfa/challenge", { token, body: { code: generateTotp(account.totpSecret) } });
        assert.equal(challenge.status, 201); token = challenge.data.accessToken;
      }
      assert(token);
      assert.equal((await call("/organizations/current/profile", { token })).status, 200);
      assert.equal((await call("/organizations", { token })).status, 403);
    } else assert.equal((await call("/organizations", { token })).status, 200);
    tokens[account.role] = token;
    pass(`${account.role} login, role access${account.role === "operator" ? "" : ", MFA required and verified"}`);
  }
  const supplierClaims = JSON.parse(Buffer.from(tokens.supplier.split(".")[1], "base64url"));
  assert.equal((await call("/organizations/current/profile", { token: tokens.buyer, headers: { "x-organization-id": supplierClaims.organization_id } })).status, 401); pass("Cross-tenant organization override denied");
  assert.equal((await call("/auth/password/forgot", { body: { email: credentials.accounts[1].email } })).status, 503);
  assert.equal((await call("/payments/webhooks/MOCK", { body: {} })).status, 503);
  assert.equal(await prisma.paymentWebhookEvent.count(), 0); pass("External mail and payment webhook blocked before persistence");
  const scanner = new FileScannerService();
  assert.equal((await scanner.scan(Buffer.from("Market synthetic clean file"), "clean.txt")).clean, true);
  const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
  await assert.rejects(scanner.scan(Buffer.from(eicar), "antivirus-test.txt"), /отклонён/); pass("Antivirus clean and EICAR rejection");
  await assert.rejects(fetch("http://1.1.1.1", { signal: AbortSignal.timeout(3000) })); pass("Container internet egress blocked");
  writeFileSync("/credentials/runtime-verification.json", JSON.stringify({ status: "PASS", checks: results, at: new Date().toISOString() }, null, 2) + "\n", { mode: 0o600 });
} finally { redis.disconnect(); await prisma.$disconnect(); }
