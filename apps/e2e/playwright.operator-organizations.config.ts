import { defineConfig } from "@playwright/test";
import base from "./playwright.operator-projections.config";
export default defineConfig({ ...base, testMatch: ["operator-organizations.spec.ts", "operator-projections.spec.ts"], grep: /organization registry|organization detail|organization navigation|organization visuals|dashboard preserves|capabilities distinguish/, outputDir: "../../output/playwright/operator-organizations" });
