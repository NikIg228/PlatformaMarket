import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { replayCoreReadCapture } from "./test-fixtures/core-read-capture-replay";
import { coreReadCaptureExample } from "./test-fixtures/core-read-capture-example";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";

// Explicit offline entry; excluded from normal *.test.ts and never imported by the application.
test("explicit offline core GET capture through existing native/protected consumers", async () => {
  const file = process.env.MOBILE_CORE_READ_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_CORE_READ_CAPTURE_FILE to an explicit local JSON file or synthetic.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks");
  const report = await writeCaptureReplayReport(async () => {
    if (file !== "synthetic") return readLocalCapture(file);
    const input = await coreReadCaptureExample();
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "synthetic-core-read-capture-example.json"), JSON.stringify(input, null, 2) + "\n");
    return input;
  }, replayCoreReadCapture, resolve(directory, "core-read-capture-replay-report.json"));
  console.log(JSON.stringify(report));
  if (report.status !== "CONSISTENT_READ") throw Error("Saved core capture was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
  expect(report.serverAccepted).toBe(false); expect(report.productionAuthorizationVerified).toBe(false);
  expect(report.networkRequests).toBe(0); expect(report.mutations).toBe(0); expect(report.credentialStoreAccessed).toBe(false);
});
