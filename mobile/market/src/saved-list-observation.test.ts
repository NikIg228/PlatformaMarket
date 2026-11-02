import { jest } from "@jest/globals";
import { errorResponseSchema } from "../../../packages/schemas/src/core-api";
import { savedListObservationCases, savedListObservationExample, type SavedListObservationCase } from "./test-fixtures/saved-list-observation-example";
import { savedListMutationCaptureExample } from "./test-fixtures/saved-list-mutation-capture-example";
import { replaySavedListObservation } from "./test-fixtures/saved-list-observation-replay";

function clone<T>(input: T): T { return JSON.parse(JSON.stringify(input)) as T; }
function errorRecord(input: Awaited<ReturnType<typeof savedListObservationExample>>, status: number) { input.observation.httpStatus = status; input.observation.body = errorResponseSchema.parse({ statusCode: status, code: "SYNTHETIC_READ_ERROR", message: "SYNTHETIC private read failure", path: input.observation.path, timestamp: "2026-10-30T01:02:03.000Z" }); }
function hide(target: object, key: string) { const get = jest.fn(() => { throw Error("SENSITIVE getter"); }); Object.defineProperty(target, key, { enumerable: true, configurable: true, get }); return get; }
afterEach(() => jest.restoreAllMocks());

it.each(savedListObservationCases)("keeps the original unknown record after independent own-list GET: %s", async caseId => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network"));
  const input = clone(await savedListObservationExample(caseId)), before = JSON.stringify(input), report = await replaySavedListObservation(input);
  expect(report).toMatchObject({ status: "CONSISTENT_OBSERVATION", stage: "observation", initialPhase: "unknown", finalPhase: "review", initialUnresolved: true, unresolved: true, initialUnknownAttempts: 1, unknownAttempts: 1, sameUnknownRecordRetained: true, sameAttemptInputRetained: true, parentGetCalls: 1, observationGetCalls: 1, commandCalls: 1, comparisonGetCalls: caseId.startsWith("list-upsert") ? 1 : 0, automaticRetryPerformed: false, writeReplayPerformed: false, observedEffectAttributed: false, readAcknowledged: false, newAttemptPrepared: false, serverAccepted: false, effectProven: false, nativeBindingPerformed: false, realNetworkRequests: 0, realServerMutations: 0 });
  expect(Object.isFrozen(report)).toBe(true); expect(JSON.stringify(input)).toBe(before); expect(fetcher).not.toHaveBeenCalled();
  for (const text of ["00000000-", "SYNTHETIC saved", "requestBody", "idempotencyKey", "createdById", "rawName"]) expect(JSON.stringify(report)).not.toContain(text);
});

it.each(savedListObservationCases)("an empty current list page remains an observation, not proof of the write: %s", async caseId => {
  const input = clone(await savedListObservationExample(caseId)); input.observation.body = [];
  expect(await replaySavedListObservation(input)).toMatchObject({ status: "CONSISTENT_OBSERVATION", observationPhase: "empty", finalPhase: "review", unresolved: true, sameUnknownRecordRetained: true, sameAttemptInputRetained: true, commandCalls: 1, observationGetCalls: 1, observedEffectAttributed: false });
});

it.each(savedListObservationCases)("a failed independent GET keeps recovery truthful: %s", async caseId => {
  const input = clone(await savedListObservationExample(caseId)); errorRecord(input, 500);
  expect(await replaySavedListObservation(input)).toMatchObject({ status: "CONSUMER_REJECTED", stage: "observation", observationPhase: "error", finalPhase: "read-error", initialUnresolved: true, unresolved: true, sameUnknownRecordRetained: true, sameAttemptInputRetained: true, commandCalls: 1, observationGetCalls: 1, writeReplayPerformed: false });
});

it.each(savedListObservationCases)("a drifted observation path stops before reading any initial response: %s", async caseId => {
  const input = clone(await savedListObservationExample(caseId)); input.observation.path += "?other=1"; const body = hide(input.initial, "body");
  expect(await replaySavedListObservation(input)).toMatchObject({ status: "INPUT_INVALID", stage: "capture", commandCalls: 0, parentGetCalls: 0, observationGetCalls: 0 }); expect(body).not.toHaveBeenCalled();
});

