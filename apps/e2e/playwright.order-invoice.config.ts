import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testMatch: "order-invoice.spec.ts", workers: 1, retries: 0,
  timeout: 60000, expect: { timeout: 15000 }, reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: process.env.INVOICE_WEB_URL ?? "http://127.0.0.1:3115", serviceWorkers: "block", trace: "retain-on-failure", screenshot: "only-on-failure" },
});
