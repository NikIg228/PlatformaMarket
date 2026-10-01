import { defineConfig, devices } from "@playwright/test";
import { e2eJwtSecret } from "./fixtures/workspace-session";

if (!process.env.DATABASE_URL) throw new Error("Run canonical browser tests through npm run verify:web / db:test");
const database = new URL(process.env.DATABASE_URL);
const hosted = process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_ENVIRONMENT === "github-hosted";
if (!["postgres:", "postgresql:"].includes(database.protocol) || !["localhost", "127.0.0.1"].includes(database.hostname) ||
  database.pathname !== (hosted ? "/marketplace" : "/dentmarket_audit_20260914") || database.port !== "5432" || database.search !== "?schema=public")
  throw new Error("Canonical browser tests require the approved isolated PostgreSQL target");
// These processes belong to this run. Never reuse a developer's API or identity.
process.env.JWT_SECRET = e2eJwtSecret;
export default defineConfig({
  testDir: "./tests",
  testMatch: ["unified-application.spec.ts", "public-catalog.spec.ts", "workspace-rebuild.spec.ts", "supplier-capabilities.spec.ts", "identity-management.spec.ts"],
  workers: 1, retries: 0, timeout: 90_000, expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
  webServer: [
    {
      command: "npm run start --workspace=@marketplace/api", cwd: "../..",
      url: "http://127.0.0.1:4012/api/health/ready", reuseExistingServer: false, timeout: 120_000,
      env: { DATABASE_URL: process.env.DATABASE_URL, API_HOST: "127.0.0.1", API_PORT: "4012",
        NODE_ENV: "test", AUTH_MODE: "jwt", JWT_SECRET: e2eJwtSecret,
        DEPLOYMENT_PROFILE: "pilot", PROCESS_ROLE: "api", BACKGROUND_QUEUE_ENABLED: "false",
        PAYMENT_PROVIDER_MODE: "mock", OBJECT_STORAGE_DRIVER: "local", AV_SCAN_MODE: "disabled",
        AUTH_LOCAL_MAIL_ENABLED: "true", AUTH_EMAIL_BASE_URL: "http://127.0.0.1:3000" },
    },
    { command: "npm run start --workspace=@marketplace/web", cwd: "../..",
      url: "http://127.0.0.1:3000", reuseExistingServer: false, timeout: 60_000 },
  ],
});
