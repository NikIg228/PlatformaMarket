import { defineConfig, devices } from "@playwright/test";
import { e2eJwtSecret } from "./fixtures/workspace-session";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== "/dentmarket_audit_20260914" ||
  !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname))
  throw new Error("Checkout acceptance requires the isolated audit database wrapper");
process.env.CHECKOUT_SNAPSHOT_E2E = "true";

export default defineConfig({
  testDir: "./tests", testMatch: "checkout-snapshot.spec.ts", workers: 1, retries: 0,
  timeout: 90000, expect: { timeout: 15000 }, reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    {
      command: "npm run start --workspace=@marketplace/api", cwd: "../..",
      url: "http://127.0.0.1:4012/api/health/ready", reuseExistingServer: false, timeout: 120000,
      env: { DATABASE_URL: databaseUrl, API_HOST: "127.0.0.1", API_PORT: "4012",
        AUTH_MODE: "jwt", JWT_SECRET: e2eJwtSecret, NODE_ENV: "test", DEPLOYMENT_PROFILE: "pilot",
        PROCESS_ROLE: "api", BACKGROUND_QUEUE_ENABLED: "false", OBJECT_STORAGE_DRIVER: "local", AV_SCAN_MODE: "disabled" },
    },
    { command: "npm run start --workspace=@marketplace/web", cwd: "../..", url: "http://127.0.0.1:3000", reuseExistingServer: false, timeout: 60000 },
  ],
});
