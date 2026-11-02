import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { cartOperationCorpus } from "./test-fixtures/cart-operation-corpus";
import { replayCartOperationCapture } from "./test-fixtures/cart-operation-capture-replay";
import { readLocalCapture } from "./test-fixtures/read-local-capture";

// Generated-only corpus, not a live server/command acceptance runner.
test("generate byte-verified saved cart compatible-response and expected-refusal examples", async () => {
  if (process.env.MOBILE_SYNTHETIC_CART_OPERATION_CORPUS !== "generate") throw Error("Set MOBILE_SYNTHETIC_CART_OPERATION_CORPUS=generate for synthetic-only cart corpus generation.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks/synthetic-cart-operation-corpus"); mkdirSync(directory, { recursive: true }); const cases = [];
  for (const entry of await cartOperationCorpus()) {
    if (!/^[a-z][a-z0-9-]+$/.test(entry.id)) throw Error("Invalid synthetic cart case name");
    const file = entry.id + ".json", path = resolve(directory, file), bytes = Buffer.from(JSON.stringify(entry.input, null, 2) + "\n"); writeFileSync(path, bytes);
    const report = await replayCartOperationCapture(readLocalCapture(path)); expect(report).toMatchObject(entry.expected);
    expect(report).toMatchObject({ modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, credentialStoreAccessed: false });
    cases.push({ id: entry.id, kind: entry.input.kind, file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), expected: entry.expected, report });
  }
  expect(cases).toHaveLength(49); const compatibleResponses = cases.filter(row => row.report.status === "CONSISTENT_RESPONSE").length; expect(compatibleResponses).toBe(8);
  writeFileSync(resolve(directory, "index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, compatibleResponses, expectedRefusals: cases.length - compatibleResponses, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "SYNTHETIC_CART_SOURCE_RESPONSE_CORPUS_VERIFIED", caseCount: cases.length, compatibleResponses, expectedRefusals: cases.length - compatibleResponses, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0 }));
});
