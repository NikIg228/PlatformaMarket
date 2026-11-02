import { buyerWorkflowObservationCases, buyerWorkflowObservationExample } from "./buyer-workflow-observation-example";
import { buyerObservationFailureCases, buyerObservationFailureExample } from "./buyer-workflow-observation-failure-corpus";
import type { ContractBatchInput, ContractBatchExpectation } from "./contract-batch-replay";

/** Separate bounded dataset; never append these80 rows to the existing447-case batch. */
export async function buyerObservationBatchExample(): Promise<ContractBatchInput> {
  const cases: ContractBatchInput["cases"][number][] = [];
  for (const caseId of buyerWorkflowObservationCases) {
    const input = await buyerWorkflowObservationExample(caseId);
    const expected: ContractBatchExpectation = Object.freeze({ status: "CONSISTENT_OBSERVATION", stage: "observation", initialPhase: "unknown", initialUnresolved: true, unresolved: true, retainedPriorRead: false, sameAttemptInputRetained: true, originalUUIDRetained: true, parentGetCalls: 1, workspaceGetCalls: input.action === "REORDER" ? 1 : 0, observationGetCalls: 1, commandCalls: 1, syntheticCapturedKeyReads: 1, automaticRetryPerformed: false, writeReplayPerformed: false, returnedIdReadPerformed: false, observedEffectAttributed: false, readAcknowledged: false, newAttemptPrepared: false });
    cases.push(Object.freeze({ family: "buyer-observation", input, expected }));
  }
  for (const caseId of buyerObservationFailureCases) {
    const sample = await buyerObservationFailureExample(caseId), source = sample.expected;
    const expected: ContractBatchExpectation = Object.freeze({ status: source.status!, stage: source.stage!, initialUnresolved: source.initialUnresolved!, retainedPriorRead: source.retainedPriorRead!, parentGetCalls: source.parentGetCalls!, workspaceGetCalls: source.workspaceGetCalls!, observationGetCalls: source.observationGetCalls!, commandCalls: source.commandCalls!, syntheticCapturedKeyReads: source.syntheticCapturedKeyReads!, ...(source.initialPhase ? { initialPhase: source.initialPhase } : {}), ...(source.readPhase ? { readPhase: source.readPhase } : {}), ...(source.unresolved === undefined ? {} : { unresolved: source.unresolved }), ...(source.sameAttemptInputRetained === undefined ? {} : { sameAttemptInputRetained: source.sameAttemptInputRetained }), ...(source.originalUUIDRetained === undefined ? {} : { originalUUIDRetained: source.originalUUIDRetained }), automaticRetryPerformed: false, writeReplayPerformed: false, returnedIdReadPerformed: false, observedEffectAttributed: false, readAcknowledged: false, newAttemptPrepared: false });
    cases.push(Object.freeze({ family: "buyer-observation", input: sample.input, expected }));
  }
  return Object.freeze({ formatVersion: 1, cases: Object.freeze(cases) });
}
