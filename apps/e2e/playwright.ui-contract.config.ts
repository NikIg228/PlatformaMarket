import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: ["ui-contract.spec.ts", "public-catalog.spec.ts", "unified-application.spec.ts"],
  // Only read-only public cases from those suites; never their database fixtures.
  grep: /component contract and native interactions|semantic palette and keyboard states|shared theme auth audit|persisted dark preference|visual audit/,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure", screenshot: "only-on-failure", serviceWorkers: "block" },
});
