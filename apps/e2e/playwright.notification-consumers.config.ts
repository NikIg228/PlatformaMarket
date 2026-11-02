import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["status-cards.spec.ts", "settings-profile.spec.ts"],
  grep: /state cards (network|catalog failures|filter retry)|action-toast|source dialog keeps/,
  workers: 1, retries: 0, timeout: 60_000, expect: { timeout: 15_000 }, reporter: "list",
  outputDir: "../../output/playwright/notification-consumers",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
  webServer: [
    { command: "node fixtures/refactor-ssr-server.mjs", url: "http://127.0.0.1:4129/health", reuseExistingServer: false, timeout: 30_000 },
    { command: "npm run start --workspace=@marketplace/web -- --hostname 127.0.0.1", cwd: "../..", url: "http://127.0.0.1:3000", reuseExistingServer: false, timeout: 60_000, env: { INTERNAL_API_URL: "http://127.0.0.1:4129/api" } },
  ],
});
