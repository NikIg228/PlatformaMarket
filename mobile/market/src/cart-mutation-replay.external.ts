import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { cartMutationCaptureExample } from "./test-fixtures/cart-mutation-capture-example";
import { replayCartMutationCapture } from "./test-fixtures/cart-mutation-capture-replay";
import { cartMutationCaptureKinds, type CartMutationCaptureKind } from "./test-fixtures/cart-mutation-capture-kernel";

// Explicit offline initial operation replay; no real command/native authorization or effect proof.
test("explicit saved cart create/recover/quantity/remove response through source models", async () => {
  const file = process.env.MOBILE_CART_MUTATION_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_CART_MUTATION_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_CART_MUTATION_CAPTURE_KIND ?? "quantity";
  if (generated && !cartMutationCaptureKinds.includes(selected as CartMutationCaptureKind)) throw Error("Unknown synthetic cart mutation kind.");
  const kinds = file === "synthetic-all" ? cartMutationCaptureKinds : [selected as CartMutationCaptureKind], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const kind of kinds) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-cart-mutation-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await cartMutationCaptureExample(kind), null, 2) + "\n"), name = kind + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replayCartMutationCapture, resolve(directory, "cart-mutation-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_RESPONSE") throw Error("Saved cart mutation response was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report).toMatchObject({ modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, keyProviderAccessed: false, realNetworkRequests: 0, realServerMutations: 0, credentialStoreAccessed: false });
    if (receipt) cases.push({ kind, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-cart-mutation-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
