import { defineConfig } from "@playwright/test";
import base from "./playwright.workspaces.config";
export default defineConfig({ ...base, testMatch: ["operator-control.spec.ts"], outputDir: "../../output/playwright/operator-control" });
