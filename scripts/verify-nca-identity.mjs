import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Real SDK public fixtures only; never connects to an application or database.
const root = fileURLToPath(new URL("../", import.meta.url));
const sdk = process.env.NCA_SDK_ROOT, jdk = process.env.NCA_JAVA_HOME, deps = process.env.NCA_DEPENDENCIES;
if (!sdk || !jdk || !deps) throw new Error("Set NCA_SDK_ROOT, NCA_JAVA_HOME, NCA_DEPENDENCIES");
const out = path.join(root, ".tmp/nca-identity", process.platform);
const classes = path.join(out, "classes"); await mkdir(classes, { recursive: true });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const cp = [classes, path.join(deps, "*")].join(path.delimiter);
const bin = name => path.join(jdk, "bin", name + (process.platform === "win32" ? ".exe" : ""));
async function run(binary, args, input = "", extraEnv = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true, env: { ...process.env, ...extraEnv }, stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [], stderr = []; let bytes = 0;
    const timeout = setTimeout(() => { child.kill(); reject(new Error("Verifier test process timeout")); }, 60000);
    child.stdout.on("data", chunk => { bytes += chunk.length; if (bytes > 48_000_000) child.kill(); else stdout.push(chunk); });
    child.stderr.on("data", chunk => { if (stderr.length < 10) stderr.push(chunk); });
    child.on("error", error => { clearTimeout(timeout); reject(error); });
    child.on("close", code => { clearTimeout(timeout); if (code !== 0) reject(new Error(`Child exited ${code}: ${Buffer.concat(stderr).toString().slice(0, 1200)}`)); else resolve(Buffer.concat(stdout).toString()); });
    child.stdin.on("error", () => {}); child.stdin.end(input);
  });
}
await run(bin("javac"), ["-encoding", "UTF-8", "-cp", path.join(deps, "*"), "-d", classes,
  path.join(root, "scripts/nca-verifier/NcaIdentityVerifier.java"), path.join(root, "scripts/nca-verifier/NcaIdentityFixtures.java")]);
await run(bin("java"), ["-cp", cp, "NcaIdentityFixtures", sdk, out, "policy"]);
// The SDK publishes this password alongside the synthetic keys. Never print it.
const readme = await readFile(path.join(sdk, "Keys and Certs/Gost2015/README.txt"), "utf8");
const fixturePassword = /сертификатам:\s*(\S+)/.exec(readme)?.[1];
if (!fixturePassword) throw new Error("SDK public fixture password not found");
const createdAt = new Date().toISOString();
const original = Buffer.from(JSON.stringify({ purpose: "BIND_IDENTITY", audience: "platforma-market-test-only", createdAt, nonce: hash(createdAt) }));
const originalPath = path.join(out, "original.bin"); await writeFile(originalPath, original);
for (const state of ["valid", "expired", "revoked", "unstamped"]) {
  await run(bin("java"), ["-cp", cp, "NcaIdentityFixtures", sdk, out, "sign", originalPath, path.join(out, `${state}.cms`), state], "", { NCA_TEST_KEY_PASSWORD: fixturePassword });
}
const acceptedAt = new Date().toISOString();
const policyPath = path.join(out, "test-policy.properties"), policy = await readFile(policyPath);
const signed = await readFile(path.join(out, "valid.cms"));
async function verify({ cms = signed, content = original, policyFile = policyPath, digest, mode = "test", created = createdAt, accepted = acceptedAt } = {}) {
  const actualDigest = digest ?? hash(await readFile(policyFile));
  const input = [content.toString("base64"), cms.toString("base64"), created, accepted, ""].join("\n");
  return JSON.parse(await run(bin("java"), ["-cp", cp, "NcaIdentityVerifier", policyFile, actualDigest, mode], input));
}
const checks = [];
async function check(name, action) {
  try { await action(); checks.push({ name, status: "PASS" }); }
  catch (error) { checks.push({ name, status: "FAIL", message: String(error.message).slice(0, 180) }); }
  console.log(`${name}: ${checks.at(-1).status}`);
}
function assert(value, message) { if (!value) throw new Error(message); }
async function rejected(options, code) { const result = await verify(options); assert(result.status === "REJECTED" && result.code === code, `Expected ${code}, got ${result.status}/${result.code}`); }
await check("real-signed-challenge-chain-tsp-four-crls", async () => {
  const result = await verify();
  assert(result.status === "VERIFIED", `Unexpected ${result.status}/${result.code}`);
  assert(/^\d{12}$/.test(result.iin) && result.originalSha256 === hash(original) && result.cmsSha256 === hash(signed), "Identity/content proof missing");
  assert(result.revocations.length === 4 && result.certificatesBase64.length === 6 && result.trustProfile === "TEST", "Trust evidence missing");
  await writeFile(path.join(out, "verified-evidence.json"), JSON.stringify(result));
});
await check("modified-original", () => rejected({ content: Buffer.concat([original, Buffer.from("x")]) }, "INVALID_SIGNATURE"));
await check("malformed-cms", () => rejected({ cms: Buffer.from("not a CMS") }, "INVALID_SIGNATURE"));
await check("expired-signer", async () => rejected({ cms: await readFile(path.join(out, "expired.cms")) }, "CERTIFICATE_EXPIRED"));
await check("revoked-signer", async () => rejected({ cms: await readFile(path.join(out, "revoked.cms")) }, "CERTIFICATE_REVOKED"));
await check("missing-timestamp", async () => rejected({ cms: await readFile(path.join(out, "unstamped.cms")) }, "INVALID_SIGNATURE"));
await check("policy-hash-mismatch", () => rejected({ digest: "0".repeat(64) }, "VERIFIER_UNAVAILABLE"));
await check("test-trust-denied-in-production", () => rejected({ mode: "production" }, "VERIFIER_UNAVAILABLE"));
await check("submission-at-expiry", () => rejected({ accepted: new Date(Date.parse(createdAt) + 600000).toISOString() }, "SESSION_EXPIRED"));
const fault = http.createServer((req, res) => { res.writeHead(req.url === "/unavailable" ? 503 : 200); res.end("invalid-crl"); });
await new Promise(resolve => fault.listen(0, "127.0.0.1", resolve));
try {
  for (const [route, code] of [["unavailable", "VERIFIER_UNAVAILABLE"], ["malformed", "TRUST_INDETERMINATE"]]) {
    await check(`crl-${route}`, async () => {
      const altered = policy.toString().replace(/^signer\.leaf\.crl=.*$/m, `signer.leaf.crl=http://127.0.0.1:${fault.address().port}/${route}`);
      const file = path.join(out, `fault-${route}.properties`); await writeFile(file, altered);
      await rejected({ policyFile: file }, code);
    });
  }
} finally { await new Promise(resolve => fault.close(resolve)); }
await writeFile(path.join(out, "checks.json"), JSON.stringify({ at: acceptedAt, checks, policySha256: hash(policy),
  sourceSha256: hash(await readFile(path.join(root, "scripts/nca-verifier/NcaIdentityVerifier.java"))) }, null, 2));
if (checks.some(check => check.status !== "PASS")) process.exitCode = 1;
