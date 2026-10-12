import { defineConfig } from "@playwright/test";
import workspace from "./playwright.workspaces.config";
export default defineConfig({ ...workspace, testMatch: "messages-workspace.spec.ts" });
