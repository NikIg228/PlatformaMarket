import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { supportRecoveryCases, supportCommandRecoveryExample, type SupportRecoveryCase } from "./test-fixtures/support-command-recovery-example";
import { replaySupportCommandRecovery } from "./test-fixtures/support-command-recovery-replay";

test("explicit saved support unknown-result recovery through original source models", async () => {
  const file = process.env.MOBILE_SUPPORT_RECOVERY_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_SUPPORT_RECOVERY_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_SUPPORT_RECOVERY_CASE ?? "reply-http-500";
  if (generated && !supportRecoveryCases.includes(selected as SupportRecoveryCase)) throw Error("Unknown synthetic support recovery case");
  const ids = file === "synthetic-all" ? supportRecoveryCases : [selected as SupportRecoveryCase], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const caseId of ids) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-support-recovery-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await supportCommandRecoveryExample(caseId), null, 2) + "\n"), name = caseId + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replaySupportCommandRecovery, resolve(directory, "support-recovery-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_RECOVERY") throw Error("Saved support recovery was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report).toMatchObject({ samePreparedRequest: true, explicitSourceRetryPerformed: true, commandCalls: 2, syntheticCapturedKeyReads: 1, nativeBindingPerformed: false, nativeKeyProviderAccessed: false, serverAccepted: false, effectProven: false, automaticRetryPerformed: false, returnedIdReadPerformed: false, realNetworkRequests: 0, realServerMutations: 0 });
    if (receipt) cases.push({ caseId, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-support-recovery-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", explicitRetryOnly: true, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
