import { defineConfig } from "@playwright/test";
import canonical from "./playwright.operator-dashboard-api.config";
export default defineConfig({ ...canonical, testMatch: "operator-orders-api.spec.ts", outputDir: "../../output/playwright/operator-orders-api", timeout: 120000 });
