import { defineConfig } from "@playwright/test";
import workspace from "./playwright.workspaces.config";
export default defineConfig({ ...workspace, testMatch: "support-workspace.spec.ts" });
