import { errorResponseSchema } from "../../../../packages/schemas/src/core-api";
import { archiveEnvelope } from "./document-archive";
import { coreReadCaptureExample } from "./core-read-capture-example";
import { nativeMetadataCaptureExample } from "./native-metadata-capture-example";
import { conversationCaptureExample } from "./conversation-capture-example";
import type { SyntheticReadCapture } from "./synthetic-read-corpus";

const statuses = [401, 403, 404, 429, 500] as const;
const phaseFor = { 401: "authentication-required", 403: "denied", 404: "unavailable", 429: "retry-limited", 500: "error" } as const;
export type SyntheticReadFailure = Readonly<{
  id: string; format: SyntheticReadCapture["format"]; input: unknown;
  expected: Readonly<{ status: "CONSUMER_REJECTED" | "LIMITED_READ"; phase: string; summaryIssue?: string }>;
}>;
function httpError(record: { path: string; httpStatus: number; body: unknown }, status: typeof statuses[number]) {
  record.httpStatus = status;
  record.body = errorResponseSchema.parse({ ...archiveEnvelope(status).payload, path: record.path });
}

/** Deliberate synthetic failures only; expected client rejection is never API acceptance. */
export async function syntheticReadFailureCorpus(): Promise<readonly SyntheticReadFailure[]> {
  const rows: SyntheticReadFailure[] = [];
  for (const status of statuses) {
    const core = await coreReadCaptureExample("workflow"); httpError(core.records[0]!, status);
    rows.push({ id: `core-workflow-http-${status}`, format: "core", input: core, expected: { status: "CONSUMER_REJECTED", phase: phaseFor[status] } });
    const cities = await nativeMetadataCaptureExample("public-cities"); httpError(cities.records[0]!, status);
    rows.push({ id: `metadata-cities-http-${status}`, format: "metadata", input: cities, expected: { status: "CONSUMER_REJECTED", phase: phaseFor[status] } });
    const conversation = conversationCaptureExample("OFFER"); httpError(conversation.detail, status);
    rows.push({ id: `conversation-offer-http-${status}`, format: "conversation", input: conversation, expected: { status: "CONSUMER_REJECTED", phase: phaseFor[status] } });
  }
  for (const status of [403, 404, 429, 500] as const) {
    const input = await nativeMetadataCaptureExample("document-archive"), summary = input.records.find(record => record.path.endsWith("/summary"))!; httpError(summary, status);
    rows.push({ id: `metadata-summary-http-${status}`, format: "metadata", input, expected: { status: "LIMITED_READ", phase: "ready", summaryIssue: phaseFor[status] } });
  }
  const malformed = await nativeMetadataCaptureExample("document-archive"); malformed.records.find(record => record.path.endsWith("/summary"))!.body = { total: 0 };
  rows.push({ id: "metadata-summary-malformed", format: "metadata", input: malformed, expected: { status: "LIMITED_READ", phase: "ready", summaryIssue: "contract-error" } });
  return Object.freeze(rows.map(row => Object.freeze({ ...row, expected: Object.freeze(row.expected) })));
}
