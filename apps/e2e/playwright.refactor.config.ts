import { defineConfig } from "@playwright/test";
import base from "./playwright.workspaces.config";

// All API traffic is intercepted; the server has no reachable API upstream.
export default defineConfig({
  ...base,
  testMatch: ["integration-refactor.spec.ts", "route-refactor.spec.ts", "identity-refactor.spec.ts"],
  outputDir: "../../output/playwright/refactor-integrations",
});
