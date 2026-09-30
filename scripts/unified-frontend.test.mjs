import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("unified proxy pins the upstream and publishes only same-origin links", () => {
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", "const {default:c}=await import('./apps/web/next.config.ts'); console.log(JSON.stringify({env:c.env, rewrites:await c.rewrites()}));"], {
    cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 15000,
    env: { ...process.env, DEPLOYMENT_PROFILE: "pilot", NEXT_PUBLIC_DEPLOYMENT_PROFILE: "pilot", INTERNAL_API_URL: "http://127.0.0.1:4012/api" },
  });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.env.NEXT_PUBLIC_API_URL, "/api");
  assert.equal(config.env.NEXT_PUBLIC_LOGIN_URL, "/login");
  assert.equal(config.env.NEXT_PUBLIC_UNIFIED_APP, "true");
  assert.equal(config.env.INTERNAL_API_URL, undefined);
  assert.deepEqual(config.rewrites, [{ source: "/api/:path*", destination: "http://127.0.0.1:4012/api/:path*" }]);
});

test("standard launch selects one web application with an explicit legacy rollback", () => {
  const { scripts } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(scripts.dev, "node scripts/dev-local.mjs unified");
  assert.equal(scripts["dev:legacy"], "node scripts/dev-local.mjs all");
  assert.match(scripts.build, /--filter=!@marketplace\/buyer-web/);
  assert.match(scripts["build:legacy"], /--filter=!@marketplace\/web/);
});
