import { defineConfig } from "@playwright/test";
import workspace from "./playwright.workspaces.config";

/** Focused assignment-dialog regression with intercepted API responses; no database writes. */
export default defineConfig({ ...workspace, testMatch: "assignment-escape.spec.ts", outputDir: "../../output/playwright/assignment-escape" });
