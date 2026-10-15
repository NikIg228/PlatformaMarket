import { defineConfig } from "@playwright/test";
import workspace from "./playwright.workspaces.config";
export default defineConfig({ ...workspace, testMatch: ["admin-rebuild.spec.ts", "admin-shell.spec.ts", "admin-query.spec.ts", "messages-workspace.spec.ts", "support-workspace.spec.ts"], outputDir: "../../output/playwright/admin-rebuild-ui", use: { ...workspace.use, trace: "off" } });
