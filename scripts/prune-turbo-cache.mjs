import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { applyCachePrune, isBuildCommand, planCachePrune } from "./lib/turbo-cache-retention.mjs";

const { values } = parseArgs({ options: {
  apply: { type: "boolean", default: false },
  "max-bytes": { type: "string", default: String(2 * 1024 ** 3) },
  "min-age-days": { type: "string", default: "7" },
  "max-age-days": { type: "string", default: "30" },
} });
const repository = fileURLToPath(new URL("../", import.meta.url));
function hasActiveBuild() {
  const output = process.platform === "win32"
    ? execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(node|turbo|npm|npx|pnpm|yarn)(\\.exe)?$' } | ForEach-Object { $_.CommandLine }"], { encoding: "utf8", timeout: 15000 })
    : execFileSync("ps", ["-eo", "args="], { encoding: "utf8", timeout: 15000 });
  return output.split(/\r?\n/).some(line => !line.includes("prune-turbo-cache.mjs") && isBuildCommand(line));
}
const plan = planCachePrune(repository, { maxBytes: Number(values["max-bytes"]), minAgeDays: Number(values["min-age-days"]), maxAgeDays: Number(values["max-age-days"]) });
const result = values.apply ? applyCachePrune(plan, hasActiveBuild) : null;
console.log(JSON.stringify({ mode: values.apply ? "apply" : "dry-run", directory: plan.directory,
  totalBytes: plan.totalBytes, removableBytes: plan.totalBytes - plan.remainingBytes, remainingBytes: plan.remainingBytes,
  budgetSatisfied: plan.remainingBytes <= plan.maxBytes, candidateEntries: plan.candidates.map(entry => entry.key),
  retainedEntries: plan.retained.length, ignored: plan.ignored, result }, null, 2));
