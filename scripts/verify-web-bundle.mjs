import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Same ceiling as the prior buyer catalog gate; a new entry point must earn
// its budget by removing unused code, not by relaxing the existing limits.
const budgets = { javascriptFiles: 24, rawBytes: 1_500_000, gzipBytes: 450_000 };
const build = fileURLToPath(new URL("../apps/web/.next/", import.meta.url));
const base = JSON.parse(readFileSync(resolve(build, "build-manifest.json"), "utf8"));
const results = [];
for (const route of ["/(marketplace)/page", "/(marketplace)/catalog/page"]) {
  const manifestPath = resolve(build, `server/app${route}_client-reference-manifest.js`);
  const sandbox = { globalThis: {} };
  vm.runInNewContext(readFileSync(manifestPath, "utf8"), sandbox, { filename: manifestPath, timeout: 1000 });
  const manifest = sandbox.globalThis.__RSC_MANIFEST?.[route];
  if (!manifest) throw new Error(`Missing canonical web manifest: ${route}`);
  const assets = new Set([...(base.polyfillFiles ?? []), ...(base.rootMainFiles ?? [])]);
  for (const module of Object.values(manifest.clientModules ?? {})) {
    for (const chunk of module.chunks ?? []) if (typeof chunk === "string" && chunk.endsWith(".js")) assets.add(chunk);
  }
  const files = [...assets].map(asset => {
    if (!asset.startsWith("static/") || asset.includes("..")) throw new Error("Unexpected build asset path");
    const content = readFileSync(resolve(build, asset));
    return { asset, rawBytes: content.length, gzipBytes: gzipSync(content).length };
  });
  results.push({ route, javascriptFiles: files.length,
    rawBytes: files.reduce((sum, file) => sum + file.rawBytes, 0),
    gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0), budgets,
    files: files.sort((a, b) => b.rawBytes - a.rawBytes) });
}
console.log(JSON.stringify(results, null, 2));
// Baselines report the same measurements before an optimization; CI enforces.
if (!process.argv.includes("--report-only")) {
  const failures = results.flatMap(result => Object.entries(budgets)
    .filter(([key, limit]) => result[key] > limit)
    .map(([key, limit]) => `${result.route}: ${key} ${result[key]} > ${limit}`));
  if (failures.length) throw new Error(`Canonical web bundle budget: ${failures.join("; ")}`);
}
