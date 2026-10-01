import { defineConfig } from "@playwright/test";
import canonical from "./playwright.unified.config";

export default defineConfig({
  ...canonical,
  testMatch: "offer-promotions.spec.ts",
  timeout: 120_000,
  webServer: Array.isArray(canonical.webServer) ? canonical.webServer.map((server, index) => index === 0 ? { ...server, env: { ...server.env, DEPLOYMENT_PROFILE: "go_live" } } : server) : [],
});
