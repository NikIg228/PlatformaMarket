import { defineConfig } from "@playwright/test";
import base from "./playwright.refactor-components.config";

// Shared notifications use explicit browser fixtures, without API or database.
export default defineConfig({
  ...base,
  testMatch: ["notifications.spec.ts"],
  grep: undefined,
  outputDir: "../../output/playwright/notification-unification",
});
