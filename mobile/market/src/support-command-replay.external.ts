import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { supportCommandCaptureKinds, type SupportCommandCaptureKind } from "./test-fixtures/support-command-capture-kernel";
import { supportCommandCaptureExample } from "./test-fixtures/support-command-capture-example";
import { replaySupportCommandCapture } from "./test-fixtures/support-command-capture-replay";

test("explicit saved initial general support response through original source models", async () => {
  const file = process.env.MOBILE_SUPPORT_COMMAND_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_SUPPORT_COMMAND_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_SUPPORT_COMMAND_CAPTURE_KIND ?? "support-create";
  if (generated && !supportCommandCaptureKinds.includes(selected as SupportCommandCaptureKind)) throw Error("Unknown synthetic support command kind");
  const kinds = file === "synthetic-all" ? supportCommandCaptureKinds : [selected as SupportCommandCaptureKind], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const kind of kinds) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-support-command-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await supportCommandCaptureExample(kind), null, 2) + "\n"), name = kind + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replaySupportCommandCapture, resolve(directory, "support-command-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_RESPONSE") throw Error("Saved support response was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0 });
    if (receipt) cases.push({ kind, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-support-command-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
