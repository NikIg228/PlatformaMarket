import { defineConfig } from "@playwright/test";
import base from "./playwright.workspaces.config";
export default defineConfig({
  ...base,
  testMatch: ["operator-imports.spec.ts", "admin-rebuild.spec.ts", "admin-query.spec.ts", "support-workspace.spec.ts"],
  grep: /import context|reconciliation context|operator ticket recovery|operator password|operator receives|support list context|notification opens|conversation history|operator toast|operator can download/,
  outputDir: "../../output/playwright/operator-imports",
});
