import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { syntheticReadCaptureCorpus, replaySyntheticReadCapture } from "./test-fixtures/synthetic-read-corpus";
import { readLocalCapture } from "./test-fixtures/read-local-capture";

// Explicit generation only; excluded from normal suites and never imported by the app.
test("generate synthetic saved GET corpus and verify each persisted JSON through existing consumers", async () => {
  if (process.env.MOBILE_SYNTHETIC_READ_CORPUS !== "generate") throw Error("Set MOBILE_SYNTHETIC_READ_CORPUS=generate for synthetic-only corpus generation.");
  const directory = resolve(__dirname, "../../../.tmp/mobile-session-checks/synthetic-read-capture-corpus"); mkdirSync(directory, { recursive: true });
  const cases = [];
  for (const entry of await syntheticReadCaptureCorpus()) {
    if (!/^[a-z][a-z0-9-]+$/.test(entry.id)) throw Error("Invalid synthetic case name");
    const file = entry.id + ".json", path = resolve(directory, file);
    const bytes = Buffer.from(JSON.stringify(entry.input, null, 2) + "\n", "utf8");
    writeFileSync(path, bytes);
    const report = await replaySyntheticReadCapture(entry.format, readLocalCapture(path));
    expect(report).toMatchObject({ status: "CONSISTENT_READ", serverAccepted: false, productionAuthorizationVerified: false, networkRequests: 0, mutations: 0 });
    cases.push({ id: entry.id, format: entry.format, file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), report });
  }
  expect(cases).toHaveLength(19);
  const index = { formatVersion: 1, syntheticOnly: true, caseCount: cases.length, serverAccepted: false, productionAuthorizationVerified: false, networkRequests: 0, mutations: 0, cases };
  writeFileSync(resolve(directory, "index.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(JSON.stringify({ status: "SYNTHETIC_CORPUS_VERIFIED", caseCount: cases.length, serverAccepted: false, networkRequests: 0, mutations: 0 }));
});
