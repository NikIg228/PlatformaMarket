import { defineConfig } from "@playwright/test";
import canonical from "./playwright.unified.config";

export default defineConfig({
  ...canonical,
  testMatch: ["full-access.spec.ts"],
  webServer: (Array.isArray(canonical.webServer) ? canonical.webServer : []).map((server, index) =>
    index === 0 ? { ...server, env: { ...server.env, ACCESS_CONTROL_MODE: "FULL_ACCESS" } } : server),
});
