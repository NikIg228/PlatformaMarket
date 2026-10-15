import { defineConfig } from "@playwright/test";
import canonical from "./playwright.unified.config";

const api = (Array.isArray(canonical.webServer) ? canonical.webServer : [])[0];
if (!api) throw new Error("Canonical isolated API configuration is required");
export default defineConfig({
  ...canonical,
  testMatch: "operator-dashboard-api.spec.ts",
  outputDir: "../../output/playwright/operator-dashboard-api",
  use: { ...canonical.use, baseURL: "http://127.0.0.1:4113", trace: "off", screenshot: "off" },
  webServer: { ...api, url: "http://127.0.0.1:4113/api/health/ready", env: { ...api.env, API_PORT: "4113", ACCESS_CONTROL_MODE: "ROLE_BASED" } },
});
