import { closeSync, fstatSync, lstatSync, openSync, readdirSync, realpathSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";

const day = 86400000;
const stamp = stat => [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(":");
const identity = path => { const stat = lstatSync(path); return [stat.dev, stat.ino, stat.birthtimeMs].join(":"); };
const samePath = (a, b) => process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;

export function isBuildCommand(line) {
  return /(?:^|[\s/\\])(?:turbo(?:\.exe)?|next(?:\.js)?|nest(?:\.js)?|tsc(?:\.js)?|vitest(?:\.mjs)?|playwright)(?:[\s/\\]|$)/i.test(line)
    || /(?:npm|pnpm|yarn).*\b(?:build|dev|test|typecheck)\b/i.test(line)
    || /node(?:\.exe)?["\s].*--test(?:[=\s]|$)/i.test(line)
    || /scripts[/\\](?:verify-|dev-|run-canonical-browser|with-test-database)/i.test(line);
}

function inspectRoot(repository) {
  const root = resolve(repository);
  for (const path of [root, join(root, ".turbo"), join(root, ".turbo", "cache")]) {
    let stat;
    try { stat = lstatSync(path); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
    if (!stat.isDirectory() || stat.isSymbolicLink() || !samePath(realpathSync(path), path)) throw new Error(`Cache path must be a real directory: ${path}`);
  }
  return join(root, ".turbo", "cache");
}

export function planCachePrune(repository, { now = Date.now(), maxBytes = 2 * 1024 ** 3, minAgeDays = 7, maxAgeDays = 30 } = {}) {
  if (![now, maxBytes, minAgeDays, maxAgeDays].every(Number.isFinite) || maxBytes < 0 || minAgeDays < 1 || maxAgeDays < minAgeDays)
    throw new Error("Expected nonnegative byte budget and 1 <= minAgeDays <= maxAgeDays");
  const directory = inspectRoot(repository);
  const plan = { repository: resolve(repository), directory, directoryIdentity: directory ? identity(directory) : null, totalBytes: 0, remainingBytes: 0, maxBytes, candidates: [], retained: [], ignored: [] };
  if (!directory) return plan;
  const groups = new Map();
  for (const name of readdirSync(directory)) {
    const stat = lstatSync(join(directory, name));
    const match = /^([a-f0-9]{16,64})\.(tar\.zst|meta\.json)$/.exec(name);
    if (stat.isFile() && !stat.isSymbolicLink()) plan.totalBytes += stat.size;
    if (!match || !stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) { plan.ignored.push(name); continue; }
    const entries = groups.get(match[1]) ?? [];
    entries.push({ name, size: stat.size, mtimeMs: stat.mtimeMs, stamp: stamp(stat) });
    groups.set(match[1], entries);
  }
  const complete = [];
  for (const [key, files] of groups) {
    if (files.length !== 2) { plan.ignored.push(...files.map(file => file.name)); continue; }
    complete.push({ key, files, bytes: files.reduce((sum, file) => sum + file.size, 0), newest: Math.max(...files.map(file => file.mtimeMs)) });
  }
  plan.remainingBytes = plan.totalBytes;
  complete.sort((a, b) => a.newest - b.newest || a.key.localeCompare(b.key));
  for (const entry of complete) {
    const age = now - entry.newest;
    if (age >= minAgeDays * day && (age >= maxAgeDays * day || plan.remainingBytes > maxBytes)) {
      plan.candidates.push(entry); plan.remainingBytes -= entry.bytes;
    } else plan.retained.push(entry.key);
  }
  return plan;
}

export function applyCachePrune(plan, hasActiveBuild) {
  if (typeof hasActiveBuild !== "function") throw new Error("Build activity check is required");
  if (hasActiveBuild()) throw new Error("A build/dev/test process is active; cache unchanged");
  const directory = inspectRoot(plan.repository);
  if (directory !== plan.directory || (directory && identity(directory) !== plan.directoryIdentity)) throw new Error("Cache directory changed since planning");
  if (!directory || !plan.candidates.length) return { removedFiles: 0, removedBytes: 0 };
  const lockPath = join(directory, ".prune.lock");
  const lock = openSync(lockPath, "wx");
  const lockStamp = stamp(fstatSync(lock));
  let removedFiles = 0, removedBytes = 0;
  try {
    const checkFile = file => {
      if (!/^[a-f0-9]{16,64}\.(tar\.zst|meta\.json)$/.test(file.name)) throw new Error("Invalid cache filename");
      const stat = lstatSync(join(directory, file.name));
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stamp(stat) !== file.stamp) throw new Error(`Cache file changed: ${file.name}`);
    };
    // Validate the entire selection before deleting anything; recheck each pair at deletion.
    for (const entry of plan.candidates) for (const file of entry.files) checkFile(file);
    for (const entry of plan.candidates) {
      if (hasActiveBuild()) throw new Error("Build activity appeared; pruning stopped");
      if (inspectRoot(plan.repository) !== directory || identity(directory) !== plan.directoryIdentity) throw new Error("Cache directory changed");
      for (const file of entry.files) checkFile(file);
      for (const file of entry.files) {
        unlinkSync(join(directory, file.name)); removedFiles++; removedBytes += file.size;
      }
    }
    return { removedFiles, removedBytes };
  } finally {
    closeSync(lock);
    // Never follow a replaced cache directory when releasing our lock.
    if (inspectRoot(plan.repository) === directory && identity(directory) === plan.directoryIdentity && stamp(lstatSync(lockPath)) === lockStamp) unlinkSync(lockPath);
  }
}
