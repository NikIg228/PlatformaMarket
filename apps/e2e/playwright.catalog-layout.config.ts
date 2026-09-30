import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
// This config targets the existing local dev launcher, which persists its own key.
// Match that runtime for synthetic, disposable-DB sessions; never log the key.
const localKey = resolve(__dirname, "../../.tmp/local-runtime/jwt-secret");
if (!process.env.CI && !process.env.JWT_SECRET && existsSync(localKey)) process.env.JWT_SECRET = readFileSync(localKey, "utf8").trim();
export default defineConfig({ testDir: "./tests", testMatch: "catalog-layout.spec.ts", workers: 1, retries: 0, timeout: 90000, expect: { timeout: 15000 }, reporter: "list", use: { ...devices["Desktop Chrome"], trace: "retain-on-failure", screenshot: "only-on-failure" } });
