import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { replaySyntheticCommandFailure, syntheticCommandFailureCorpus } from "./test-fixtures/synthetic-command-failure-corpus";

test("generate and verify serialized synthetic initial command failures", async () => {
  if (process.env.MOBILE_SYNTHETIC_COMMAND_FAILURE_CORPUS !== "generate") throw Error("Set MOBILE_SYNTHETIC_COMMAND_FAILURE_CORPUS=generate for synthetic-only expected refusal generation.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks/synthetic-command-failure-corpus"); mkdirSync(directory, { recursive: true }); const cases = [];
  for (const entry of await syntheticCommandFailureCorpus()) {
    if (!/^[a-z][a-z0-9-]+$/.test(entry.id)) throw Error("Invalid synthetic command failure name");
    const file = entry.id + ".json", path = resolve(directory, file), bytes = Buffer.from(JSON.stringify(entry.input, null, 2) + "\n"); writeFileSync(path, bytes);
    const report = await replaySyntheticCommandFailure(entry.family, readLocalCapture(path));
    expect(report).toMatchObject(entry.expected);
    expect(report).toMatchObject({ nativeBindingPerformed: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
    cases.push({ id: entry.id, family: entry.family, sourceCase: entry.sourceCase, failure: entry.failure, file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), expected: entry.expected, report });
  }
  expect(cases).toHaveLength(165);
  writeFileSync(resolve(directory, "index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, expectedFailures: true, caseCount: cases.length, nativeBindingPerformed: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "SYNTHETIC_EXPECTED_COMMAND_FAILURES_VERIFIED", caseCount: cases.length, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0 }));
});
