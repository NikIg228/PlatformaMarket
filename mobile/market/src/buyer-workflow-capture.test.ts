import { jest } from "@jest/globals";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { MarketHttpError } from "./market-transport";
import { cartCommandError, commandCart } from "./test-fixtures/cart-commands";
import { buyerWorkflowCaptureCases, buyerWorkflowCaptureExample, type BuyerWorkflowCaptureCase, type BuyerWorkflowCaptureExample } from "./test-fixtures/buyer-workflow-capture-example";
import { replayBuyerWorkflowCapture, type BuyerWorkflowCaptureReport } from "./test-fixtures/buyer-workflow-capture-replay";

const id = "00000000-0000-4000-8000-000000099802";
async function example(caseId: BuyerWorkflowCaptureCase = "cancel") { return JSON.parse(JSON.stringify(await buyerWorkflowCaptureExample(caseId))) as BuyerWorkflowCaptureExample; }
const workflow = (input: BuyerWorkflowCaptureExample) => input.parent.body as OrderWorkflowResponse;
const request = (input: BuyerWorkflowCaptureExample) => input.operation.requestBody as Record<string, unknown>;
const result = (input: BuyerWorkflowCaptureExample) => input.operation.body as Record<string, unknown>;
function hidden(target: object, field = "body") { const getter = jest.fn(() => { throw Error("SENSITIVE_BUYER_WORKFLOW_CAPTURE"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter; }
function flags(report: BuyerWorkflowCaptureReport) {
  expect(Object.isFrozen(report)).toBe(true); expect(report).toMatchObject({ modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_REVIEW_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  for (const key of ["scope", "expected", "body", "requestBody", "orderId", "version", "statusCode", "claimId", "returnId", "shipmentId", "eventId", "cartId", "reason", "quantity", "amountMinor", "idempotencyKey", "receipt", "error"]) expect(report).not.toHaveProperty(key);
  for (const text of ["SENSITIVE", "00000000-", "SYNTHETIC reviewed", "999999999999"]) expect(JSON.stringify(report)).not.toContain(text);
}
afterEach(() => jest.restoreAllMocks());

it.each(buyerWorkflowCaptureCases)("saved %s uses original source draft/review/model and raw candidate", async caseId => {
  const input = await buyerWorkflowCaptureExample(caseId), before = JSON.stringify(input), report = await replayBuyerWorkflowCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", action: input.action, parentGetCalls: 1, workspaceGetCalls: Number(caseId === "reorder"), commandCalls: 1, operationPhase: "receipt", syntheticCapturedKeyReads: 1, nativeKeyProviderAccessed: false, reviewProvenance: "SIMULATED_SOURCE_REVIEW_ONLY", unresolved: false, effectProven: false, businessEligibilityVerified: false, serverAccepted: false });
  expect(JSON.stringify(input)).toBe(before);
  flags(report);
});
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, kind: "operator-workflow" }])("invalid root remains redacted: %p", async value => { const report = await replayBuyerWorkflowCapture(value); expect(report.status).toBe("INPUT_INVALID"); flags(report); });
it.each(["root", "scope", "expected", "parent", "operation"])("extra secret header in %s is rejected before body", async field => {
  const input = await example(), a = hidden(input.parent), b = hidden(input.operation), target = field === "root" ? input : field === "scope" ? input.scope : field === "expected" ? input.expected : input[field as "parent" | "operation"], secret = hidden(target, "headers");
  expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); for (const getter of [a, b, secret]) expect(getter).not.toHaveBeenCalled();
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid scope %s prevents all callbacks", async field => {
  const input = await example(), body = hidden(input.parent), scope = { ...input.scope, [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE" };
  expect(await replayBuyerWorkflowCapture({ ...input, scope })).toMatchObject({ status: "INPUT_INVALID", parentGetCalls: 0, commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(["DECIDE_RETURN", "REPORT_TRANSFER", "ISSUE_INVOICE", "SEND_MANUAL_REFUND", "unknown"])("unselected action %s cannot inspect parent", async action => {
  const input = await example(), body = hidden(input.parent); expect((await replayBuyerWorkflowCapture({ ...input, action })).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it("a non-reorder action forbids even an unread workspace capture", async () => {
  const input = await example(), extra = hidden(input, "workspace"), body = hidden(input.parent); expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); expect(extra).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it("reorder requires workspace GET headers before reading parent", async () => {
  const input = await example("reorder"), body = hidden(input.parent); delete input.workspace; expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["parent", "operation"] as const)("wrong %s method prevents parent body", async field => {
  const input = await example(), body = hidden(input.parent); input[field].method = field === "parent" ? "POST" : "GET"; expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each([199, 600, "200", 200.5])("invalid status %p prevents body access", async status => {
  const input = await example(), body = hidden(input.parent); Object.assign(input.operation, { httpStatus: status }); expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["orderId", "version", "buyerOrganizationId"])("parent %s binds before private order labels/items", async changed => {
  const input = await example(), parent = workflow(input); if (changed === "orderId") parent.orderId = id; else if (changed === "version") parent.version++; else parent.order.buyerOrganizationId = id;
  const number = hidden(parent.order, "orderNumber"), items = hidden(parent.order, "items"), body = hidden(input.operation), command = hidden(input.operation, "requestBody");
  expect(await replayBuyerWorkflowCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", commandCalls: 0, syntheticCapturedKeyReads: 0 }); for (const getter of [number, items, body, command]) expect(getter).not.toHaveBeenCalled();
});
it("wrong parent path cannot inspect private response", async () => {
  const input = await example(), body = hidden(input.parent); input.parent.path += "?SENSITIVE=true"; expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(buyerWorkflowCaptureCases)("wrong actual %s POST path cannot inspect its receipt", async caseId => {
  const input = await example(caseId), body = hidden(input.operation); input.operation.path += "?SENSITIVE=true"; const report = await replayBuyerWorkflowCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each(buyerWorkflowCaptureCases)("%s extra request secret field stays unread before receipt", async caseId => {
  const input = await example(caseId), secret = hidden(request(input), "headers"), body = hidden(input.operation); expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); expect(secret).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it.each(buyerWorkflowCaptureCases)("%s captured CAS drift is compared to original model's prepared version before receipt", async caseId => {
  const input = await example(caseId); request(input).expectedVersion = input.expected.orderVersion + 1; const body = hidden(input.operation); expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["receive-shipment", "return-goods"] as const)("%s nested unknown field cannot inspect its secret getter or receipt", async caseId => {
  const input = await example(caseId), line = (request(input).items as object[])[0]!, secret = hidden(line, "headers"), body = hidden(input.operation);
  expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); expect(secret).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it.each(["receive-shipment", "return-goods"] as const)("%s multi-line API shape is outside the source single-target draft, without invented API prohibition", async caseId => {
  const input = await example(caseId), lines = request(input).items as object[]; lines.push({ ...lines[0] }); const body = hidden(input.operation);
  expect(await replayBuyerWorkflowCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(["cancel", "return-goods", "open-dispute"] as const)("%s noncanonical captured reason fails exact reviewed wire comparison before receipt", async caseId => {
  const input = await example(caseId); request(input).reason = "  " + request(input).reason + "  "; const body = hidden(input.operation); expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it("a different valid captured key remains a simulated namespace, never effect proof from a keyless receipt DTO", async () => {
  const input = await example(); request(input).idempotencyKey = id; const report = await replayBuyerWorkflowCapture(input); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report);
});
it.each([null, "not-a-uuid", 1])("invalid captured key %p cannot inspect receipt", async value => {
  const input = await example(); request(input).idempotencyKey = value; const body = hidden(input.operation); expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(buyerWorkflowCaptureCases)("%s foreign receipt order remains unknown with no state projection", async caseId => {
  const input = await example(caseId); result(input).orderId = id; const before = JSON.stringify(input), report = await replayBuyerWorkflowCapture(input);
  expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", unresolved: true }); expect(JSON.stringify(input)).toBe(before); flags(report);
});
it.each(buyerWorkflowCaptureCases)("%s receipt below source version floor remains unknown", async caseId => {
  const input = await example(caseId); result(input).version = input.expected.orderVersion; const report = await replayBuyerWorkflowCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", unresolved: true }); flags(report);
});
it.each(buyerWorkflowCaptureCases)("%s command HTTP failures retain source known rejection/unknown classification without automatic read/replay", async caseId => {
  for (const status of [400, 401, 403, 404, 409, 429, 500]) {
    const input = await example(caseId); input.operation.httpStatus = status; input.operation.body = cartCommandError(status).payload; const report = await replayBuyerWorkflowCapture(input);
    expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: status >= 429 ? "unknown" : "rejected", commandCalls: 1, parentGetCalls: 1, workspaceGetCalls: Number(caseId === "reorder"), syntheticCapturedKeyReads: 1 }); flags(report);
  }
});
it.each([401, 403, 404, 429, 500])("parent HTTP%s prevents request contents, keys and command", async status => {
  const input = await example(); input.parent.httpStatus = status; input.parent.body = cartCommandError(status).payload; const command = hidden(input.operation, "requestBody"), body = hidden(input.operation);
  expect(await replayBuyerWorkflowCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(command).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it("reorder workspace method/path is bound before private cart data", async () => {
  const input = await example("reorder"), body = hidden(input.workspace!); input.workspace!.path += "?SENSITIVE=true"; expect((await replayBuyerWorkflowCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it("reorder foreign workspace cart fails before private items and no key/POST is used", async () => {
  const input = await example("reorder"), cart = commandCart(); cart.buyerOrganizationId = id; input.workspace!.body = { current: cart, items: [], nextCursor: null }; const items = hidden(cart, "items"), body = hidden(input.operation);
  expect(await replayBuyerWorkflowCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(items).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it("reorder occupied workspace preserves original guard and does not create a fake empty cart", async () => {
  const input = await example("reorder"), cart = commandCart(); cart.buyerOrganizationId = input.scope.organizationId; const page: WorkspaceCartPage = { current: cart, items: [], nextCursor: null }; input.workspace!.body = page; const body = hidden(input.operation);
  expect(await replayBuyerWorkflowCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(["receive-shipment", "return-goods", "send-return", "receive-refund", "accept-composition", "open-dispute", "return-overpayment"] as const)("%s unsupported source context never reads receipt or issues a key", async caseId => {
  const input = await example(caseId), parent = workflow(input);
  if (caseId === "receive-shipment") delete parent.order.shipments![0]!.items[0]!.resupplyQuantity;
  if (caseId === "return-goods") parent.paymentStatus = parent.order.paymentStatus = "UNPAID";
  if (caseId === "send-return") parent.returns![0]!.status = "REQUESTED";
  if (caseId === "receive-refund") parent.returns![0]!.status = "AGREED";
  if (caseId === "accept-composition") parent.status = parent.order.status = "CONFIRMED";
  if (caseId === "open-dispute") parent.claims[0]!.status = "CONFIRMED";
  if (caseId === "return-overpayment") parent.paymentSummary!.overpaidAmountMinor = "0";
  const body = hidden(input.operation); expect(await replayBuyerWorkflowCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled();
});
it("an existing support pointer does not manufacture a new payment-dispute prohibition or ticket-creation claim", async () => {
  const input = await example("open-dispute"); workflow(input).claims[0]!.supportTicketId = id; const report = await replayBuyerWorkflowCapture(input); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report);
});
it.each(["parent", "workspace", "operation"] as const)("throwing %s capture body cannot forge HTTP denial", async field => {
  const input = await example("reorder"); Object.defineProperty(input[field]!, "body", { get: () => { throw new MarketHttpError(403, { private: "SENSITIVE" }); } }); const report = await replayBuyerWorkflowCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report);
});
it("all source generations/replays avoid global fetch and native entropy", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network")); for (const caseId of buyerWorkflowCaptureCases) { const report = await replayBuyerWorkflowCapture(await buyerWorkflowCaptureExample(caseId)); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report); } expect(fetcher).not.toHaveBeenCalled();
});
