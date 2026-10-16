import { defineConfig } from "@playwright/test";
import base from "./playwright.operator-projections.config";
export default defineConfig({ ...base, grep: undefined, testMatch: ["operation-queue.spec.ts", "assignment-escape.spec.ts", "admin-query.spec.ts", "operator-orders.spec.ts", "admin-shell.spec.ts", "operator-projections.spec.ts"], outputDir: "../../output/playwright/operation-queue" });
