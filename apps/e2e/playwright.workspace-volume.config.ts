import { defineConfig } from "@playwright/test";
import config from "./playwright.checkout-snapshot.config";

// Keep the burst measurement separate from login-heavy acceptance scenarios;
// both configurations retain the real auth rate limits.
export default defineConfig({ ...config, testMatch: "workspace-list-volume.spec.ts" });
