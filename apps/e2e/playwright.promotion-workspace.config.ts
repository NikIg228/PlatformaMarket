import { defineConfig } from "@playwright/test";
import canonical from "./playwright.unified.config";

if (process.env.DEPLOYMENT_PROFILE !== "go_live") throw new Error("Promotion workspace checks require a go_live build and DEPLOYMENT_PROFILE=go_live");

export default defineConfig({
  ...canonical,
  testMatch: "promotion-workspace.spec.ts",
  webServer: Array.isArray(canonical.webServer) ? canonical.webServer.map((server, index) =>
    index === 0 ? { ...server, env: { ...server.env, DEPLOYMENT_PROFILE: "go_live" } } : server) : [],
});
