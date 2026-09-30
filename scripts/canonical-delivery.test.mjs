import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { load } from "js-yaml";
import { verifyReleaseWebConfig } from "./verify-release-web-config.mjs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("canonical release, containers and ingress agree on api/web while rollback stays explicit", () => {
  const release = load(read(".github/workflows/release.yml"));
  assert.deepEqual(release.jobs.images.strategy.matrix.target, ["api", "web"]);
  const ci = load(read(".github/workflows/ci.yml"));
  assert.deepEqual(ci.jobs["container-build"].strategy.matrix.target, ["api", "web"]);
  const imageBuild = ci.jobs["container-build"].steps.find(step => step.uses?.startsWith("docker/build-push-action"));
  assert.equal(imageBuild.with.push, false);
  const dockerIgnore = read(".dockerignore").split(/\r?\n/);
  for (const excluded of [".env*", "**/.env*", ".codex", "outputs"]) assert(dockerIgnore.includes(excluded));
  const compose = load(read("compose.production.yaml"));
  assert.deepEqual(Object.keys(compose.services), ["api", "worker", "web", "caddy"]);
  assert.match(compose.services.web.image, /marketplace-web/);
  assert.equal(compose.services.web.environment.INTERNAL_API_URL, "http://api:4000/api");
  assert.match(read("infra/Caddyfile"), /reverse_proxy web:3000/);
  assert.match(read("infra/Caddyfile"), /handle \/api\/\*/);
  assert.match(read("infra/Caddyfile"), /max_size 25MB/);
  assert.match(read("compose.production.legacy.yaml"), /Caddyfile\.legacy/);
  assert.match(read("infra/Caddyfile.legacy"), /reverse_proxy buyer-web:3001/);
  const scripts = JSON.parse(read("apps/e2e/package.json")).scripts;
  assert.match(scripts.e2e, /run-canonical-browser.*playwright\.unified/);
  assert.equal(scripts["e2e:legacy"], "playwright test");
  assert.match(scripts["e2e:flow-b3"], /run-canonical-browser.*playwright\.flow-b3-unified/);
  const rootScripts = JSON.parse(read("package.json")).scripts;
  assert.match(rootScripts["verify:flow-b3"], /with-test-database.*e2e:flow-b3/);
  assert.doesNotMatch(rootScripts["verify:flow-b3"], /@marketplace\/(buyer|admin)-web/);
});
test("release rejects mixed origins and non-HTTPS settings", () => {
  const valid = { DEPLOYMENT_PROFILE: "pilot", PUBLIC_WEB_URL: "https://market.example.kz", GOOGLE_CLIENT_ID: "test-client", APPLE_CLIENT_ID: "test-client", APPLE_REDIRECT_URI: "https://market.example.kz/login" };
  verifyReleaseWebConfig(valid);
  for (const delta of [{ PUBLIC_WEB_URL: "http://market.example.kz" }, { PUBLIC_WEB_URL: "https://localhost" }, { PUBLIC_WEB_URL: "https://market.example.kz/path" }, { APPLE_REDIRECT_URI: "https://legacy.example.kz/login" }, { GOOGLE_CLIENT_ID: "" }, { DEPLOYMENT_PROFILE: "unknown" }]) {
    assert.throws(() => verifyReleaseWebConfig({ ...valid, ...delta }));
  }
});
