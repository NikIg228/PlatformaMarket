import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { buyerObservationBatchExample } from "./test-fixtures/buyer-observation-batch-example";
import { replayContractBatch } from "./test-fixtures/contract-batch-replay";
import { readLocalCapture } from "./test-fixtures/read-local-capture";

test("explicit separate80-case source BUYER observation batch generation", async () => {
  if (process.env.MOBILE_BUYER_OBSERVATION_BATCH !== "generate") throw Error("Set MOBILE_BUYER_OBSERVATION_BATCH=generate for this separate source-only dataset.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks");
  mkdirSync(directory, { recursive: true });
  const file = "synthetic-buyer-observation-batch.json", path = resolve(directory, file), bytes = Buffer.from(JSON.stringify(await buyerObservationBatchExample()) + "\n");
  writeFileSync(path, bytes);
  const report = await replayContractBatch(readLocalCapture(path));
  writeFileSync(resolve(directory, "buyer-observation-batch-replay-report.json"), JSON.stringify(report, null, 2) + "\n");
  expect(report).toMatchObject({ status: "EXPECTATIONS_MATCHED", caseCount: 80, checkedCases: 80, matchedCases: 80, mismatchedCases: 0, expectedRefusalIsAPIAcceptance: false, serverAccepted: false, effectProven: false, networkRequests: 0, mutations: 0 });
  writeFileSync(resolve(directory, "synthetic-buyer-observation-batch-receipt.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), caseCount: 80, positiveCases: 20, expectedRefusalCases: 60, original447BatchIncluded: false, expectedRefusalIsAPIAcceptance: false, serverAccepted: false, effectProven: false, networkRequests: 0, mutations: 0 }, null, 2) + "\n");
});
