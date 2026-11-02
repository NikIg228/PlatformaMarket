import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { cartOperationCaptureExample } from "./test-fixtures/cart-operation-capture-example";
import { replayCartOperationCapture, type CartCaptureKind } from "./test-fixtures/cart-operation-capture-replay";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";

// Explicit offline entry; excluded from ordinary tests and never imported by the application.
test("explicit saved cart response replay through source validation/reprice/checkout models", async () => {
  const file = process.env.MOBILE_CART_OPERATION_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_CART_OPERATION_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks");
  const generated = file === "synthetic" || file === "synthetic-all";
  const selected = process.env.MOBILE_CART_OPERATION_CAPTURE_KIND ?? "validation";
  if (generated && !["validation", "reprice", "checkout"].includes(selected)) throw Error("Unknown synthetic cart capture kind.");
  const kinds: CartCaptureKind[] = file === "synthetic-all" ? ["validation", "reprice", "checkout"] : [selected as CartCaptureKind];
  const cases = [];
  for (const kind of kinds) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-cart-operation-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await cartOperationCaptureExample(kind), null, 2) + "\n");
      const name = `${kind}.json`, path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
      return input;
    }, replayCartOperationCapture, resolve(directory, "cart-operation-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_RESPONSE") throw Error("Saved cart response was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report.serverAccepted).toBe(false); expect(report.effectProven).toBe(false); expect(report.nativeBindingPerformed).toBe(false);
    expect(report.businessEligibilityVerified).toBe(false); expect(report.productionAuthorizationVerified).toBe(false);
    expect(report.realNetworkRequests).toBe(0); expect(report.realServerMutations).toBe(0); expect(report.credentialStoreAccessed).toBe(false);
    if (receipt) cases.push({ kind, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-cart-operation-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
