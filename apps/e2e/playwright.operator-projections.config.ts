import { defineConfig } from "@playwright/test";
import path from "node:path";
import base from "./playwright.workspaces.config";
const root = path.resolve(__dirname, "../..");
export default defineConfig({
  ...base,
  testMatch: ["operator-projections.spec.ts", "admin-shell.spec.ts"],
  grep: /dashboard preserves|capabilities distinguish|projection panels|assignment loader|assignment import/,
  outputDir: "../../output/playwright/operator-projections",
  use: { ...base.use, baseURL: "http://127.0.0.1:3103", trace: "off" },
  webServer: {
    command: "node node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port 3103", cwd: root,
    url: "http://127.0.0.1:3103/admin/login", reuseExistingServer: false, timeout: 60000,
    env: { NODE_ENV: "production", DEPLOYMENT_PROFILE: "pilot", INTERNAL_API_URL: "http://127.0.0.1:4113/api" },
  },
});
