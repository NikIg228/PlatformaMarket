import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer, connect } from "node:tls";
import { verifiedPostgresOptions } from "./lib/verified-postgres.mjs";

test("maintenance DB connections authenticate the TLS peer independently of environment defaults", () => {
  const result = verifiedPostgresOptions("postgresql://user:pass@db.example/app", { PGSSLMODE: "no-verify", NODE_TLS_REJECT_UNAUTHORIZED: "0" });
  assert.equal(result.ssl.rejectUnauthorized, true);
  assert.equal(new URL(result.connectionString).hostname, "db.example");
});
test("URI SSL modes cannot replace the verified options", () => {
  for (const query of ["sslmode=no-verify", "sslmode=disable", "sslmode=require", "ssl=false", "uselibpqcompat=true"]) {
    assert.throws(() => verifiedPostgresOptions(`postgresql://db.example/app?${query}`, {}), /TLS|sslmode/);
  }
  const result = verifiedPostgresOptions("postgresql://db.example/app?sslmode=verify-full&application_name=review", {});
  assert.equal(new URL(result.connectionString).searchParams.has("sslmode"), false);
  assert.equal(new URL(result.connectionString).searchParams.get("application_name"), "review");
});
test("custom trust files are read explicitly and missing files fail closed", () => {
  assert.throws(() => verifiedPostgresOptions("postgresql://db.example/app", { PGSSLROOTCERT: "missing-maintenance-ca.pem" }), /ENOENT/);
});
test("all six maintenance clients use the verified connection boundary", () => {
  for (const file of ["cleanup-duplicate-imported-variants", "build-supplier-mapping-review", "repair-imported-catalog-structure-pg", "repair-imported-catalog-structure-batch", "qualify-imported-catalog-categories", "report-search-quality"]) {
    const text = readFileSync(new URL(`./${file}.mjs`, import.meta.url), "utf8");
    assert.match(text, /\.\.\.verifiedPostgresOptions\(process.env.DATABASE_URL\)/, file);
    assert.doesNotMatch(text, /rejectUnauthorized\s*:\s*false/, file);
  }
});

test("real TLS rejects an untrusted/wrong-host server and accepts the configured CA", async () => {
  const directory = mkdtempSync(join(process.env.SECURITY_TEST_ARTIFACT_DIR ?? tmpdir(), "maintenance-tls-"));
  const key = join(directory, "test.key"), cert = join(directory, "test.crt");
  const openssl = process.platform === "win32" ? "C:/Program Files/Git/usr/bin/openssl.exe" : "openssl";
  execFileSync(openssl, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"], { stdio: "ignore", windowsHide: true });
  const server = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, socket => socket.end());
  server.on("tlsClientError", () => {});
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const handshake = options => new Promise((resolve, reject) => {
    const socket = connect({ host: "127.0.0.1", port: server.address().port, servername: "localhost", ...options }, () => { socket.destroy(); resolve(); });
    socket.on("error", error => { socket.destroy(); reject(error); });
  });
  try {
    await assert.rejects(handshake(verifiedPostgresOptions("postgresql://localhost/app", {}).ssl), /self.signed|certificate/i);
    const trusted = verifiedPostgresOptions("postgresql://localhost/app", { PGSSLROOTCERT: cert }).ssl;
    await handshake(trusted);
    await assert.rejects(handshake({ ...trusted, servername: "wrong.example" }), /Hostname|altnames/i);
  } finally {
    await new Promise(resolve => server.close(resolve));
    rmSync(directory, { recursive: true });
  }
});
