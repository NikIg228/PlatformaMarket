import { defineConfig } from "@playwright/test";
import base from "./playwright.unified.config";
export default defineConfig({ ...base, testMatch: ["catalog-performance.spec.ts", "public-catalog.spec.ts"], timeout: 120_000 });
