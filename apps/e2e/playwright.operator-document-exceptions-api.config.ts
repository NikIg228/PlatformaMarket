import { defineConfig } from "@playwright/test";
import base from "./playwright.operator-dashboard-api.config";
export default defineConfig({ ...base, testMatch: "operator-document-exceptions-api.spec.ts", outputDir: "../../output/playwright/operator-document-exceptions-api" });
