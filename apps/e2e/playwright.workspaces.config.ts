import { defineConfig, devices } from "@playwright/test";
// UI integration with intercepted API responses: never writes to a dev database.
export default defineConfig({
  testDir: "./tests",
  testMatch: ["workspace-rebuild.spec.ts", "supplier-capabilities.spec.ts", "product-refinement.spec.ts", "inventory-editor.spec.ts", "offer-inspector.spec.ts", "settings-profile.spec.ts", "documents-registry.spec.ts"],
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
});
