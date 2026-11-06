import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
function inputs(file) {
  const full = resolve(root, file);
  const config = ts.readConfigFile(full, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(full, ".."));
  assert.equal(parsed.errors.length, 0, JSON.stringify(parsed.errors));
  return parsed;
}

test("runtime compiler inputs exclude tests without weakening typecheck", () => {
  for (const workspace of ["apps/api", "packages/schemas"]) {
    const build = inputs(`${workspace}/tsconfig.build.json`);
    const types = inputs(`${workspace}/tsconfig.json`);
    const testFiles = types.fileNames.filter(file => /\.(spec|test)\.ts$/.test(file));
    assert(testFiles.length > 0, `${workspace}: tests remain typechecked`);
    assert(!build.fileNames.some(file => testFiles.includes(file)), `${workspace}: tests in runtime build`);
    const runtimeFiles = types.fileNames.filter(file => !/\.(spec|test)\.ts$/.test(file) && !file.replaceAll("\\", "/").includes("/prisma/seed.ts"));
    for (const file of runtimeFiles) assert(build.fileNames.includes(file), `Runtime input lost: ${file}`);
  }
  const api = inputs("apps/api/tsconfig.build.json");
  assert.equal(resolve(api.options.rootDir), resolve(root, "apps/api"));
  for (const entry of ["main.ts", "worker.ts", "platform/runtime/runtime-role-probe.ts", "platform/runtime/deployment-profile-probe.ts"]) {
    assert(api.fileNames.some(file => file.replaceAll("\\", "/").endsWith(`/src/${entry}`)));
  }
});

test("migration CLI stays installed when API dev dependencies are omitted", () => {
  const api = JSON.parse(read("apps/api/package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  assert(api.dependencies.prisma);
  assert.equal(api.devDependencies.prisma, undefined);
  assert.equal(lock.packages["apps/api"].dependencies.prisma, api.dependencies.prisma);
  assert.notEqual(lock.packages["node_modules/prisma"].dev, true);
  // Nested runtime installs must be explicitly copied if future dependency conflicts create them.
  const nested = Object.entries(lock.packages).filter(([name, value]) =>
    /^(apps\/api|packages\/schemas)\/node_modules\//.test(name) && !value.dev);
  assert.deepEqual(nested, [], "Docker dependency copy needs nested production modules");
});

test("runtime images keep resources but do not inherit the build workspace", () => {
  const docker = read("Dockerfile");
  assert.match(docker, /FROM base AS web\b/);
  assert.match(docker, /FROM base AS api\b/);
  assert.match(docker, /npm ci --omit=dev --workspace=@marketplace\/api --workspace=@marketplace\/schemas --include-workspace-root=false/);
  for (const required of [".next/standalone", "apps/web/public", ".next/static", "node_modules/.prisma", "apps/api/prisma/migrations", "apps/api/prisma/schema.prisma", "packages/schemas/dist", "apps/api/dist", "apps/buyer-web/public"]) {
    assert(docker.includes(required), `Missing runtime resource: ${required}`);
  }
  const ignores = read(".dockerignore").split(/\r?\n/);
  for (const item of ["output", "outputs", ".tmp", ".turbo", ".playwright-cli", "test-results", "**/*.tsbuildinfo", "apps/web/public", "apps/web/generated"]) assert(ignores.includes(item));
  for (const source of ["apps/buyer-web/public", "apps/landing-web/public", "apps/supplier-web/public", "data"]) assert(!ignores.includes(source));
  assert.match(read("apps/web/next.config.ts"), /output:\s*"standalone"/);
});

test("VM delivery keeps its entrypoints and rollback after retiring Vercel", () => {
  for (const file of ["vercel.json", "vercel.api.json", ".vercelignore", "apps/api/vercel.json", "apps/buyer-web/vercel.json", "api/index.ts", "api/index.js", "api/[...path].ts", "api/[...path].js", "apps/api/api/index.ts", "apps/api/api/[...path].ts", "pnpm-workspace.yaml"]) {
    assert(!existsSync(resolve(root, file)), `Retired deployment entry remains: ${file}`);
  }
  for (const file of ["apps/api/src/main.ts", "apps/api/src/worker.ts", "compose.production.yaml", "compose.production.legacy.yaml", "infra/Caddyfile.legacy"]) assert(existsSync(resolve(root, file)));
});
