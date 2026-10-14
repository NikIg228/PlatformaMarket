import { defineConfig } from "@playwright/test";
import canonical from "./playwright.unified.config";

const api = (Array.isArray(canonical.webServer) ? canonical.webServer : [])[0];
if (!api) throw new Error("Canonical isolated API configuration is required");
// Keep the running developer frontend. Only transport is forwarded; every API
// response comes from the owned JWT API against the canonical disposable DB.
process.env.REQUISITES_TEST_API = "http://127.0.0.1:4115";
export default defineConfig({
  ...canonical, testMatch: "organization-requisites-real.spec.ts",
  outputDir: "../../output/playwright/organization-requisites-real",
  use: { ...canonical.use, trace: "off", screenshot: "off" },
  webServer: { ...api, url: "http://127.0.0.1:4115/api/health/ready", env: { ...api.env, API_PORT: "4115", ACCESS_CONTROL_MODE: "ROLE_BASED" } },
});
