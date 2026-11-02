import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readLocalCapture } from "./test-fixtures/read-local-capture";
import { writeCaptureReplayReport } from "./test-fixtures/write-capture-replay-report";
import { commentMutationCaptureExample } from "./test-fixtures/order-comment-mutation-capture-example";
import { commentMutationCaptureKinds, type CommentMutationCaptureKind } from "./test-fixtures/order-comment-mutation-capture-kernel";
import { replayCommentMutationCapture } from "./test-fixtures/order-comment-mutation-capture-replay";

test("explicit saved initial comment create/edit response through original controller", async () => {
  const file = process.env.MOBILE_COMMENT_MUTATION_CAPTURE_FILE;
  if (!file) throw Error("Set MOBILE_COMMENT_MUTATION_CAPTURE_FILE to a local JSON file, synthetic or synthetic-all.");
  const generated = file === "synthetic" || file === "synthetic-all", selected = process.env.MOBILE_COMMENT_MUTATION_CAPTURE_KIND ?? "comment-create";
  if (generated && !commentMutationCaptureKinds.includes(selected as CommentMutationCaptureKind)) throw Error("Unknown synthetic comment operation kind.");
  const kinds = file === "synthetic-all" ? commentMutationCaptureKinds : [selected as CommentMutationCaptureKind], directory = resolve(__dirname, "../../../.tmp/mobile-session-checks"), cases = [];
  for (const kind of kinds) {
    let receipt: { file: string; bytes: number; sha256: string } | undefined;
    const report = await writeCaptureReplayReport(async () => {
      if (!generated) return readLocalCapture(file);
      const folder = resolve(directory, "synthetic-comment-mutation-captures"); mkdirSync(folder, { recursive: true });
      const bytes = Buffer.from(JSON.stringify(await commentMutationCaptureExample(kind), null, 2) + "\n"), name = kind + ".json", path = resolve(folder, name); writeFileSync(path, bytes);
      const input = readLocalCapture(path); receipt = { file: name, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }; return input;
    }, replayCommentMutationCapture, resolve(directory, "comment-mutation-capture-replay-report.json"));
    console.log(JSON.stringify(report));
    if (report.status !== "CONSISTENT_RESPONSE") throw Error("Saved comment response was rejected or unsupported. Inspect the redacted report; raw input was not copied.");
    expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0 });
    if (receipt) cases.push({ kind, ...receipt, report });
  }
  if (file === "synthetic-all") writeFileSync(resolve(directory, "synthetic-comment-mutation-captures/index.json"), JSON.stringify({ formatVersion: 1, syntheticOnly: true, caseCount: cases.length, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, cases }, null, 2) + "\n");
});
