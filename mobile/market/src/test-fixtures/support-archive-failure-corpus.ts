import { errorResponseSchema } from "../../../../packages/schemas/src/core-api";
import { supportCommandCaptureKinds } from "./support-command-capture-kernel";
import { supportCommandCaptureExample, type SupportCommandCaptureExample } from "./support-command-capture-example";
import { replaySupportCommandCapture } from "./support-command-capture-replay";
import { archiveChildCaptureKinds } from "./archive-child-capture-kernel";
import { archiveChildCaptureExample, type ArchiveChildCaptureExample } from "./archive-child-capture-example";
import { replayArchiveChildCapture } from "./archive-child-capture-replay";

type Input = SupportCommandCaptureExample | ArchiveChildCaptureExample;
export type SupportArchiveFailure = Readonly<{
  id: string; family: "support" | "archive"; sourceKind: Input["kind"]; failure: string; input: Input;
  expected: Readonly<{ status: "INPUT_INVALID" | "CONSUMER_REJECTED" | "UNSUPPORTED_CONTEXT"; commandCalls?: number; syntheticGetCalls?: number; parentPhase?: "denied"; operationPhase?: "unknown" | "rejected"; unresolved?: boolean }>;
}>;
const commandFailures = ["command-http-401", "command-http-429", "command-http-500", "command-path-drift", "parent-http-403"] as const;
const archiveStatuses = [401, 403, 404, 429, 500] as const;
export const supportArchiveFailureDescriptors = Object.freeze([
  ...supportCommandCaptureKinds.flatMap(sourceKind => commandFailures.map(failure => Object.freeze({ id: `${sourceKind}-${failure}`, family: "support" as const, sourceKind, failure }))),
  ...archiveChildCaptureKinds.flatMap(sourceKind => [...archiveStatuses.map(status => `child-http-${status}`), "child-path-drift"].map(failure => Object.freeze({ id: `${sourceKind}-${failure}`, family: "archive" as const, sourceKind, failure }))),
  Object.freeze({ id: "archive-related-cyclic-source-link", family: "archive" as const, sourceKind: "archive-related" as const, failure: "cyclic-source-link" }),
]);
const clone = <T>(input: T): T => JSON.parse(JSON.stringify(input)) as T;
function httpError(record: { path: string; httpStatus: number; body: unknown }, status: number) {
  record.httpStatus = status; record.body = errorResponseSchema.parse({ statusCode: status, code: "SYNTHETIC_AUXILIARY_ERROR", message: "SYNTHETIC support/archive failure", path: record.path, timestamp: "2026-10-30T01:02:03.000Z" });
}
/** Serialized refusals from existing source producers. Never writes, retries, hashes document bytes or verifies a signature. */
export async function supportArchiveFailureCorpus(): Promise<readonly SupportArchiveFailure[]> {
  const rows: SupportArchiveFailure[] = [];
  for (const sourceKind of supportCommandCaptureKinds) {
    const original = await supportCommandCaptureExample(sourceKind);
    for (const failure of commandFailures) {
      const input = clone(original); let expected: SupportArchiveFailure["expected"];
      if (failure === "command-path-drift") { input.operation.path += "?synthetic-drift=true"; expected = { status: "INPUT_INVALID", commandCalls: 0 }; }
      else if (failure === "parent-http-403") { httpError(input.parent, 403); expected = { status: "CONSUMER_REJECTED", commandCalls: 0, parentPhase: "denied" }; }
      else { const status = failure === "command-http-401" ? 401 : failure === "command-http-429" ? 429 : 500; httpError(input.operation, status); expected = { status: "CONSUMER_REJECTED", commandCalls: 1, operationPhase: status === 401 ? "rejected" : "unknown", unresolved: status !== 401 }; }
      rows.push(Object.freeze({ id: `${sourceKind}-${failure}`, family: "support", sourceKind, failure, input, expected: Object.freeze(expected) }));
    }
  }
  for (const sourceKind of archiveChildCaptureKinds) {
    const original = await archiveChildCaptureExample(sourceKind);
    for (const status of archiveStatuses) {
      const input = clone(original); httpError(input.records[input.records.length - 1]!, status); const failure = `child-http-${status}`;
      rows.push(Object.freeze({ id: `${sourceKind}-${failure}`, family: "archive", sourceKind, failure, input, expected: Object.freeze({ status: "CONSUMER_REJECTED", syntheticGetCalls: input.records.length }) }));
    }
    const input = clone(original); input.records[input.records.length - 1]!.path += "?synthetic-drift=true";
    rows.push(Object.freeze({ id: `${sourceKind}-child-path-drift`, family: "archive", sourceKind, failure: "child-path-drift", input, expected: Object.freeze({ status: "INPUT_INVALID", syntheticGetCalls: input.records.length - 1 }) }));
  }
  const cyclic = clone(await archiveChildCaptureExample("archive-related")); (cyclic.records[0]!.body as { id: string; baseAgreementDocumentId: string | null }).baseAgreementDocumentId = cyclic.expected.documentId;
  rows.push(Object.freeze({ id: "archive-related-cyclic-source-link", family: "archive", sourceKind: "archive-related", failure: "cyclic-source-link", input: cyclic, expected: Object.freeze({ status: "UNSUPPORTED_CONTEXT", syntheticGetCalls: 1 }) }));
  return Object.freeze(rows);
}
export function replaySupportArchiveFailure(family: SupportArchiveFailure["family"], input: unknown) {
  if (family === "support") return replaySupportCommandCapture(input);
  if (family === "archive") return replayArchiveChildCapture(input);
  throw Error("Unsupported synthetic support/archive family");
}
