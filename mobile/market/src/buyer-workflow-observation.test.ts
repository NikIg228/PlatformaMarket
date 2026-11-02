import { orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { buyerWorkflowObservationCases, buyerWorkflowObservationExample, type BuyerWorkflowObservationCase, type BuyerWorkflowObservationExample } from "./test-fixtures/buyer-workflow-observation-example";
import { replayBuyerWorkflowObservation } from "./test-fixtures/buyer-workflow-observation-replay";
import { buyerWorkflowCaptureExample } from "./test-fixtures/buyer-workflow-capture-example";
import { cartCommandError } from "./test-fixtures/cart-commands";

async function mutableCapture(caseId?: BuyerWorkflowObservationCase): Promise<BuyerWorkflowObservationExample> {
  return JSON.parse(JSON.stringify(await buyerWorkflowObservationExample(caseId))) as BuyerWorkflowObservationExample;
}

it.each(buyerWorkflowObservationCases)("observes the original order after %s without replaying or resolving the held UUID attempt", async caseId => {
  const input = await mutableCapture(caseId), before = JSON.stringify(input);
  const report = await replayBuyerWorkflowObservation(input);
  expect(report).toMatchObject({ status: "CONSISTENT_OBSERVATION", stage: "observation", parentPhase: "ready", observationPhase: "ready", initialPhase: "unknown", readPhase: "review", initialUnresolved: true, unresolved: true, retainedPriorRead: false, sameAttemptInputRetained: true, originalUUIDRetained: true, parentGetCalls: 1, workspaceGetCalls: caseId.startsWith("reorder-") ? 1 : 0, observationGetCalls: 1, commandCalls: 1, syntheticCapturedKeyReads: 1, writeReplayPerformed: false, readAcknowledged: false, newAttemptPrepared: false, observedEffectAttributed: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0 });
  expect(JSON.stringify(input)).toBe(before);
  for (const hidden of [input.scope.organizationId, input.scope.userId, input.expected.orderId, "idempotencyKey", "requestBody", "SYNTHETIC reviewed buyer reason"]) expect(JSON.stringify(report)).not.toContain(hidden);
});

it.each(buyerWorkflowObservationCases)("rejects a retained older order observation after %s while preserving one original command/key", async caseId => {
  const input = await mutableCapture(caseId), body = orderWorkflowResponseSchema.parse(input.observation.body);
  body.version = body.order.version = input.expected.orderVersion - 1; input.observation.body = body;
  const report = await replayBuyerWorkflowObservation(input);
  expect(report).toMatchObject({ status: "UNSUPPORTED_CONTEXT", stage: "observation", initialPhase: "unknown", initialUnresolved: true, unresolved: true, retainedPriorRead: true, sameAttemptInputRetained: true, originalUUIDRetained: true, observationGetCalls: 1, commandCalls: 1, syntheticCapturedKeyReads: 1, writeReplayPerformed: false, effectProven: false });
  expect(report.readPhase).toBe(caseId.startsWith("reorder-") ? "error" : "read-error");
});

it.each(buyerWorkflowObservationCases)("accepts an independently admitted same-version order after %s without requiring an invented version advance", async caseId => {
  const input = await mutableCapture(caseId), body = orderWorkflowResponseSchema.parse(input.observation.body);
  body.version = body.order.version = input.expected.orderVersion; input.observation.body = body;
  expect(await replayBuyerWorkflowObservation(input)).toMatchObject({ status: "CONSISTENT_OBSERVATION", retainedPriorRead: false, initialUnresolved: true, unresolved: true, readPhase: "review", sameAttemptInputRetained: true, originalUUIDRetained: true, commandCalls: 1, syntheticCapturedKeyReads: 1, writeReplayPerformed: false });
});

it.each(["format", "kind", "action", "scope", "parent-method", "initial-method", "observation-path", "observation-status"])("rejects invalid %s headers before any body/key/command", async field => {
  const input = await mutableCapture();
  if (field === "format") Object.assign(input, { formatVersion: 2 });
  if (field === "kind") Object.assign(input, { kind: "buyer-workflow" });
  if (field === "action") Object.assign(input, { action: "UNSUPPORTED_ACTION" });
  if (field === "scope") Object.assign(input, { scope: { ...input.scope, generation: Number.NaN } });
  if (field === "parent-method") input.parent.method = "POST";
  if (field === "initial-method") input.initial.method = "GET";
  if (field === "observation-path") input.observation.path += "?different-context=1";
  if (field === "observation-status") input.observation.httpStatus = 600;
  const hidden = jest.fn(() => { throw new Error("SENSITIVE body must stay unread"); });
  for (const record of [input.parent, input.initial, input.observation]) Object.defineProperty(record, "body", { get: hidden });
  expect(await replayBuyerWorkflowObservation(input)).toMatchObject({ status: "INPUT_INVALID", parentGetCalls: 0, commandCalls: 0, syntheticCapturedKeyReads: 0 });
  expect(hidden).not.toHaveBeenCalled();
});

it.each([undefined, null, [], new Date(0), Symbol("SENSITIVE"), { formatVersion: 1, extra: true }].map(input => ({ input })))("rejects unsupported root value $input without inventing a consumer refusal", async ({ input }) => {
  const report = await replayBuyerWorkflowObservation(input);
  expect(report).toMatchObject({ status: "INPUT_INVALID", stage: "input", parentGetCalls: 0, observationGetCalls: 0, commandCalls: 0, syntheticCapturedKeyReads: 0 });
  expect(JSON.stringify(report)).not.toContain("SENSITIVE");
});

it.each((["cancel-http-500", "reorder-http-500"] as const).flatMap(caseId => ["root-id", "root-version", "order-id", "owner"].map(field => ({ caseId, field }))))("rejects unbound parent $field for $caseId before unrelated content or command request", async ({ caseId, field }) => {
  const input = await mutableCapture(caseId), body = orderWorkflowResponseSchema.parse(input.parent.body);
  const hidden = jest.fn(() => { throw new Error("SENSITIVE unrelated parent content"); }), request = jest.fn(() => { throw new Error("SENSITIVE unbound command"); });
  if (field === "root-id") body.orderId = "00000000-0000-4000-8000-000000099801";
  if (field === "root-version") body.version++;
  if (field === "order-id") body.order.id = "00000000-0000-4000-8000-000000099801";
  if (field === "owner") body.order.buyerOrganizationId = "00000000-0000-4000-8000-000000099801";
  if (field.startsWith("root-")) Object.defineProperty(body, "order", { get: hidden });
  else Object.defineProperty(body.order, "items", { get: hidden });
  input.parent.body = body; Object.defineProperty(input.initial, "requestBody", { get: request });
  expect(await replayBuyerWorkflowObservation(input)).toMatchObject({ status: "CONSUMER_REJECTED", stage: "parent", parentGetCalls: 1, commandCalls: 0, observationGetCalls: 0, syntheticCapturedKeyReads: 0 });
  expect(hidden).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
});

it.each((["cancel-invalid-receipt", "reorder-invalid-receipt"] as const).flatMap(caseId => ["root-id", "order-id", "order-version", "owner"].map(field => ({ caseId, field }))))("rejects unbound observation $field for $caseId before unrelated content", async ({ caseId, field }) => {
  const input = await mutableCapture(caseId), body = orderWorkflowResponseSchema.parse(input.observation.body);
  const hidden = jest.fn(() => { throw new Error("SENSITIVE foreign observation"); });
  if (field === "root-id") body.orderId = "00000000-0000-4000-8000-000000099801";
  if (field === "order-id") body.order.id = "00000000-0000-4000-8000-000000099801";
  if (field === "order-version") body.order.version--;
  if (field === "owner") body.order.buyerOrganizationId = "00000000-0000-4000-8000-000000099801";
  if (field === "root-id") Object.defineProperty(body, "order", { get: hidden });
  else Object.defineProperty(body.order, "items", { get: hidden });
  input.observation.body = body;
  expect(await replayBuyerWorkflowObservation(input)).toMatchObject({ status: "CONSUMER_REJECTED", stage: "observation", initialUnresolved: true, parentGetCalls: 1, commandCalls: 1, observationGetCalls: 1, syntheticCapturedKeyReads: 1, writeReplayPerformed: false, observedEffectAttributed: false });
  expect(hidden).not.toHaveBeenCalled();
});

it.each(["cancel", "reorder"] as const)("keeps an initial known %s receipt outside the unknown-result observation context", async caseId => {
  const input = await mutableCapture(`${caseId}-http-500`), known = await buyerWorkflowCaptureExample(caseId);
  input.initial.httpStatus = 200; input.initial.body = known.operation.body;
  const hidden = jest.fn(() => { throw new Error("SENSITIVE unnecessary observation"); });
  Object.defineProperty(input.observation, "body", { get: hidden });
  expect(await replayBuyerWorkflowObservation(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", stage: "initial", initialPhase: "receipt", initialUnresolved: false, observationGetCalls: 0, commandCalls: 1, syntheticCapturedKeyReads: 1, writeReplayPerformed: false });
  expect(hidden).not.toHaveBeenCalled();
});

it.each((["cancel-http-500", "reorder-http-500"] as const).flatMap(caseId => [400, 409].map(status => ({ caseId, status }))))("keeps initial $status rejection outside unknown-result $caseId observation", async ({ caseId, status }) => {
  const input = await mutableCapture(caseId);
  input.initial.httpStatus = status; input.initial.body = cartCommandError(status).payload;
  const hidden = jest.fn(() => { throw new Error("SENSITIVE unnecessary read"); }); Object.defineProperty(input.observation, "body", { get: hidden });
  expect(await replayBuyerWorkflowObservation(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", initialPhase: "rejected", observationGetCalls: 0, commandCalls: 1, syntheticCapturedKeyReads: 1, effectProven: false });
  expect(hidden).not.toHaveBeenCalled();
});

it.each((["cancel-http-500", "reorder-invalid-receipt"] as const).flatMap(caseId => [401, 403, 404, 429, 500].map(status => ({ caseId, status }))))("keeps independent $status GET for $caseId separate from a successful observation", async ({ caseId, status }) => {
  const input = await mutableCapture(caseId); input.observation.httpStatus = status; input.observation.body = cartCommandError(status).payload;
  const report = await replayBuyerWorkflowObservation(input);
  expect(report).toMatchObject({ status: "CONSUMER_REJECTED", stage: "observation", initialUnresolved: true, commandCalls: 1, observationGetCalls: 1, syntheticCapturedKeyReads: 1, writeReplayPerformed: false, automaticRetryPerformed: false, effectProven: false, observedEffectAttributed: false });
});

it.each((["cancel-http-500", "reorder-http-500"] as const).flatMap(caseId => ["request", "initial", "observation"].map(field => ({ caseId, field }))))("reports a thrown $field capture getter as invalid input for $caseId", async ({ caseId, field }) => {
  const input = await mutableCapture(caseId), hidden = jest.fn(() => { throw new Error("SENSITIVE capture getter"); });
  Object.defineProperty(field === "observation" ? input.observation : input.initial, field === "request" ? "requestBody" : "body", { get: hidden });
  const report = await replayBuyerWorkflowObservation(input);
  expect(report.status).toBe("INPUT_INVALID"); expect(hidden).toHaveBeenCalledTimes(1);
  expect(report.commandCalls).toBe(field === "request" ? 0 : 1); expect(report.syntheticCapturedKeyReads).toBe(field === "request" ? 0 : 1);
  expect(JSON.stringify(report)).not.toContain("SENSITIVE"); expect(report.writeReplayPerformed).toBe(false);
});

it.each(["action", "extra", "version"])("does not silently rewrite a saved %s command body", async field => {
  const input = await mutableCapture(), body = input.initial.requestBody as Record<string, unknown>;
  if (field === "action") body.action = "REORDER";
  if (field === "extra") body.privateExtra = "SENSITIVE";
  if (field === "version") body.expectedVersion = "3";
  const report = await replayBuyerWorkflowObservation(input);
  expect(report).toMatchObject({ status: "INPUT_INVALID", parentGetCalls: 1, commandCalls: 0, observationGetCalls: 0, syntheticCapturedKeyReads: 0 });
  expect(JSON.stringify(report)).not.toContain("SENSITIVE");
});

it.each(["receive-shipment-http-500", "return-goods-http-500"] as const)("keeps multi-line %s intent outside the original single-line review", async caseId => {
  const input = await mutableCapture(caseId), body = input.initial.requestBody as { items: Record<string, unknown>[] }, first = body.items[0]!;
  body.items.push({ ...first, [caseId.startsWith("receive-") ? "shipmentItemId" : "orderItemId"]: "00000000-0000-4000-8000-000000099801" });
  expect(await replayBuyerWorkflowObservation(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", parentGetCalls: 1, commandCalls: 0, observationGetCalls: 0, syntheticCapturedKeyReads: 0 });
});
