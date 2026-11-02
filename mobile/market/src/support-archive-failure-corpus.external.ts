import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { supportArchiveFailureCorpus, replaySupportArchiveFailure } from "./test-fixtures/support-archive-failure-corpus";

test("generate and verify saved synthetic support/archive refusals", async () => {
  if (process.env.MOBILE_SUPPORT_ARCHIVE_FAILURE_CORPUS !== "generate") throw Error("Set MOBILE_SUPPORT_ARCHIVE_FAILURE_CORPUS=generate for synthetic-only expected refusal generation.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks/synthetic-support-archive-failure-corpus"); mkdirSync(directory, { recursive: true }); const cases = [];
  for (const entry of await supportArchiveFailureCorpus()) {
    if (!/^[a-z][a-z0-9-]+$/.test(entry.id)) throw Error("Invalid synthetic support/archive case name");
    const file = entry.id + ".json", path = resolve(directory, file), bytes = Buffer.from(JSON.stringify(entry.input, null, 2) + "\n"); writeFileSync(path, bytes);
    const report = await replaySupportArchiveFailure(entry.family, readLocalCapture(path)); expect(report).toMatchObject(entry.expected); expect(report).toMatchObject({ nativeBindingPerformed: false, productionAuthorizationVerified: false, serverAccepted: false, credentialStoreAccessed: false });
    if ("syntheticGetCalls" in report) { expect(report).toMatchObject({ nativeMetadataLimitChanged: false, originalFileBytesAccessed: false, originalChecksumVerified: false, cryptographicSignatureVerified: false, networkRequests: 0, mutations: 0 }); expect(report).not.toHaveProperty("metadataRows"); }
    else expect(report).toMatchObject({ sourceResponseAccepted: false, nativeKeyProviderAccessed: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0 });
    cases.push({ id: entry.id, family: entry.family, sourceKind: entry.sourceKind, failure: entry.failure, file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), expected: entry.expected, report });
  }
  expect(cases).toHaveLength(35); writeFileSync(resolve(directory, "index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, expectedFailures: true, caseCount: cases.length, serverAccepted: false, nativeBindingPerformed: false, networkRequests: 0, mutations: 0, cases }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "SYNTHETIC_SUPPORT_ARCHIVE_REFUSALS_VERIFIED", caseCount: cases.length, serverAccepted: false, networkRequests: 0, mutations: 0 }));
});
