import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { contractBatchCaptureExample } from "./test-fixtures/contract-batch-capture-example";
import { replayContractBatch } from "./test-fixtures/contract-batch-replay";

test("one explicit inline JSON batch through existing source consumers", async () => {
  const file = process.env.MOBILE_CONTRACT_BATCH_FILE;
  if (!file) throw Error("Set MOBILE_CONTRACT_BATCH_FILE to one local JSON file or synthetic.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"); let receipt: { file: string; bytes: number; sha256: string } | undefined;
  const report = await writeCaptureReplayReport(async () => {
    if (file !== "synthetic") return readLocalCapture(file);
    mkdirSync(directory, { recursive: true });
    const name = "synthetic-contract-batch.json", path = resolve(directory, name), bytes = Buffer.from(JSON.stringify(await contractBatchCaptureExample()) + "\n");
    writeFileSync(path, bytes); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return readLocalCapture(path);
  }, replayContractBatch, resolve(directory, "contract-batch-replay-report.json"));
  console.log(JSON.stringify({ status: report.status, caseCount: report.caseCount, checkedCases: report.checkedCases, matchedCases: report.matchedCases, mismatchedCases: report.mismatchedCases, serverAccepted: false, effectProven: false, networkRequests: 0, mutations: 0 }));
  if (report.status !== "EXPECTATIONS_MATCHED") throw Error("Offline batch input or expectations did not match. Inspect the fixed redacted report; supplied input was not copied.");
  expect(report.checkedCases).toBe(report.caseCount); expect(report.mismatchedCases).toBe(0);
  expect(report).toMatchObject({ serverAccepted: false, effectProven: false, nativeBindingPerformed: false, credentialStoreAccessed: false, networkRequests: 0, mutations: 0 });
  if (receipt) writeFileSync(resolve(directory, "synthetic-contract-batch-receipt.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, ...receipt, caseCount: report.caseCount, matchedCases: report.matchedCases, serverAccepted: false, effectProven: false, networkRequests: 0, mutations: 0 }, null, 2) + "\n");
});
