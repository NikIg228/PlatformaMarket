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
  const limits = importJsonLimit();
  for (const path of ["infra/Caddyfile", "deploy/stand-access/Caddyfile"]) {
    assert.equal(Number(read(path).match(/max_size (\d+)/)[1]), limits);
  }
  assert.equal(compose.services.worker.depends_on.api.condition, "service_healthy");
  assert.match(compose.services.api.command.at(-1), /prisma migrate deploy && exec/);
  assert.equal(compose.services.api.healthcheck.test.at(-1), "http://127.0.0.1:4000/api/health/ready");
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

function importJsonLimit() {
  const source = read("packages/schemas/src/document-upload-limits.ts");
  const bytes = Number(source.match(/IMPORT_UPLOAD_MAX_BYTES = ([\d_]+)/)[1].replaceAll("_", ""));
  const metadata = Number(source.match(/IMPORT_UPLOAD_MAX_JSON_BYTES = IMPORT_UPLOAD_MAX_BASE64_CHARACTERS \+ ([\d_]+)/)[1].replaceAll("_", ""));
  return Math.ceil(bytes / 3) * 4 + metadata;
}
test("release rejects mixed origins and non-HTTPS settings", () => {
  const valid = { DEPLOYMENT_PROFILE: "pilot", PUBLIC_WEB_URL: "https://market.example.kz", GOOGLE_CLIENT_ID: "test-client", APPLE_CLIENT_ID: "test-client", APPLE_REDIRECT_URI: "https://market.example.kz/login" };
  verifyReleaseWebConfig(valid);
  for (const delta of [{ PUBLIC_WEB_URL: "http://market.example.kz" }, { PUBLIC_WEB_URL: "https://localhost" }, { PUBLIC_WEB_URL: "https://market.example.kz/path" }, { APPLE_REDIRECT_URI: "https://legacy.example.kz/login" }, { GOOGLE_CLIENT_ID: "" }, { DEPLOYMENT_PROFILE: "unknown" }]) {
    assert.throws(() => verifyReleaseWebConfig({ ...valid, ...delta }));
  }
});

test("CI proves pilot isolation before rebuilding for enabled promotion workspace", () => {
  const steps = load(read(".github/workflows/ci.yml")).jobs.verify.steps;
  const pilot = steps.findIndex(step => step.run === "npm run verify:web");
  const fullAccess = steps.findIndex(step => step.run === "npm run verify:full-access");
  const promotion = steps.findIndex(step => step.run?.includes("playwright.promotion-workspace.config.ts"));
  const build = steps.findIndex((step, index) => index > fullAccess && step.run === "npm run build --workspace=@marketplace/web");
  assert(pilot >= 0 && fullAccess > pilot && build > fullAccess && promotion > build);
  assert.equal(steps[build].env.DEPLOYMENT_PROFILE, "go_live");
  assert.equal(steps[promotion].env.DEPLOYMENT_PROFILE, "go_live");
  assert.match(steps[promotion].run, /db:test.*run-canonical-browser/);
});
