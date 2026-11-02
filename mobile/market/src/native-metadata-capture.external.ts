import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { replayNativeMetadataCapture } from "./test-fixtures/native-metadata-capture-replay";
import { nativeMetadataCaptureExample } from "./test-fixtures/native-metadata-capture-example";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";

// Explicit offline entry; excluded from normal *.test.ts and never imported by the application.
test("explicit offline archive/reference GET capture through existing native metadata-only consumers", async () => {
  const file = process.env.MOBILE_NATIVE_METADATA_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_NATIVE_METADATA_CAPTURE_FILE to an explicit local JSON file or synthetic.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks");
  const report = await writeCaptureReplayReport(async () => {
    if (file !== "synthetic") return readLocalCapture(file);
    const input = await nativeMetadataCaptureExample();
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "synthetic-native-metadata-capture-example.json"), JSON.stringify(input, null, 2) + "\n");
    return input;
  }, replayNativeMetadataCapture, resolve(directory, "native-metadata-capture-replay-report.json"));
  console.log(JSON.stringify(report));
  if (report.status !== "CONSISTENT_READ") throw Error("Saved metadata capture was rejected or limited. Inspect the redacted report; raw input was not copied.");
  expect(report.serverAccepted).toBe(false); expect(report.productionAuthorizationVerified).toBe(false);
  expect(report.networkRequests).toBe(0); expect(report.mutations).toBe(0); expect(report.credentialStoreAccessed).toBe(false);
});
