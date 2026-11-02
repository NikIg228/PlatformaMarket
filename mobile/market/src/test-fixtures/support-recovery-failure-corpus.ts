import { errorResponseSchema } from "../../../../packages/schemas/src/core-api";
import { supportRecoveryCases, supportCommandRecoveryExample, type SupportRecoveryCase, type SupportRecoveryExample } from "./support-command-recovery-example";
import type { SupportRecoveryReport } from "./support-command-recovery-replay";

const commonFailures = ["initial-http-400", "observation-http-403", "observation-path-drift", "replay-key-drift", "replay-http-401", "replay-http-409", "replay-http-500", "replay-malformed"] as const;
type Failure = typeof commonFailures[number] | "foreign-observation" | "retained-older-ticket";
export type SupportRecoveryFailure = Readonly<{ id: string; sourceCase: SupportRecoveryCase; failure: Failure; input: SupportRecoveryExample; expected: Readonly<Partial<SupportRecoveryReport> & { status: SupportRecoveryReport["status"] }> }>;
export const supportRecoveryFailureDescriptors = Object.freeze(supportRecoveryCases.flatMap(sourceCase => {
  const failures: Failure[] = [...commonFailures, "foreign-observation"];
  if (sourceCase.startsWith("reply")) failures.push("retained-older-ticket");
  return failures.map(failure => Object.freeze({ id: `${sourceCase}-${failure}`, sourceCase, failure }));
}));
function httpError(record: { path: string; httpStatus: number; body: unknown }, status: number) {
  record.httpStatus = status; record.body = errorResponseSchema.parse({ statusCode: status, code: "SYNTHETIC_RECOVERY_ERROR", message: "SYNTHETIC private recovery failure", path: record.path, timestamp: "2026-10-30T01:02:03.000Z" });
}
/** Existing source recovery refusals; the prior unknown attempt survives an unsuccessful retry. */
export async function supportRecoveryFailureCorpus(): Promise<readonly SupportRecoveryFailure[]> {
  const rows: SupportRecoveryFailure[] = [];
  for (const descriptor of supportRecoveryFailureDescriptors) {
    const input = JSON.parse(JSON.stringify(await supportCommandRecoveryExample(descriptor.sourceCase))) as SupportRecoveryExample;
    const expected: { -readonly [K in keyof SupportRecoveryReport]?: SupportRecoveryReport[K] } & { status: SupportRecoveryReport["status"] } = { status: "CONSUMER_REJECTED", parentGetCalls: 1, observationGetCalls: 1, commandCalls: 1, syntheticCapturedKeyReads: 1, initialResponseAccepted: false, sourceResponseAccepted: false, unresolved: true, retainedPriorRead: false, samePreparedRequest: false, explicitSourceRetryPerformed: false };
    switch (descriptor.failure) {
      case "initial-http-400": httpError(input.initial, 400); expected.status = "UNSUPPORTED_CONTEXT"; expected.initialPhase = "rejected"; expected.observationGetCalls = 0; expected.unresolved = false; break;
      case "observation-http-403": httpError(input.observation, 403); break;
      case "observation-path-drift": input.observation.path += "?synthetic-drift=true"; expected.status = "INPUT_INVALID"; expected.observationGetCalls = 0; break;
      case "replay-key-drift": (input.replay.requestBody as Record<string, unknown>).idempotencyKey = "00000000-0000-4000-8000-000000099063"; expected.status = "INPUT_INVALID"; expected.explicitSourceRetryPerformed = true; break;
      case "replay-http-401": case "replay-http-409": case "replay-http-500": {
        const status = descriptor.failure === "replay-http-401" ? 401 : descriptor.failure === "replay-http-409" ? 409 : 500; httpError(input.replay, status); expected.retryPhase = "unknown"; expected.commandCalls = 2; expected.samePreparedRequest = true; expected.explicitSourceRetryPerformed = true; break;
      }
      case "replay-malformed": input.replay.body = {}; expected.retryPhase = "invalid-result"; expected.commandCalls = 2; expected.samePreparedRequest = true; expected.explicitSourceRetryPerformed = true; break;
      case "foreign-observation": {
        const row = input.kind === "support-create" ? (input.observation.body as Record<string, unknown>[])[0]! : input.observation.body as Record<string, unknown>; row.organizationId = "00000000-0000-4000-8000-000000099063"; break;
      }
      case "retained-older-ticket": (input.observation.body as Record<string, unknown>).version = input.expected!.ticketVersion - 1; expected.status = "UNSUPPORTED_CONTEXT"; expected.retainedPriorRead = true; break;
    }
    rows.push(Object.freeze({ ...descriptor, input, expected: Object.freeze(expected) }));
  }
  return Object.freeze(rows);
}
