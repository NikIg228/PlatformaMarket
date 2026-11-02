import { buyerObservationFailureCases, buyerObservationFailureExample, matchesBuyerObservationFailure } from "./test-fixtures/buyer-workflow-observation-failure-corpus";
import { replayBuyerWorkflowObservation } from "./test-fixtures/buyer-workflow-observation-replay";

it.each(buyerObservationFailureCases)("preserves the fixed source refusal boundary for %s", async caseId => {
  const sample = await buyerObservationFailureExample(caseId), before = JSON.stringify(sample.input);
  const report = await replayBuyerWorkflowObservation(sample.input);
  expect(report).toMatchObject(sample.expected);
  expect(matchesBuyerObservationFailure(report, sample.expected)).toBe(true);
  expect(report.status).not.toBe("CONSISTENT_OBSERVATION");
  expect(report.commandCalls).toBeLessThanOrEqual(1);
  expect(report.syntheticCapturedKeyReads).toBeLessThanOrEqual(1);
  expect(JSON.stringify(sample.input)).toBe(before);
  for (const value of [sample.input.scope.organizationId, sample.input.scope.userId, sample.input.expected.orderId, "idempotencyKey", "requestBody", "SYNTHETIC reviewed buyer reason"]) expect(JSON.stringify(report)).not.toContain(value);
});