it.each(savedListObservationCases)("foreign observation ownership prevents decoding private items: %s", async caseId => {
  const input = clone(await savedListObservationExample(caseId)), rows = input.observation.body as { organizationId: string; items: unknown }[];
  rows[0].organizationId = "00000000-0000-4000-8000-000000099801"; const items = hide(rows[0], "items");
  expect(await replaySavedListObservation(input)).toMatchObject({ status: "CONSUMER_REJECTED", observationPhase: "contract-error", commandCalls: 1, observationGetCalls: 1, writeReplayPerformed: false }); expect(items).not.toHaveBeenCalled();
});

it.each(savedListObservationCases)("malformed saved GET cannot become a successful recovery: %s", async caseId => {
  const input = clone(await savedListObservationExample(caseId)); input.observation.body = {};
  expect(await replaySavedListObservation(input)).toMatchObject({ status: "CONSUMER_REJECTED", observationPhase: "contract-error", commandCalls: 1, observationGetCalls: 1 });
});

it.each(savedListObservationCases.flatMap(caseId => [401, 403, 404, 429].map(status => ({ caseId, status }))))("preserves actual source handling of observation HTTP$status for $caseId", async ({ caseId, status }) => {
  const input = clone(await savedListObservationExample(caseId)); errorRecord(input, status);
  const report = await replaySavedListObservation(input);
  expect(report).toMatchObject({ status: "CONSUMER_REJECTED", stage: "observation", initialPhase: "unknown", initialUnresolved: true, initialUnknownAttempts: 1, commandCalls: 1, observationGetCalls: 1, observationPhase: status === 401 ? "authentication-required" : status === 403 ? "denied" : status === 404 ? "unavailable" : "retry-limited", finalPhase: status === 401 ? "rejected" : "read-error", serverAccepted: false, effectProven: false, observedEffectAttributed: false, writeReplayPerformed: false });
  if (status !== 401) expect(report).toMatchObject({ unresolved: true, unknownAttempts: 1, sameUnknownRecordRetained: true, sameAttemptInputRetained: true });
  // Auth cleanup may erase local state; the historical initial unknown outcome remains explicit.
});

it.each(savedListObservationCases)("a foreign parent prevents reading the saved initial response: %s", async caseId => {
  const input = clone(await savedListObservationExample(caseId)), rows = input.parent.body as { organizationId: string }[];
  rows[0].organizationId = "00000000-0000-4000-8000-000000099801"; const response = hide(input.initial, "body");
  expect(await replaySavedListObservation(input)).toMatchObject({ status: "CONSUMER_REJECTED", stage: "parent", parentPhase: "contract-error", commandCalls: 0, observationGetCalls: 0 }); expect(response).not.toHaveBeenCalled();
});

it.each(savedListObservationCases)("wrong observation method is rejected before a saved command: %s", async caseId => {
  const input = clone(await savedListObservationExample(caseId)); input.observation.method = "POST";
  expect(await replaySavedListObservation(input)).toMatchObject({ status: "INPUT_INVALID", stage: "capture", commandCalls: 0, observationGetCalls: 0 });
});

it.each(savedListObservationCases)("a known initial source result is outside the selected unknown-attempt scenario: %s", async caseId => {
  const input = clone(await savedListObservationExample(caseId)), kind = input.kind, positive = await savedListMutationCaptureExample(kind); input.initial = positive.operation;
  expect(await replaySavedListObservation(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", stage: "initial", initialPhase: "result", initialUnresolved: false, initialUnknownAttempts: 0, observationGetCalls: 0, commandCalls: 1 });
});

it.each([null, {}, [], { formatVersion: 2 }, new Date()])("rejects malformed envelope without executing a command: %p", async input => { expect(await replaySavedListObservation(input)).toMatchObject({ status: "INPUT_INVALID", commandCalls: 0, parentGetCalls: 0, observationGetCalls: 0 }); });
it("unknown private envelope metadata is rejected before accessing its getter", async () => { const input = clone(await savedListObservationExample()); const get = hide(input, "secret"); expect(await replaySavedListObservation(input)).toMatchObject({ status: "INPUT_INVALID", commandCalls: 0 }); expect(get).not.toHaveBeenCalled(); });
it("a throwing observation-body getter stays a fixed capture refusal", async () => { const input = clone(await savedListObservationExample()), get = hide(input.observation, "body"); expect(await replaySavedListObservation(input)).toMatchObject({ status: "INPUT_INVALID", stage: "observation", commandCalls: 1, observationGetCalls: 1 }); expect(get).toHaveBeenCalledTimes(1); });
it("unknown generator selection is rejected", async () => { await expect(savedListObservationExample("unlisted" as SavedListObservationCase)).rejects.toThrow("Unknown synthetic saved-list observation case"); });
