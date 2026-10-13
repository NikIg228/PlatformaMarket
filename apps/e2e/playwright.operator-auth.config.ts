import { defineConfig, devices } from "@playwright/test";
import { e2eJwtSecret } from "./fixtures/workspace-session";
const target = new URL(process.env.DATABASE_URL ?? "invalid:");
if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/dentmarket_audit_20260914" || target.port !== "5432") throw new Error("Use db:test with the approved isolated audit database");
export default defineConfig({ testDir: "./tests", testMatch: "operator-auth-live.spec.ts", workers: 1, retries: 0, timeout: 120_000, expect: { timeout: 15_000 }, reporter: "list",
  outputDir: "../../output/playwright/operator-auth-live", use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3000", serviceWorkers: "block", screenshot: "off", trace: "off" },
  webServer: { command: "npm run start --workspace=@marketplace/api", cwd: "../..", url: "http://127.0.0.1:4413/api/health/ready", reuseExistingServer: false, timeout: 120_000,
    env: { DATABASE_URL: process.env.DATABASE_URL!, API_HOST: "127.0.0.1", API_PORT: "4413", NODE_ENV: "test", AUTH_MODE: "jwt", JWT_SECRET: e2eJwtSecret, JWT_REQUIRE_MFA: "true", DEPLOYMENT_PROFILE: "pilot", PROCESS_ROLE: "api", BACKGROUND_QUEUE_ENABLED: "false", PAYMENT_PROVIDER_MODE: "mock", OBJECT_STORAGE_DRIVER: "local", AV_SCAN_MODE: "disabled", AUTH_LOCAL_MAIL_ENABLED: "false", LOCAL_OPERATOR_PASSWORD_LOGIN_ENABLED: "false" } },
});
