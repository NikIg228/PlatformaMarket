import { defineConfig } from "@playwright/test";
import base from "./playwright.operator-dashboard-api.config";
const api = base.webServer;
if (!api || Array.isArray(api)) throw Error("Isolated API configuration required");
export default defineConfig({ ...base, testMatch: "operator-trust-api.spec.ts", outputDir: "../../output/playwright/operator-trust-api", webServer: { ...api, env: { ...api.env, DEPLOYMENT_PROFILE: "go_live" } } });
