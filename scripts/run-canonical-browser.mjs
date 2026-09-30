import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { assertPortsAvailable } from "./lib/local-readiness.mjs";

const target = new URL(process.env.DATABASE_URL ?? "invalid:");
const hosted = process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_ENVIRONMENT === "github-hosted";
const database = hosted ? "marketplace" : "dentmarket_audit_20260914";
assert(["postgres:", "postgresql:"].includes(target.protocol) && ["localhost", "127.0.0.1"].includes(target.hostname) &&
  target.port === "5432" && target.pathname === `/${database}` && target.search === "?schema=public", "Use the isolated db:test wrapper for canonical browser tests");
await assertPortsAvailable([3000, 4012]);
const db = new PrismaClient();
let publicOrganizationId;
try {
  const [identity] = await db.$queryRaw`SELECT current_database() AS name`;
  assert.equal(identity.name, database);
  const buyer = await db.organization.findUnique({ where: { bin: "970000000001" }, include: { capabilities: true } });
  assert(buyer?.status === "ACTIVE" && buyer.capabilities.some(item => item.capability === "BUYER"), "Canonical browser fixtures need the active synthetic pilot buyer; prepare the isolated database first");
  publicOrganizationId = buyer.id;
} finally { await db.$disconnect(); }
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const child = spawn(process.execPath, [require.resolve("@playwright/test/cli"), "test", ...args], {
  cwd: new URL("../apps/e2e/", import.meta.url), stdio: "inherit", windowsHide: true,
  env: { ...process.env, PUBLIC_CATALOG_ORGANIZATION_ID: publicOrganizationId },
});
child.once("error", error => { console.error(error.message); process.exitCode = 1; });
child.once("exit", code => { process.exitCode = code ?? 1; });
