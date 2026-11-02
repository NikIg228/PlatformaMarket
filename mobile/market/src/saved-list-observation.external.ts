import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { savedListObservationCases, savedListObservationExample, type SavedListObservationCase } from "./test-fixtures/saved-list-observation-example";
import { replaySavedListObservation } from "./test-fixtures/saved-list-observation-replay";

test("explicit saved-list unknown-result observation through original controller", async () => {
  const file = process.env.MOBILE_SAVED_LIST_OBSERVATION_FILE;
  if (!file) throw Error("Set MOBILE_SAVED_LIST_OBSERVATION_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_SAVED_LIST_OBSERVATION_CASE ?? "list-create-http-500";
  if (generated && !savedListObservationCases.includes(selected as SavedListObservationCase)) throw Error("Unknown synthetic saved-list observation case");
  const ids = file === "synthetic-all" ? savedListObservationCases : [selected as SavedListObservationCase], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const caseId of ids) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-saved-list-observation-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await savedListObservationExample(caseId), null, 2) + "\n"), name = caseId + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replaySavedListObservation, resolve(directory, "saved-list-observation-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_OBSERVATION") throw Error("Saved-list observation was rejected or unsupported. Inspect the redacted report; supplied input was not copied.");
    expect(report).toMatchObject({ initialUnresolved: true, unresolved: true, initialUnknownAttempts: 1, unknownAttempts: 1, sameUnknownRecordRetained: true, sameAttemptInputRetained: true, commandCalls: 1, observationGetCalls: 1, writeReplayPerformed: false, readAcknowledged: false, newAttemptPrepared: false, observedEffectAttributed: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0 });
    if (receipt) cases.push({ caseId, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-saved-list-observation-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, originalAttemptRemainsUnresolved: true, writeReplayPerformed: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
