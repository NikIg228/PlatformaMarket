import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testMatch: ["stock-quantities.spec.ts", "order-discrepancy.spec.ts"],
  grep: /minimum offset purchase|operator integer and fractional|quantity validation explains/,
  workers: 1, retries: 0, timeout: 60000, expect: { timeout: 15000 }, reporter: "list",
  outputDir: "../../output/playwright/stock-quantities-20261104",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3300", serviceWorkers: "block", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: [
    { command: "node fixtures/refactor-ssr-server.mjs", url: "http://127.0.0.1:4129/health", reuseExistingServer: false, timeout: 30000 },
    { command: "npm exec --workspace=@marketplace/web -- next start --hostname 127.0.0.1 --port 3300", url: "http://127.0.0.1:3300", env: { INTERNAL_API_URL: "http://127.0.0.1:4129/api" }, reuseExistingServer: false, timeout: 60000 },
  ],
});
