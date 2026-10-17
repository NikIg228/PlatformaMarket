import { defineConfig } from "@playwright/test";
import base from "./playwright.workspaces.config";
export default defineConfig({ ...base,
  testMatch: ["operator-document-exceptions.spec.ts", "order-discrepancy.spec.ts", "operator-orders.spec.ts"],
  grep: /document exception|public operator recommendation|order registry|analytics and operational queue|supplier counterproposal/,
  outputDir: "../../output/playwright/operator-document-exceptions",
});
