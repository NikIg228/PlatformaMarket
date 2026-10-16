import { defineConfig } from "@playwright/test";
import base from "./playwright.operator-dashboard-api.config";
export default defineConfig({ ...base, testMatch: "operation-queue-api.spec.ts", outputDir: "../../output/playwright/operation-queue-api", timeout: 120000 });
