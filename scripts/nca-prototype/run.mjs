import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

// No network downloads, no system installation, no application/database mutations.
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.join(root, ".tmp/nca-prototype", ...(process.platform === "linux" ? ["linux"] : []));
const mode = process.argv[2];
if (!["offline", "online", "revocation", "negative-evidence", "inspect-timestamp", "verify-browser", "verify-timestamp-evidence"].includes(mode)) throw new Error("Usage: node scripts/nca-prototype/run.mjs offline|online|revocation|negative-evidence|inspect-timestamp|verify-browser|verify-timestamp-evidence");
const sdk = process.env.NCA_SDK_ROOT;
const jdk = process.env.NCA_JAVA_HOME;
const dependencySource = process.env.NCA_DEPENDENCIES;
if (!sdk || !jdk || !dependencySource) throw new Error("Set NCA_SDK_ROOT, NCA_JAVA_HOME and NCA_DEPENDENCIES; see README");
if (["offline", "online", "revocation", "negative-evidence"].includes(mode) && !process.env.NCA_TEST_KEY_PASSWORD) throw new Error("NCA_TEST_KEY_PASSWORD is required (SDK test fixtures only)");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const deps = path.join(output, "deps");
const classes = path.join(output, "classes");
const evidence = path.join(output, "evidence");
await Promise.all([mkdir(deps, { recursive: true }), mkdir(classes, { recursive: true }), mkdir(evidence, { recursive: true })]);
const inputs = [
  [path.join(sdk, "Java/provider/kalkancrypt-0.7.8-current.jar"), "kalkancrypt-0.7.8-current.jar", null],
  [path.join(sdk, "Java/utils/knca_provider_util-0.8.5.jar"), "knca_provider_util-0.8.5.jar", null],
  [path.join(dependencySource, "slf4j-api-1.7.36.jar"), "slf4j-api-1.7.36.jar", "d3ef575e3e4979678dc01bf1dcce51021493b4d11fb7f1be8ad982877c16a1c0"],
  [path.join(dependencySource, "slf4j-simple-1.7.36.jar"), "slf4j-simple-1.7.36.jar", "2f39bed943d624dfa8f4102d0571283a10870b6aa36f197a8a506f147010c10f"],
];
const artifacts = [];
for (const [source, name, expected] of inputs) {
  const bytes = await readFile(source);
  const hash = sha256(bytes);
  if (expected && hash !== expected) throw new Error(`Dependency hash mismatch: ${name}`);
  const destination = path.join(deps, name);
  if (path.resolve(source) !== path.resolve(destination)) await copyFile(source, destination);
  artifacts.push({ name, sha256: hash, bytes: bytes.length });
}
const bin = name => path.join(jdk, "bin", name + (process.platform === "win32" ? ".exe" : ""));
const source = path.join(root, "scripts/nca-prototype/NcaPrototype.java");
const sourceHash = sha256(await readFile(source));
const testTrustArchive = "C/Linux/ca-certs/ca-certs_old/test.zip";
const testTrust = { sdkPath: testTrustArchive, sha256: sha256(await readFile(path.join(sdk, testTrustArchive))) };
const javaVersion = spawnSync(bin("java"), ["-version"], { encoding: "utf8", timeout: 10_000 });
if (javaVersion.status !== 0) throw new Error("Java runtime unavailable");
const buildKey = sha256(JSON.stringify({ sourceHash, artifacts, runtime: javaVersion.stderr }));
let cached;
try { cached = JSON.parse(await readFile(path.join(output, "build.json"), "utf8")); } catch { /* first run */ }
const attempt = new Date().toISOString().replace(/[:.]/g, "-");
if (mode === "verify-browser") {
  const receipts = (await readdir(evidence)).filter(name => /^ncalayer-sign-.*\.json$/.test(name));
  if (!receipts.length) throw new Error("No browser signing receipts");
  for (const name of receipts) {
    const receipt = JSON.parse(await readFile(path.join(evidence, name), "utf8"));
    const result = receipt.body?.result;
    if (receipt.status !== true || !Array.isArray(result) || result.length !== 1 || typeof result[0] !== "string") throw new Error(`Invalid receipt: ${name}`);
    const match = /^-----BEGIN CMS-----\s*([A-Za-z0-9+/=\s]+)-----END CMS-----\s*$/.exec(result[0]);
    if (!match) throw new Error(`Invalid CMS PEM: ${name}`);
    await writeFile(path.join(evidence, name.replace(/\.json$/, ".cms")), Buffer.from(match[1].replace(/\s/g, ""), "base64"));
  }
}
if (cached?.buildKey !== buildKey) {
  const compiled = spawnSync(bin("javac"), ["-encoding", "UTF-8", "-cp", path.join(deps, "*"), "-d", classes, source],
    { encoding: "utf8", timeout: 30_000, maxBuffer: 256_000 });
  await writeFile(path.join(output, `compile-${attempt}.log`), `${compiled.stdout ?? ""}${compiled.stderr ?? ""}`);
  if (compiled.status !== 0) throw new Error(`Compile failed; inspect compile-${attempt}.log`);
  await writeFile(path.join(output, "build.json"), JSON.stringify({ buildKey }, null, 2));
}
const result = spawnSync(bin("java"), ["-Dsun.net.client.defaultConnectTimeout=10000", "-Dsun.net.client.defaultReadTimeout=10000",
  "-cp", [classes, path.join(deps, "*")].join(path.delimiter), "NcaPrototype", sdk, evidence, mode],
  { encoding: "utf8", timeout: 60_000, maxBuffer: 256_000 });
const stdout = result.stdout ?? "";
await writeFile(path.join(output, `${mode}-${attempt}.log`), `${stdout}${result.stderr ?? ""}`);
const checks = stdout.split(/\r?\n/).filter(line => line.startsWith("RESULT\t")).map(line => {
  const [, id, status, detail] = line.split("\t"); return { id, status, ...(detail ? { detail } : {}) };
});
const metadata = Object.fromEntries(stdout.split(/\r?\n/).filter(line => line.startsWith("META\t")).map(line => line.split("\t").slice(1, 3)));
const evidenceFiles = [];
for (const name of await readdir(evidence)) {
  const bytes = await readFile(path.join(evidence, name));
  evidenceFiles.push({ name, sha256: sha256(bytes), bytes: bytes.length });
}
const manifest = { version: 1, attempt, mode, sourceHash, artifacts, runtime: javaVersion.stderr.trim(), platform: process.platform,
  testTrust,
  architecture: process.arch, kernelRelease: os.release(), nodeVersion: process.version,
  exitCode: result.status, processError: result.error?.code ?? null, checks, metadata, evidenceFiles,
  limitations: ["Standalone SDK experiment, not production acceptance", "SDK signing is not an NCALayer browser receipt",
    "Clock-boundary cases use an explicit test date", "No domain authority/tenant/transaction or Linux proof from a Windows run"] };
await writeFile(path.join(output, `${mode}-${attempt}.json`), JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ mode, checks, exitCode: result.status, manifest: path.relative(root, path.join(output, `${mode}-${attempt}.json`)) }, null, 2));
process.exitCode = result.status === 0 && !result.error ? 0 : 1;
