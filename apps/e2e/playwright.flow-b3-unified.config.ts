import { defineConfig } from "@playwright/test";
import base from "./playwright.unified.config";

// API-only legacy assertions retain their explicit test actor headers. The
// canonical operator browser uses a real session-bound JWT, never dev headers.
process.env.FLOW_B3_UNIFIED = "true";
const servers = Array.isArray(base.webServer) ? base.webServer : [];
export default defineConfig({
  ...base,
  testMatch: "flow-b3*.spec.ts",
  webServer: [
    { ...servers[0], env: { ...servers[0].env, AUTH_MODE: "development", PROCESS_ROLE: "all" } },
    servers[1],
  ],
});
