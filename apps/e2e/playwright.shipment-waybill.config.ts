import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: "./tests", testMatch: "shipment-waybill.spec.ts", workers: 1, retries: 0,
  timeout: 60000, expect: { timeout: 15000 }, reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: process.env.WAYBILL_WEB_URL ?? "http://127.0.0.1:3116",
    serviceWorkers: "block", trace: "retain-on-failure", screenshot: "only-on-failure" } });
