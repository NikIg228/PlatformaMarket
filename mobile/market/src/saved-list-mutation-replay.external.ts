import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { savedListMutationCaptureExample } from "./test-fixtures/saved-list-mutation-capture-example";
import { savedListCaptureKinds, type SavedListCaptureKind } from "./test-fixtures/saved-list-mutation-capture-kernel";
import { replaySavedListMutationCapture } from "./test-fixtures/saved-list-mutation-capture-replay";

test("explicit saved list create/upsert/remove response through source models", async () => {
  const file = process.env.MOBILE_SAVED_LIST_MUTATION_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_SAVED_LIST_MUTATION_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_SAVED_LIST_MUTATION_CAPTURE_KIND ?? "list-upsert";
  if (generated && !savedListCaptureKinds.includes(selected as SavedListCaptureKind)) throw Error("Unknown synthetic saved-list operation kind.");
  const kinds = file === "synthetic-all" ? savedListCaptureKinds : [selected as SavedListCaptureKind], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const kind of kinds) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-saved-list-mutation-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await savedListMutationCaptureExample(kind), null, 2) + "\n"), name = kind + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replaySavedListMutationCapture, resolve(directory, "saved-list-mutation-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_RESPONSE") throw Error("Saved list operation response was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", serverAccepted: false, nativeBindingPerformed: false, effectProven: false, keyProviderAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
    if (receipt) cases.push({ kind, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-saved-list-mutation-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
