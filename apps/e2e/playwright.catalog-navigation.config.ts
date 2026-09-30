import { defineConfig } from "@playwright/test";
import base from "./playwright.catalog-layout.config";
export default defineConfig({ ...base, testMatch: "catalog-navigation.spec.ts" });
