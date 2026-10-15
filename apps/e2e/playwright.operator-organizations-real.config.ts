import { defineConfig } from "@playwright/test";
import api from "./playwright.operator-organizations-api.config";
import ui from "./playwright.operator-organizations.config";
export default defineConfig({ ...api, testMatch: "operator-organizations-real.spec.ts", use: { ...ui.use, trace: "off", screenshot: "off" }, outputDir: "../../output/playwright/operator-organizations-real",
  webServer: [...(Array.isArray(api.webServer) ? api.webServer : [api.webServer!]), ...(Array.isArray(ui.webServer) ? ui.webServer : [ui.webServer!])] });
