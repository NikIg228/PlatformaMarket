import { defineConfig } from "@playwright/test";
import canonical from "./playwright.operator-dashboard-api.config";
export default defineConfig({ ...canonical, testMatch: "operator-organizations-api.spec.ts", outputDir: "../../output/playwright/operator-organizations-api" });
