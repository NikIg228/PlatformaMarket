import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { buyerObservationFailureCases, buyerObservationFailureExample, matchesBuyerObservationFailure } from "./test-fixtures/buyer-workflow-observation-failure-corpus";
import { replayBuyerWorkflowObservation } from "./test-fixtures/buyer-workflow-observation-replay";

test("explicit synthetic refused BUYER observation corpus", async () => {
  if (process.env.MOBILE_BUYER_OBSERVATION_FAILURE_CORPUS !== "generate") throw Error("Set MOBILE_BUYER_OBSERVATION_FAILURE_CORPUS=generate for the explicit source-only refusal corpus.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks/synthetic-buyer-workflow-observation-failures");
  mkdirSync(directory, { recursive: true });
  const cases = [];
  for (const caseId of buyerObservationFailureCases) {
    const sample = await buyerObservationFailureExample(caseId), file = caseId + ".json";
    const data = Buffer.from(JSON.stringify(sample.input, null, 2) + "\n"), path = resolve(directory, file);
    writeFileSync(path, data);
    const report = await replayBuyerWorkflowObservation(readLocalCapture(path));
    if (!matchesBuyerObservationFailure(report, sample.expected)) throw Error("Synthetic BUYER observation refusal differs from the fixed source expectation: " + caseId);
    cases.push({ caseId, sourceCase: sample.sourceCase, failure: sample.failure, family: "buyer-observation", file, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex"), expected: sample.expected, report });
  }
  writeFileSync(resolve(directory, "index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, expectedFailures: true, caseCount: cases.length, sourceContexts: 10, expectedRefusalIsAPIAcceptance: false, serverAccepted: false, effectProven: false, writeReplayPerformed: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "SYNTHETIC_BUYER_OBSERVATION_FAILURE_CORPUS_GENERATED", cases: cases.length, sourceContexts: 10, expectedRefusalIsAPIAcceptance: false, serverAccepted: false, effectProven: false, writeReplayPerformed: false, realNetworkRequests: 0, realServerMutations: 0 }));
});
