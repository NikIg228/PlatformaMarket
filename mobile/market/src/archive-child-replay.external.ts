import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { archiveChildCaptureKinds, type ArchiveChildCaptureKind } from "./test-fixtures/archive-child-capture-kernel";
import { archiveChildCaptureExample } from "./test-fixtures/archive-child-capture-example";
import { replayArchiveChildCapture } from "./test-fixtures/archive-child-capture-replay";

test("explicit saved archive child metadata through original source readers", async () => {
  const file = process.env.MOBILE_ARCHIVE_CHILD_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_ARCHIVE_CHILD_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_ARCHIVE_CHILD_CAPTURE_KIND ?? "archive-history";
  if (generated && !archiveChildCaptureKinds.includes(selected as ArchiveChildCaptureKind)) throw Error("Unknown synthetic archive child kind.");
  const kinds = file === "synthetic-all" ? archiveChildCaptureKinds : [selected as ArchiveChildCaptureKind], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const kind of kinds) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-archive-child-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await archiveChildCaptureExample(kind), null, 2) + "\n"), name = kind + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replayArchiveChildCapture, resolve(directory, "archive-child-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_METADATA") throw Error("Saved archive child metadata was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", fullSourceFixtureUsed: true, nativeMetadataLimitChanged: false, nativeBindingPerformed: false, serverAccepted: false, originalFileBytesAccessed: false, originalChecksumVerified: false, cryptographicSignatureVerified: false, networkRequests: 0, mutations: 0 });
    if (receipt) cases.push({ kind, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-archive-child-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", nativeMetadataLimitChanged: false, serverAccepted: false, originalFileBytesAccessed: false, originalChecksumVerified: false, cryptographicSignatureVerified: false, networkRequests: 0, mutations: 0, cases }, null, 2) + "\n");
});
