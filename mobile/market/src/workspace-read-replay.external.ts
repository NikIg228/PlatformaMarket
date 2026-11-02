import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { workspaceReadCaptureExample } from "./test-fixtures/workspace-read-capture-example";
import { replayWorkspaceReadCapture, type WorkspaceCaptureKind } from "./test-fixtures/workspace-read-capture-replay";

// Explicit offline source-fixture entry. No accepted CURRENT schema, grants or native binding.
test("explicit saved buyer workspace GET fixture replay through existing source controller", async () => {
  const file = process.env.MOBILE_WORKSPACE_READ_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_WORKSPACE_READ_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_WORKSPACE_READ_CAPTURE_KIND ?? "saved-lists";
  if (generated && !["saved-lists", "order-comments"].includes(selected)) throw Error("Unknown synthetic workspace capture kind.");
  const kinds: WorkspaceCaptureKind[] = file === "synthetic-all" ? ["saved-lists", "order-comments"] : [selected as WorkspaceCaptureKind], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const kind of kinds) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-workspace-read-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await workspaceReadCaptureExample(kind), null, 2) + "\n"), name = kind + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replayWorkspaceReadCapture, resolve(directory, "workspace-read-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_READ") throw Error("Saved workspace fixture was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", authorProvenanceCaptured: false, businessEligibilityVerified: false, nativeBindingPerformed: false, productionAuthorizationVerified: false, serverAccepted: false, networkRequests: 0, mutations: 0, credentialStoreAccessed: false });
    if (receipt) cases.push({ kind, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-workspace-read-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", serverAccepted: false, networkRequests: 0, mutations: 0, cases }, null, 2) + "\n");
});
