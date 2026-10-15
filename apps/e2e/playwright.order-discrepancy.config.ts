import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: "./tests", testMatch: "order-discrepancy.spec.ts", workers: 1, retries: 0,
  timeout: 90000, expect: { timeout: 15000 }, reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: process.env.DISCREPANCY_WEB_URL ?? "http://127.0.0.1:3000",
    serviceWorkers: "block", trace: "retain-on-failure", screenshot: "only-on-failure" } });
