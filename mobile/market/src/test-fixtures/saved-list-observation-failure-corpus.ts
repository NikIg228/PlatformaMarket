import { errorResponseSchema } from "../../../../packages/schemas/src/core-api";
import { savedListCaptureKinds, type SavedListCaptureKind } from "./saved-list-mutation-capture-kernel";
import { savedListObservationExample, type SavedListObservationExample } from "./saved-list-observation-example";
import type { SavedListObservationReport } from "./saved-list-observation-replay";

export const savedListObservationFailures = ["observation-http-401", "observation-http-403", "observation-http-500", "observation-malformed", "observation-path-drift", "observation-foreign-owner"] as const;
export type SavedListObservationFailure = typeof savedListObservationFailures[number];
export type SavedListObservationFailureCase = `${SavedListCaptureKind}-${SavedListObservationFailure}`;
export const savedListObservationFailureCases: readonly SavedListObservationFailureCase[] = savedListCaptureKinds.flatMap(kind => savedListObservationFailures.map(failure => `${kind}-${failure}` as SavedListObservationFailureCase));
export type SavedListObservationFailureRecord = Readonly<{ caseId: SavedListObservationFailureCase; sourceKind: SavedListCaptureKind; failure: SavedListObservationFailure; input: SavedListObservationExample; expected: SavedListObservationReport }>;

/** Fixed refused transcripts. Auth cleanup is distinct from resolving or rolling back an unknown write. */
export async function savedListObservationFailureExample(caseId: SavedListObservationFailureCase): Promise<SavedListObservationFailureRecord> {
  const selected = savedListCaptureKinds.flatMap(sourceKind => savedListObservationFailures.map(failure => ({ sourceKind, failure, caseId: `${sourceKind}-${failure}` }))).find(row => row.caseId === caseId);
  if (!selected) throw Error("Unknown synthetic saved-list observation failure case");
  const { sourceKind, failure } = selected;
  const input = JSON.parse(JSON.stringify(await savedListObservationExample(`${sourceKind}-http-500`))) as SavedListObservationExample;
  if (failure === "observation-path-drift") input.observation.path += "?other-context=1";
  else if (failure === "observation-malformed") input.observation.body = {};
  else if (failure === "observation-foreign-owner") {
    const rows = input.observation.body as { organizationId: string }[], foreign = "00000000-0000-4000-8000-000000099801";
    if (!rows.length || foreign === input.scope.organizationId) throw Error("Synthetic foreign owner is not foreign");
    rows[0].organizationId = foreign;
  } else {
    const status = failure === "observation-http-401" ? 401 : failure === "observation-http-403" ? 403 : 500;
    input.observation.httpStatus = status;
    input.observation.body = errorResponseSchema.parse({ statusCode: status, code: `SYNTHETIC_READ_${status}`, message: "SYNTHETIC saved list read failure", path: input.observation.path, timestamp: "2026-10-30T01:02:03.000Z" });
  }
  const early = failure === "observation-path-drift", auth = failure === "observation-http-401";
  const expected: SavedListObservationReport = Object.freeze({
    status: early ? "INPUT_INVALID" : "CONSUMER_REJECTED", stage: early ? "capture" : "observation", kind: sourceKind,
    comparisonPhase: !early && sourceKind === "list-upsert" ? "ready" : "not-run", parentPhase: early ? "not-run" : "ready",
    observationPhase: early ? "not-run" : auth ? "authentication-required" : failure === "observation-http-403" ? "denied" : failure === "observation-http-500" ? "error" : "contract-error",
    ...(early ? {} : { initialPhase: "unknown" as const, finalPhase: auth ? "rejected" as const : "read-error" as const }),
    comparisonGetCalls: !early && sourceKind === "list-upsert" ? 1 : 0, parentGetCalls: early ? 0 : 1, observationGetCalls: early ? 0 : 1, commandCalls: early ? 0 : 1,
    initialUnresolved: !early, unresolved: !early && !auth, initialUnknownAttempts: early ? 0 : 1, unknownAttempts: early || auth ? 0 : 1,
    sameUnknownRecordRetained: !early && !auth, sameAttemptInputRetained: !early && !auth,
    responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY",
    nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, keyProviderAccessed: false, credentialStoreAccessed: false,
    automaticRetryPerformed: false, writeReplayPerformed: false, observedEffectAttributed: false, readAcknowledged: false, newAttemptPrepared: false, realNetworkRequests: 0, realServerMutations: 0,
  });
  return Object.freeze({ caseId, sourceKind, failure, input, expected });
}
