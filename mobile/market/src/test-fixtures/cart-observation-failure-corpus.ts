import { errorResponseSchema } from "../../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../../packages/schemas/src/workspace-reads";
import { cartObservationCases, cartCommandObservationExample, type CartObservationCase, type CartObservationExample } from "./cart-command-observation-example";
import type { CartObservationReport } from "./cart-command-observation-replay";

const commonFailures = ["initial-http-401", "observation-http-403", "observation-http-500", "observation-malformed", "observation-path-drift"] as const;
type Failure = typeof commonFailures[number] | "foreign-current" | "retained-older-current" | "absent-prepared-line";
export type CartObservationFailure = Readonly<{ id: string; sourceCase: CartObservationCase; failure: Failure; input: CartObservationExample; expected: Readonly<Partial<CartObservationReport> & { status: CartObservationReport["status"] }> }>;
export const cartObservationFailureDescriptors = Object.freeze(cartObservationCases.flatMap(sourceCase => {
  const failures: Failure[] = [...commonFailures];
  if (!sourceCase.endsWith("workspace-none")) failures.push("foreign-current");
  if (!sourceCase.includes("workspace")) failures.push("retained-older-current");
  if (sourceCase.endsWith("prepare")) failures.push("absent-prepared-line");
  return failures.map(failure => Object.freeze({ id: `${sourceCase}-${failure}`, sourceCase, failure }));
}));
function httpError(record: { path: string; httpStatus: number; body: unknown }, status: number) {
  record.httpStatus = status; record.body = errorResponseSchema.parse({ statusCode: status, code: "SYNTHETIC_OBSERVATION_ERROR", message: "SYNTHETIC private observation failure", path: record.path, timestamp: "2026-10-30T01:02:03.000Z" });
}
/** Saved refusals through the existing source consumer; no extra mutation or attribution. */
export async function cartObservationFailureCorpus(): Promise<readonly CartObservationFailure[]> {
  const rows: CartObservationFailure[] = [];
  for (const descriptor of cartObservationFailureDescriptors) {
    const input = JSON.parse(JSON.stringify(await cartCommandObservationExample(descriptor.sourceCase))) as CartObservationExample;
    const expected: { -readonly [K in keyof CartObservationReport]?: CartObservationReport[K] } & { status: CartObservationReport["status"] } = { status: "CONSUMER_REJECTED", parentGetCalls: 1, observationGetCalls: 1, commandCalls: 1, secondCommandAttempts: 0, readPhase: "read-error", retainedPriorRead: false, workspaceObservationAccepted: false, readClosed: false, currentReadVersionPrepared: false };
    switch (descriptor.failure) {
      case "initial-http-401": httpError(input.operation, 401); expected.status = "UNSUPPORTED_CONTEXT"; expected.initialPhase = "rejected"; expected.observationGetCalls = 0; delete expected.readPhase; break;
      case "observation-http-403": httpError(input.observation, 403); break;
      case "observation-http-500": httpError(input.observation, 500); break;
      case "observation-malformed": input.observation.body = {}; break;
      case "observation-path-drift": input.observation.path += "?synthetic-drift=true"; expected.status = "INPUT_INVALID"; expected.observationGetCalls = 0; break;
      case "foreign-current": (input.observation.body as WorkspaceCartPage).current!.buyerOrganizationId = "00000000-0000-4000-8000-000000099062"; break;
      case "retained-older-current": (input.observation.body as WorkspaceCartPage).current!.version = input.expected.cartVersion - 1; expected.retainedPriorRead = true; break;
      case "absent-prepared-line": (input.observation.body as WorkspaceCartPage).current!.items = []; expected.status = "UNSUPPORTED_CONTEXT"; expected.readPhase = "review"; break;
    }
    rows.push(Object.freeze({ ...descriptor, input, expected: Object.freeze(expected) }));
  }
  return Object.freeze(rows);
}
