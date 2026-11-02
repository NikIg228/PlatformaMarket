import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { syntheticReadFailureCorpus } from "./test-fixtures/synthetic-read-failure-corpus";
import { replaySyntheticReadCapture } from "./test-fixtures/synthetic-read-corpus";
import { readLocalCapture } from "./test-fixtures/read-local-capture";

// Explicit synthetic generation. A correct expected rejection never means server acceptance.
test("generate and verify synthetic saved GET failure/partial corpus", async () => {
  if (process.env.MOBILE_SYNTHETIC_READ_FAILURE_CORPUS !== "generate") throw Error("Set MOBILE_SYNTHETIC_READ_FAILURE_CORPUS=generate for synthetic-only failure corpus generation.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks/synthetic-read-failure-corpus"); mkdirSync(directory, { recursive: true }); const cases = [];
  for (const entry of await syntheticReadFailureCorpus()) {
    if (!/^[a-z][a-z0-9-]+$/.test(entry.id)) throw Error("Invalid synthetic case name");
    const file = entry.id + ".json", path = resolve(directory, file), bytes = Buffer.from(JSON.stringify(entry.input, null, 2) + "\n", "utf8"); writeFileSync(path, bytes);
    const report = await replaySyntheticReadCapture(entry.format, readLocalCapture(path)), phase = "consumerPhase" in report ? report.consumerPhase : report.phase;
    expect(report.status).toBe(entry.expected.status); expect(phase).toBe(entry.expected.phase);
    if (entry.expected.summaryIssue !== undefined) expect(report).toHaveProperty("summaryIssue", entry.expected.summaryIssue);
    expect(report).toMatchObject({ serverAccepted: false, productionAuthorizationVerified: false, networkRequests: 0, mutations: 0 });
    cases.push({ id: entry.id, format: entry.format, file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), expected: entry.expected, report });
  }
  expect(cases).toHaveLength(20);
  writeFileSync(resolve(directory, "index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, expectedFailures: true, caseCount: cases.length, serverAccepted: false, networkRequests: 0, mutations: 0, cases }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "SYNTHETIC_EXPECTED_FAILURES_VERIFIED", caseCount: cases.length, serverAccepted: false, networkRequests: 0, mutations: 0 }));
});
