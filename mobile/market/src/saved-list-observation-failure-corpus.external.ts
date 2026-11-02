import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { savedListObservationFailureCases, savedListObservationFailureExample } from "./test-fixtures/saved-list-observation-failure-corpus";
import { replaySavedListObservation } from "./test-fixtures/saved-list-observation-replay";

test("explicit synthetic refused saved-list observation corpus", async () => {
  if (process.env.MOBILE_SAVED_LIST_OBSERVATION_FAILURE_CORPUS !== "generate") throw Error("Set MOBILE_SAVED_LIST_OBSERVATION_FAILURE_CORPUS=generate for this explicit source-only refusal corpus.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks/synthetic-saved-list-observation-failures"); mkdirSync(directory, { recursive: true });
  const cases = [];
  for (const caseId of savedListObservationFailureCases) {
    const sample = await savedListObservationFailureExample(caseId), file = caseId + ".json", path = resolve(directory, file), data = Buffer.from(JSON.stringify(sample.input, null, 2) + "\n"); writeFileSync(path, data);
    const report = await replaySavedListObservation(readLocalCapture(path)); expect(report).toEqual(sample.expected);
    cases.push({ caseId, sourceKind: sample.sourceKind, failure: sample.failure, family: "saved-list-observation", file, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex"), expected: sample.expected, report });
  }
  writeFileSync(resolve(directory, "index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, expectedFailures: true, caseCount: cases.length, sourceContexts: 3, expectedRefusalIsAPIAcceptance: false, serverAccepted: false, effectProven: false, writeReplayPerformed: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
