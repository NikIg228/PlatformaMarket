import { defineConfig } from "@playwright/test";
import base from "./playwright.ui-contract.config";

// The component sample route is intentionally available only in development.
// Keep this bounded server separate from production-flow verification.
export default defineConfig({
  ...base,
  testMatch: ["ui-contract.spec.ts"],
  grep: /component contract and native interactions/,
  outputDir: "../../output/playwright/refactor-components",
  webServer: {
    command: "npm run dev --workspace=@marketplace/web",
    cwd: "../..",
    url: "http://127.0.0.1:3000/dev/ui-kit",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { INTERNAL_API_URL: "http://127.0.0.1:9/api", NEXT_PUBLIC_DEPLOYMENT_PROFILE: "pilot" },
  },
});
