import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { orderConversationCaptureCases, type OrderConversationCaptureCase } from "./test-fixtures/order-conversation-command-capture-kernel";
import { orderConversationCommandCaptureExample } from "./test-fixtures/order-conversation-command-capture-example";
import { replayOrderConversationCommandCapture } from "./test-fixtures/order-conversation-command-capture-replay";

test("explicit saved initial ORDER conversation command through original source models", async () => {
  const file = process.env.MOBILE_ORDER_CONVERSATION_COMMAND_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_ORDER_CONVERSATION_COMMAND_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_ORDER_CONVERSATION_COMMAND_CAPTURE_CASE ?? "send";
  if (generated && !orderConversationCaptureCases.includes(selected as OrderConversationCaptureCase)) throw Error("Unknown synthetic order conversation case.");
  const selectedCases = file === "synthetic-all" ? orderConversationCaptureCases : [selected as OrderConversationCaptureCase], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const caseId of selectedCases) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-order-conversation-command-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await orderConversationCommandCaptureExample(caseId), null, 2) + "\n"), name = caseId + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replayOrderConversationCommandCapture, resolve(directory, "order-conversation-command-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_RESPONSE") throw Error("Saved conversation response was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_REVIEW_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, serverAccepted: false, effectProven: false, independentPostResponseReadPerformed: false, privateFileBytesAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
    if (receipt) cases.push({ caseId, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-order-conversation-command-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", serverAccepted: false, effectProven: false, independentPostResponseReadPerformed: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
