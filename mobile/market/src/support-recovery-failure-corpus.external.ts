import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { supportRecoveryFailureCorpus } from "./test-fixtures/support-recovery-failure-corpus";
import { replaySupportCommandRecovery } from "./test-fixtures/support-command-recovery-replay";

test("generate and verify saved synthetic support recovery refusals", async () => {
  if (process.env.MOBILE_SUPPORT_RECOVERY_FAILURE_CORPUS !== "generate") throw Error("Set MOBILE_SUPPORT_RECOVERY_FAILURE_CORPUS=generate for synthetic-only expected refusal generation.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks/synthetic-support-recovery-failure-corpus"); mkdirSync(directory, { recursive: true }); const cases = [];
  for (const entry of await supportRecoveryFailureCorpus()) {
    if (!/^[a-z][a-z0-9-]+$/.test(entry.id)) throw Error("Invalid synthetic support recovery case name");
    const file = entry.id + ".json", path = resolve(directory, file), bytes = Buffer.from(JSON.stringify(entry.input, null, 2) + "\n"); writeFileSync(path, bytes);
    const report = await replaySupportCommandRecovery(readLocalCapture(path)); expect(report).toMatchObject(entry.expected);
    expect(report).toMatchObject({ nativeBindingPerformed: false, nativeKeyProviderAccessed: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, automaticRetryPerformed: false, returnedIdReadPerformed: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
    cases.push({ id: entry.id, sourceCase: entry.sourceCase, failure: entry.failure, file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), expected: entry.expected, report });
  }
  expect(cases).toHaveLength(38); writeFileSync(resolve(directory, "index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, expectedFailures: true, caseCount: cases.length, serverAccepted: false, effectProven: false, automaticRetryPerformed: false, returnedIdReadPerformed: false, networkRequests: 0, mutations: 0, cases }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "SYNTHETIC_SUPPORT_RECOVERY_REFUSALS_VERIFIED", caseCount: cases.length, serverAccepted: false, networkRequests: 0, mutations: 0 }));
});
