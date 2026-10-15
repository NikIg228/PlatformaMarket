import { defineConfig } from "@playwright/test";
import api from "./playwright.operator-dashboard-api.config";
import ui from "./playwright.operator-projections.config";
export default defineConfig({
  ...api,
  testMatch: "operator-projections-real.spec.ts",
  use: { ...ui.use, trace: "off", screenshot: "off" },
  outputDir: "../../output/playwright/operator-projections-real",
  webServer: [...(Array.isArray(api.webServer) ? api.webServer : [api.webServer!]), ...(Array.isArray(ui.webServer) ? ui.webServer : [ui.webServer!])],
});
