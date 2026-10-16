import { defineConfig } from "@playwright/test";
import api from "./playwright.operator-orders-api.config";
import ui from "./playwright.operator-orders.config";
export default defineConfig({ ...ui, testMatch: "operator-orders-real.spec.ts", outputDir: "../../output/playwright/operator-orders-real", webServer: [...(Array.isArray(api.webServer) ? api.webServer : [api.webServer!]), ...(Array.isArray(ui.webServer) ? ui.webServer : [ui.webServer!])] });
