import { defineConfig } from "@playwright/test";

const development = process.env.ADMIN_FORMS_DEV === "true";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["admin-forms-drafts.spec.ts"],
  outputDir: "../../output/playwright/admin-forms-drafts",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3308",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node ../../node_modules/next/dist/bin/next ${development ? "dev --turbopack" : "start"} --hostname 127.0.0.1 --port 3308`,
    cwd: "../web",
    url: "http://127.0.0.1:3308/admin",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      INTERNAL_API_URL: "http://127.0.0.1:9/api",
      DEPLOYMENT_PROFILE: "go_live",
      NEXT_PUBLIC_DEPLOYMENT_PROFILE: "go_live",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
