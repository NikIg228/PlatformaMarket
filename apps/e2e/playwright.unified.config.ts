import { defineConfig } from "@playwright/test";
import base from "./playwright.catalog-layout.config";
export default defineConfig({ ...base, testMatch: "unified-application.spec.ts", use: { ...base.use, baseURL: "http://127.0.0.1:3000" } });
