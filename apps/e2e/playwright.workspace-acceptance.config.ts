import { defineConfig } from "@playwright/test";
import config from "./playwright.checkout-snapshot.config";

export default defineConfig({ ...config, testMatch: ["checkout-snapshot.spec.ts", "workspace-rebuild.spec.ts", "supplier-capabilities.spec.ts"] });
