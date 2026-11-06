import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { applyCachePrune, isBuildCommand, planCachePrune } from "./lib/turbo-cache-retention.mjs";

const temporary = fileURLToPath(new URL("../.tmp/", import.meta.url));
const now = Date.parse("2026-11-05T00:00:00Z");
const day = 86400000;
function fixture(t) {
  mkdirSync(temporary, { recursive: true });
  const repository = mkdtempSync(join(temporary, "cache-retention-test-"));
  const cache = join(repository, ".turbo", "cache"); mkdirSync(cache, { recursive: true });
  t.after(() => {
    const target = realpathSync(repository);
    const within = relative(realpathSync(temporary), target);
    assert(within && !within.startsWith("..") && !within.includes(":"));
    assert(target.endsWith(repository.slice(repository.lastIndexOf("cache-retention-test-"))));
    rmSync(target, { recursive: true, force: true });
  });
  function pair(key, age = 40, metaAge = age) {
    for (const [suffix, days] of [["tar.zst", age], ["meta.json", metaAge]]) {
      const path = join(cache, `${key}.${suffix}`);
      writeFileSync(path, "fixture"); utimesSync(path, new Date(now - days * day), new Date(now - days * day));
    }
  }
  return { repository, cache, pair };
}

test("dry-run keeps files, apply prunes only complete old cache pairs and preserves evidence", t => {
  const f = fixture(t); const old = "a".repeat(16), recent = "b".repeat(16), incomplete = "c".repeat(16);
  f.pair(old); f.pair(recent, 2);
  writeFileSync(join(f.cache, `${incomplete}.tar.zst`), "partial");
  writeFileSync(join(f.cache, "diagnostic.log"), "keep");
  mkdirSync(join(f.repository, "output")); writeFileSync(join(f.repository, "output", "proof.txt"), "evidence");
  const plan = planCachePrune(f.repository, { now });
  assert.deepEqual(plan.candidates.map(entry => entry.key), [old]);
  assert(existsSync(join(f.cache, `${old}.tar.zst`)));
  assert.deepEqual(applyCachePrune(plan, () => false), { removedFiles: 2, removedBytes: 14 });
  for (const file of [`${recent}.tar.zst`, `${incomplete}.tar.zst`, "diagnostic.log"]) assert(existsSync(join(f.cache, file)));
  assert.equal(readFileSync(join(f.repository, "output", "proof.txt"), "utf8"), "evidence");
  assert(!existsSync(join(f.cache, ".prune.lock")));
});

test("byte budget evicts oldest eligible pairs, never fresh metadata or recent writes", t => {
  const f = fixture(t); f.pair("a".repeat(16), 20); f.pair("b".repeat(16), 10); f.pair("c".repeat(16), 40, 1);
  const plan = planCachePrune(f.repository, { now, maxBytes: 28 });
  assert.deepEqual(plan.candidates.map(entry => entry.key), ["a".repeat(16)]);
  assert.equal(plan.remainingBytes, 28);
  const zero = planCachePrune(f.repository, { now, maxBytes: 0 });
  assert.equal(zero.remainingBytes, 14);
  assert(!zero.candidates.some(entry => entry.key === "c".repeat(16)));
});

test("active build, failed activity check, changed file and existing lock stop deletion", t => {
  const f = fixture(t); const key = "d".repeat(16); f.pair(key);
  const plan = planCachePrune(f.repository, { now });
  assert.throws(() => applyCachePrune(plan, () => true), /active/);
  assert.throws(() => applyCachePrune(plan, () => { throw new Error("cannot inspect processes"); }), /cannot inspect/);
  writeFileSync(join(f.cache, ".prune.lock"), "other owner");
  assert.throws(() => applyCachePrune(plan, () => false), /EEXIST/);
  assert.equal(readFileSync(join(f.cache, ".prune.lock"), "utf8"), "other owner");
  rmSync(join(f.cache, ".prune.lock"));
  writeFileSync(join(f.cache, `${key}.meta.json`), "changed");
  assert.throws(() => applyCachePrune(plan, () => false), /changed/);
  assert(existsSync(join(f.cache, `${key}.tar.zst`)));
});

test("rejects linked cache roots and ignores linked cache entries", t => {
  const f = fixture(t); const outside = join(f.repository, "evidence"); mkdirSync(outside);
  writeFileSync(join(outside, "proof.txt"), "keep");
  const linkedRepository = join(f.repository, "linked"); mkdirSync(linkedRepository);
  symlinkSync(outside, join(linkedRepository, ".turbo"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => planCachePrune(linkedRepository, { now }), /real directory/);
  symlinkSync(outside, join(f.cache, "e".repeat(16) + ".tar.zst"), process.platform === "win32" ? "junction" : "dir");
  assert.equal(planCachePrune(f.repository, { now }).candidates.length, 0);
  assert.equal(readFileSync(join(outside, "proof.txt"), "utf8"), "keep");
});

test("empty/missing cache is a no-op and unsafe retention values are rejected", t => {
  const f = fixture(t);
  assert.equal(planCachePrune(f.repository, { now }).candidates.length, 0);
  assert.equal(planCachePrune(resolve(f.repository, "missing"), { now }).directory, null);
  for (const options of [{ maxBytes: -1 }, { minAgeDays: 0 }, { maxAgeDays: 1, minAgeDays: 2 }, { maxBytes: NaN }]) assert.throws(() => planCachePrune(f.repository, options));
});

test("activity guard recognizes direct compilers and project test launchers", () => {
  for (const command of ["node node_modules/next/dist/bin/next build", "node C:\\repo\\node_modules\\typescript\\bin\\tsc --noEmit", "npm run build --workspace=@marketplace/web", "node --test scripts/example.test.mjs", "node scripts/verify-runtime-split.mjs", "turbo.exe build", "node node_modules/vitest/vitest.mjs run"]) assert(isBuildCommand(command), command);
  assert(!isBuildCommand("node scripts/prune-turbo-cache.mjs --apply"));
  assert(!isBuildCommand("node app-server.mjs"));
});

test("replacing the cache directory invalidates a previously prepared plan", t => {
  const f = fixture(t); f.pair("f".repeat(16));
  const plan = planCachePrune(f.repository, { now });
  renameSync(f.cache, join(f.repository, ".turbo", "previous-cache"));
  mkdirSync(f.cache); f.pair("f".repeat(16));
  assert.throws(() => applyCachePrune(plan, () => false), /directory changed/);
  assert(existsSync(join(f.cache, "f".repeat(16) + ".tar.zst")));
  assert(!existsSync(join(f.cache, ".prune.lock")));
});
