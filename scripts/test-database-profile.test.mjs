import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";

const target = "postgresql://marketplace:marketplace@localhost:5432/marketplace?schema=public";
const ci = { GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "github-hosted", POSTGRES_TEST_DATABASE_URL: target };

test("both hosted CI jobs select the prepared marketplace database", () => {
  assert.equal(testDatabaseUrl(ci), target);
  assert.equal(testDatabaseUrl({ ...ci, DATABASE_URL: target }), target);
  assert.equal(testDatabaseUrl({ ...ci, TEST_DATABASE_URL: target }), target);
});

test("local defaults and explicit PostgreSQL test alias preserve dev/test isolation", () => {
  assert.match(testDatabaseUrl({}), /\/dentmarket_audit_20260914\?/);
  const audit = "postgresql://u:p@localhost:5432/dentmarket_audit_20260914?schema=public";
  assert.equal(testDatabaseUrl({ POSTGRES_TEST_DATABASE_URL: audit }), audit);
  assert.throws(() => testDatabaseUrl({ POSTGRES_TEST_DATABASE_URL: target }), /different databases/);
  assert.throws(() => testDatabaseUrl({ DATABASE_URL: target, TEST_DATABASE_URL: target.replace("localhost", "127.0.0.1").replace("schema=public", "schema=test") }), /different databases/);
});

test("CI fails closed for missing, unapproved, inconsistent or production configuration", () => {
  for (const delta of [
    { RUNNER_ENVIRONMENT: undefined }, { RUNNER_ENVIRONMENT: "self-hosted" },
    { POSTGRES_TEST_DATABASE_URL: undefined }, { POSTGRES_TEST_DATABASE_URL: "" },
    { POSTGRES_TEST_DATABASE_URL: "not-a-url" },
    { POSTGRES_TEST_DATABASE_URL: target.replace("localhost", "remote.invalid") },
    { POSTGRES_TEST_DATABASE_URL: target.replace("5432", "5433") },
    { POSTGRES_TEST_DATABASE_URL: target.replace("/marketplace?", "/postgres?") },
    { POSTGRES_TEST_DATABASE_URL: target.replace("/marketplace?", "/dentmarket_audit_20260914?") },
    { POSTGRES_TEST_DATABASE_URL: target.replace("schema=public", "schema=other") },
    { POSTGRES_TEST_DATABASE_URL: target + "&host=remote.invalid" },
    { DATABASE_URL: target.replace("/marketplace?", "/other?") },
    { TEST_DATABASE_URL: target.replace("/marketplace?", "/other?") },
    { NODE_ENV: "production" },
  ]) assert.throws(() => testDatabaseUrl({ ...ci, ...delta }));
  assert.throws(() => testDatabaseUrl({ NODE_ENV: "production" }));
  assert.throws(() => testDatabaseUrl({ POSTGRES_TEST_DATABASE_URL: target.replace("localhost", "remote.invalid") }));
});

test("wrapper passes the same CI target to its child and propagates exit status", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "market-test-db-"));
  const child = path.join(directory, "npm-probe.cjs");
  writeFileSync(child, 'console.log(JSON.stringify({database:process.env.DATABASE_URL,test:process.env.POSTGRES_TEST_DATABASE_URL})); process.exit(Number(process.argv[2]));');
  const env = { ...process.env, ...ci, npm_execpath: child };
  delete env.TEST_DATABASE_URL;
  delete env.DATABASE_URL;
  delete env.NODE_ENV;
  try {
    const result = spawnSync(process.execPath, ["scripts/with-test-database.mjs", "7"], { env, encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 7, result.stderr);
    assert.match(result.stdout, /"database":/);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
    assert.deepEqual(actual, { database: target, test: target });
    const refused = spawnSync(process.execPath, ["scripts/with-test-database.mjs", "0"], { env: { ...env, RUNNER_ENVIRONMENT: "self-hosted" }, encoding: "utf8", timeout: 10000 });
    assert.equal(refused.status, 1);
    assert.equal(refused.stdout, "", "Invalid configuration must not start the child");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
