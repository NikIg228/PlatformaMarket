import { orderWorkflowResponseSchema } from "../../../../packages/schemas/src/order-workflow";
import { errorResponseSchema } from "../../../../packages/schemas/src/core-api";
import { buyerWorkflowCaptureCases, type BuyerWorkflowCaptureCase } from "./buyer-workflow-capture-example";
import { buyerWorkflowObservationExample, type BuyerWorkflowObservationExample } from "./buyer-workflow-observation-example";
import type { BuyerWorkflowObservationReport } from "./buyer-workflow-observation-replay";

export const buyerObservationFailures = ["observation-http-403", "observation-http-500", "observation-malformed", "observation-path-drift", "observation-foreign-owner", "observation-retained-older"] as const;
export type BuyerObservationFailure = typeof buyerObservationFailures[number];
export type BuyerObservationFailureCase = `${BuyerWorkflowCaptureCase}-${BuyerObservationFailure}`;
export const buyerObservationFailureCases: readonly BuyerObservationFailureCase[] = buyerWorkflowCaptureCases.flatMap(sourceCase => buyerObservationFailures.map(failure => `${sourceCase}-${failure}` as BuyerObservationFailureCase));
export type BuyerObservationFailureRecord = Readonly<{
  caseId: BuyerObservationFailureCase; sourceCase: BuyerWorkflowCaptureCase; failure: BuyerObservationFailure;
  input: BuyerWorkflowObservationExample; expected: Readonly<Partial<BuyerWorkflowObservationReport>>;
}>;
type ExpectedBuilder = { -readonly [Key in keyof BuyerWorkflowObservationReport]?: BuyerWorkflowObservationReport[Key] };

/** Intentionally refused source transcripts; no expected refusal is an API acceptance or rollback proof. */
export async function buyerObservationFailureExample(caseId: BuyerObservationFailureCase): Promise<BuyerObservationFailureRecord> {
  const selected = buyerWorkflowCaptureCases.flatMap(sourceCase => buyerObservationFailures.map(failure => ({ sourceCase, failure, caseId: `${sourceCase}-${failure}` }))).find(row => row.caseId === caseId);
  if (!selected) throw Error("Unknown synthetic BUYER observation failure case");
  const input = JSON.parse(JSON.stringify(await buyerWorkflowObservationExample(`${selected.sourceCase}-http-500`))) as BuyerWorkflowObservationExample;
  const { sourceCase, failure } = selected;
  if (failure === "observation-http-403" || failure === "observation-http-500") {
    const status = failure === "observation-http-403" ? 403 : 500;
    input.observation.httpStatus = status;
    input.observation.body = errorResponseSchema.parse({ statusCode: status, code: `SYNTHETIC_READ_${status}`, message: "SYNTHETIC saved independent read failure", path: input.observation.path, timestamp: "2026-10-30T01:02:03.000Z" });
  } else if (failure === "observation-malformed") input.observation.body = {};
  else if (failure === "observation-path-drift") input.observation.path += "?different-context=1";
  else {
    const body = orderWorkflowResponseSchema.parse(input.observation.body);
    if (failure === "observation-retained-older") body.version = body.order.version = input.expected.orderVersion - 1;
    else {
      const foreign = "00000000-0000-4000-8000-000000099802";
      if (foreign === input.scope.organizationId) throw Error("Synthetic foreign observation owner is not foreign");
      body.order.buyerOrganizationId = foreign;
    }
    input.observation.body = body;
  }
  const beforeInitial = failure === "observation-path-drift", retained = failure === "observation-retained-older";
  const expected: ExpectedBuilder = {
    status: beforeInitial ? "INPUT_INVALID" : retained ? "UNSUPPORTED_CONTEXT" : "CONSUMER_REJECTED",
    stage: beforeInitial ? "capture" : "observation", initialUnresolved: !beforeInitial,
    retainedPriorRead: retained, parentGetCalls: beforeInitial ? 0 : 1,
    workspaceGetCalls: !beforeInitial && sourceCase === "reorder" ? 1 : 0,
    observationGetCalls: beforeInitial ? 0 : 1, commandCalls: beforeInitial ? 0 : 1, syntheticCapturedKeyReads: beforeInitial ? 0 : 1,
    modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_OBSERVATION_ONLY",
    nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false,
    serverAccepted: false, effectProven: false, automaticRetryPerformed: false, writeReplayPerformed: false, returnedIdReadPerformed: false,
    observedEffectAttributed: false, readAcknowledged: false, newAttemptPrepared: false, credentialStoreAccessed: false,
    realNetworkRequests: 0, realServerMutations: 0,
  };
  if (beforeInitial) Object.assign(expected, { unresolved: false, sameAttemptInputRetained: false, originalUUIDRetained: false });
  else expected.initialPhase = "unknown";
  if (retained || failure === "observation-http-500") Object.assign(expected, { unresolved: true, sameAttemptInputRetained: true, originalUUIDRetained: true, readPhase: sourceCase === "reorder" ? "error" : "read-error" });
  // Authority/contract denial may clear the active original model state. Historical initialUnresolved remains explicit.
  return Object.freeze({ caseId, sourceCase, failure, input, expected: Object.freeze(expected) });
}

export function matchesBuyerObservationFailure(report: BuyerWorkflowObservationReport, expected: Readonly<Partial<BuyerWorkflowObservationReport>>): boolean {
  return (Object.keys(expected) as (keyof BuyerWorkflowObservationReport)[]).every(key => Object.is(report[key], expected[key]));
}
