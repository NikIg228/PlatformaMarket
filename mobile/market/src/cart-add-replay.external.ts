import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { cartAddCaptureExample } from "./test-fixtures/cart-add-capture-example";
import { replayCartAddCapture } from "./test-fixtures/cart-add-capture-replay";

test("explicit saved add-offer response through original source models", async () => {
  const file = process.env.MOBILE_CART_ADD_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_CART_ADD_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const variant of file === "synthetic-all" ? ["existing-offer", "new-offer"] : ["existing-offer"]) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-cart-add-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await cartAddCaptureExample(variant === "existing-offer"), null, 2) + "\n"), name = variant + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replayCartAddCapture, resolve(directory, "cart-add-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_RESPONSE") throw Error("Saved add-offer response was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report).toMatchObject({ modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, serverAccepted: false, effectProven: false, cartVersionInferred: false, keyProviderAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
    if (receipt) cases.push({ variant, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-cart-add-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, serverAccepted: false, effectProven: false, cartVersionInferred: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
