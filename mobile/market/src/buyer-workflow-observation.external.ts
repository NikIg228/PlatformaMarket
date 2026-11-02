import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { buyerWorkflowObservationCases, buyerWorkflowObservationExample, type BuyerWorkflowObservationCase } from "./test-fixtures/buyer-workflow-observation-example";
import { replayBuyerWorkflowObservation } from "./test-fixtures/buyer-workflow-observation-replay";

test("explicit saved BUYER unknown-result observation through original source controller", async () => {
  const file = process.env.MOBILE_BUYER_WORKFLOW_OBSERVATION_FILE;
  if (!file) throw Error("Set MOBILE_BUYER_WORKFLOW_OBSERVATION_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_BUYER_WORKFLOW_OBSERVATION_CASE ?? "cancel-http-500";
  if (generated && !buyerWorkflowObservationCases.includes(selected as BuyerWorkflowObservationCase)) throw Error("Unknown synthetic BUYER observation case");
  const ids = file === "synthetic-all" ? buyerWorkflowObservationCases : [selected as BuyerWorkflowObservationCase], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const caseId of ids) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-buyer-workflow-observation-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await buyerWorkflowObservationExample(caseId), null, 2) + "\n"), name = caseId + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replayBuyerWorkflowObservation, resolve(directory, "buyer-workflow-observation-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_OBSERVATION") throw Error("Saved BUYER observation was rejected or unsupported. Inspect the redacted report; supplied raw input was not copied.");
    expect(report).toMatchObject({ initialUnresolved: true, unresolved: true, sameAttemptInputRetained: true, originalUUIDRetained: true, retainedPriorRead: false, commandCalls: 1, syntheticCapturedKeyReads: 1, observationGetCalls: 1, writeReplayPerformed: false, automaticRetryPerformed: false, readAcknowledged: false, newAttemptPrepared: false, observedEffectAttributed: false, nativeBindingPerformed: false, nativeKeyProviderAccessed: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0 });
    if (receipt) cases.push({ caseId, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-buyer-workflow-observation-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, originalAttemptRemainsUnresolved: true, oneIndependentOrderRead: true, writeReplayPerformed: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
