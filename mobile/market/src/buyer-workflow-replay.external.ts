import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { buyerWorkflowCaptureCases, buyerWorkflowCaptureExample, type BuyerWorkflowCaptureCase } from "./test-fixtures/buyer-workflow-capture-example";
import { replayBuyerWorkflowCapture } from "./test-fixtures/buyer-workflow-capture-replay";

test("explicit saved initial BUYER workflow response through original source reviews", async () => {
  const file = process.env.MOBILE_BUYER_WORKFLOW_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_BUYER_WORKFLOW_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_BUYER_WORKFLOW_CAPTURE_CASE ?? "cancel";
  if (generated && !buyerWorkflowCaptureCases.includes(selected as BuyerWorkflowCaptureCase)) throw Error("Unknown synthetic buyer workflow case.");
  const selectedCases = file === "synthetic-all" ? buyerWorkflowCaptureCases : [selected as BuyerWorkflowCaptureCase], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const caseId of selectedCases) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-buyer-workflow-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await buyerWorkflowCaptureExample(caseId), null, 2) + "\n"), name = caseId + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replayBuyerWorkflowCapture, resolve(directory, "buyer-workflow-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_RESPONSE") throw Error("Saved buyer workflow response was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report).toMatchObject({ modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_REVIEW_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0 });
    if (receipt) cases.push({ caseId, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-buyer-workflow-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_REVIEW_ONLY", serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
