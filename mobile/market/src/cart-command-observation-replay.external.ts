import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { cartObservationCases, cartCommandObservationExample, type CartObservationCase } from "./test-fixtures/cart-command-observation-example";
import { replayCartCommandObservation } from "./test-fixtures/cart-command-observation-replay";

test("explicit saved cart CAS observation through original model without replay", async () => {
  const file = process.env.MOBILE_CART_OBSERVATION_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_CART_OBSERVATION_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_CART_OBSERVATION_CASE ?? "quantity-review";
  if (generated && !cartObservationCases.includes(selected as CartObservationCase)) throw Error("Unknown synthetic cart observation case");
  const ids = file === "synthetic-all" ? cartObservationCases : [selected as CartObservationCase], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const caseId of ids) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-cart-observation-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await cartCommandObservationExample(caseId), null, 2) + "\n"), name = caseId + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replayCartCommandObservation, resolve(directory, "cart-observation-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_OBSERVATION") throw Error("Saved cart observation was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report).toMatchObject({ commandCalls: 1, secondCommandAttempts: 0, observedEffectAttributed: false, writeReplayPerformed: false, nativeBindingPerformed: false, serverAccepted: false, effectProven: false, keyProviderAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
    if (receipt) cases.push({ caseId, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-cart-observation-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", observedEffectAttributed: false, writeReplayPerformed: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
