import { defineConfig } from "@playwright/test";
import base from "./playwright.operator-projections.config";
export default defineConfig({ ...base, grep: undefined, testMatch: "operator-orders.spec.ts", outputDir: "../../output/playwright/operator-orders" });
