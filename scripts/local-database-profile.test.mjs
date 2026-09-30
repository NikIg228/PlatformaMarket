import { test } from "node:test";
import assert from "node:assert/strict";
import { localDatabaseProfile, databaseLabel } from "./lib/local-database-profile.mjs";
test("dev and test default to separate local databases without exposing credentials", () => {
  const config = localDatabaseProfile({});
  assert.match(config.databaseUrl, /\/marketplace\?/);
  assert.match(config.testDatabaseUrl, /\/dentmarket_audit_20260914\?/);
  assert.equal(databaseLabel(config.databaseUrl), "127.0.0.1:5432/marketplace");
});
test("rejects shared databases even with hostname alias or different schema", () => {
  assert.throws(() => localDatabaseProfile({ DATABASE_URL: "postgresql://u:p@localhost/shared?schema=dev", TEST_DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/shared?schema=test" }), /different databases/);
});
test("rejects remote, system and production targets", () => {
  assert.throws(() => localDatabaseProfile({ NODE_ENV: "production" }), /production/);
  for (const DATABASE_URL of ["postgresql://u:p@remote/db", "postgresql://u:p@localhost/postgres", "postgresql://u:p@localhost/template1"]) assert.throws(() => localDatabaseProfile({ DATABASE_URL }));
});
