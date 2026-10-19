import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";

// Prerequisite: npm run build --workspace=@marketplace/schemas
const require = createRequire(import.meta.url);
const { createPilotSigningOpenApi } = require("../packages/schemas/dist/pilot-signing-openapi.js");
const target = new URL("../actual_docs/domains/pilot-signing.openapi.json", import.meta.url);
const expected = `${JSON.stringify(createPilotSigningOpenApi(), null, 2)}\n`;
if (process.argv.includes("--check")) {
  const actual = await readFile(target, "utf8");
  if (actual.replace(/\r\n/g, "\n") !== expected) throw new Error("Pilot signing OpenAPI artifact is stale");
  console.log("Pilot signing OpenAPI: matches schemas (CONTRACT_ONLY)");
} else {
  await writeFile(target, expected, "utf8");
  console.log("Generated pilot signing OpenAPI (CONTRACT_ONLY)");
}
