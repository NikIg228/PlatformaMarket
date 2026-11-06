import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "market-limited-compose-"));
try {
  const env = join(dir, "fixture.env");
  writeFileSync(env, "SHARED_DIR=/market-test-fixture\nMARKET_ORIGIN=https://market.example.test\n" + ["API", "WEB", "GATE", "POSTGRES", "REDIS", "CLAMAV"].map(name => `${name}_IMAGE=sha256:${"a".repeat(64)}\n`).join(""));
  const overlay = join(dir, "fixture.yaml");
  writeFileSync(overlay, "services:\n" + ["api", "worker", "stand-access"].map(name => `  ${name}:\n    env_file: !reset []\n`).join(""));
  const config = JSON.parse(execFileSync("docker", ["compose", "--env-file", env, "-f", "deploy/limited-stand/compose.yaml", "-f", overlay, "config", "--no-env-resolution", "--format", "json"], { cwd: root, encoding: "utf8", windowsHide: true }));
  assert.equal(config.networks.market.internal, true);
  for (const [name, service] of Object.entries(config.services)) {
    assert(!service.ports?.length, `${name} must not expose an ingress bypass`);
    assert.equal(service.cgroup_parent, "platformamarket.slice");
    assert.equal(service.read_only, true);
    assert(service.security_opt.includes("no-new-privileges:true"));
    assert(service.cap_drop.includes("ALL"));
    assert(service.mem_limit > 0);
    for (const mount of service.tmpfs ?? []) assert(mount.startsWith("/"), `${name}: invalid temporary filesystem`);
  }
  assert.equal(config.services.api.depends_on.clamav.condition, "service_healthy");
  assert.equal(config.services.worker.depends_on.api.condition, "service_healthy");
  assert.equal(config.services["stand-access"].environment.STAND_PRODUCT, "Market");
  assert.equal(config.services["stand-access"].environment.STAND_ORIGIN, "https://market.example.test");
  assert.equal(config.services["stand-access"].environment.STAND_WEBHOOK_PATHS, "[]");
  console.log("PASS isolated network, no published ports, resource limits, restricted containers and health dependencies");
} finally { rmSync(dir, { recursive: true, force: true }); }
