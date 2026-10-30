import { defineConfig } from "@playwright/test";
import base from "./playwright.unified.config";

// Retain canonical isolated-DB/port guards and automatic server cleanup.
// Browser API requests use explicit fixtures; product SSR uses a read-only companion.
process.env.REFACTOR_SSR_FIXTURE = "1";
export default defineConfig({
  ...base,
  // /dev/ui-kit belongs to playwright.refactor-components.config.ts.
  testMatch: ["workspace-rebuild.spec.ts", "messages-workspace.spec.ts", "documents-registry.spec.ts", "route-refactor.spec.ts", "integration-refactor.spec.ts", "identity-refactor.spec.ts", "catalog-reference.spec.ts", "product-detail.spec.ts"],
  outputDir: "../../output/playwright/refactor-runtime",
  webServer: [
    { command: "node fixtures/refactor-ssr-server.mjs", url: "http://127.0.0.1:4129/health", reuseExistingServer: false, timeout: 30_000 },
    ...(Array.isArray(base.webServer) ? base.webServer : []).map((server, index) => index === 1
      ? { ...server, command: "npm run start --workspace=@marketplace/web -- --hostname 127.0.0.1", env: { ...server.env, INTERNAL_API_URL: "http://127.0.0.1:4129/api" } }
      : server),
  ],
});
