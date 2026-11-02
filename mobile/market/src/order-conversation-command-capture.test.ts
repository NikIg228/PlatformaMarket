import { jest } from "@jest/globals";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { MarketHttpError } from "./market-transport";
import { conversationReadError } from "./test-fixtures/order-conversation";
import { orderConversationCaptureCases, type OrderConversationCaptureCase } from "./test-fixtures/order-conversation-command-capture-kernel";
import { orderConversationCommandCaptureExample, type OrderConversationCommandCaptureExample } from "./test-fixtures/order-conversation-command-capture-example";
import { replayOrderConversationCommandCapture, type OrderConversationCommandCaptureReport } from "./test-fixtures/order-conversation-command-capture-replay";

const id = "00000000-0000-4000-8000-000000099901";
async function example(caseId: OrderConversationCaptureCase = "send") { return JSON.parse(JSON.stringify(await orderConversationCommandCaptureExample(caseId))) as OrderConversationCommandCaptureExample; }
const workflow = (input: OrderConversationCommandCaptureExample) => input.parent.body as OrderWorkflowResponse;
const detail = (input: OrderConversationCommandCaptureExample) => input.detail!.body as { conversation: Record<string, unknown>; messages: Record<string, unknown>[]; hasOlder: boolean };
const request = (input: OrderConversationCommandCaptureExample) => input.operation.requestBody as Record<string, unknown>;
const result = (input: OrderConversationCommandCaptureExample) => input.operation.body as Record<string, unknown>;
function hidden(target: object, field = "body") { const getter = jest.fn(() => { throw Error("SENSITIVE_ORDER_CONVERSATION_CAPTURE"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter; }
function flags(report: OrderConversationCommandCaptureReport) {
  expect(Object.isFrozen(report)).toBe(true); expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", reviewProvenance: "SIMULATED_SOURCE_REVIEW_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, independentPostResponseReadPerformed: false, privateFileBytesAccessed: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  for (const key of ["scope", "expected", "body", "requestBody", "orderId", "conversationId", "ticketId", "candidateId", "version", "sequence", "throughSequence", "reason", "idempotencyKey", "receipt", "error"]) expect(report).not.toHaveProperty(key);
  for (const text of ["SENSITIVE", "00000000-", "SYNTHETIC новое", "private conversation"]) expect(JSON.stringify(report)).not.toContain(text);
}
afterEach(() => jest.restoreAllMocks());

it.each(orderConversationCaptureCases)("saved initial %s passes actual source controller/reviews without post-response read", async caseId => {
  const input = await orderConversationCommandCaptureExample(caseId), before = JSON.stringify(input), report = await replayOrderConversationCommandCapture(input), candidate = caseId === "start" || caseId === "escalate";
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", caseId, workflowGetCalls: 1, lookupGetCalls: 1, detailGetCalls: Number(caseId !== "start"), supportGetCalls: Number(caseId === "support-reply"), commandCalls: 1, syntheticCapturedKeyReads: Number(caseId !== "mark-read" && caseId !== "resolve"), sourceResponseAccepted: true, sourceReceived: !candidate, unresolved: candidate, independentPostResponseReadPerformed: false, serverAccepted: false, effectProven: false });
  expect(JSON.stringify(input)).toBe(before);
  flags(report);
});
it.each(["start", "escalate"] as const)("%s valid new candidate stays private/unbound without any returned-ID GET", async caseId => {
  const input = await example(caseId); result(input)[caseId === "start" ? "conversationId" : "ticketId"] = id; const report = await replayOrderConversationCommandCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", operationPhase: "result", sourceReceived: false, unresolved: true, workflowGetCalls: 1, lookupGetCalls: 1, detailGetCalls: Number(caseId !== "start"), supportGetCalls: 0 }); flags(report);
});
it("personal GREATEST read cursor may exceed the old visible conversation latest without changing captured state", async () => {
  const input = await example("mark-read"); result(input).throughSequence = 1000; const before = JSON.stringify(input), report = await replayOrderConversationCommandCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", operationPhase: "receipt", syntheticCapturedKeyReads: 0 }); expect(JSON.stringify(input)).toBe(before); flags(report);
});
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, kind: "operator-conversation-command" }])("invalid root remains redacted: %p", async input => { const report = await replayOrderConversationCommandCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report); });
it.each(["root", "scope", "expected", "parent", "lookup", "detail", "support", "operation"])("extra secret header in %s stops before all responses", async field => {
  const input = await example("support-reply"), a = hidden(input.parent), b = hidden(input.operation), target = field === "root" ? input : field === "scope" ? input.scope : field === "expected" ? input.expected : input[field as "parent" | "lookup" | "detail" | "support" | "operation"]!, secret = hidden(target, "headers");
  expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); for (const getter of [a, b, secret]) expect(getter).not.toHaveBeenCalled();
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid scope %s prevents all GETs and keys", async field => {
  const input = await example(), body = hidden(input.parent), scope = { ...input.scope, [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE" };
  expect(await replayOrderConversationCommandCapture({ ...input, scope })).toMatchObject({ status: "INPUT_INVALID", workflowGetCalls: 0, commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled();
});
it("a non-reply case forbids an unread support response", async () => {
  const input = await example(), support = hidden(input, "support"), parent = hidden(input.parent); expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(support).not.toHaveBeenCalled(); expect(parent).not.toHaveBeenCalled();
});
it.each(["detail", "support"] as const)("required %s headers are checked before parent body", async field => {
  const input = await example("support-reply"), body = hidden(input.parent); delete input[field]; expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["parent", "lookup", "detail", "support", "operation"] as const)("wrong %s method stops before parent body", async field => {
  const input = await example("support-reply"), body = hidden(input.parent); input[field]!.method = field === "operation" ? "GET" : "POST"; expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each([199, 600, "200", 200.5])("invalid status %p stops before parent body", async status => {
  const input = await example(), body = hidden(input.parent); Object.assign(input.operation, { httpStatus: status }); expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["orderId", "version", "buyerOrganizationId"])("parent %s binds before private order number/items", async field => {
  const input = await example(), parent = workflow(input); if (field === "orderId") parent.orderId = id; else if (field === "version") parent.version++; else parent.order.buyerOrganizationId = id;
  const label = hidden(parent.order, "orderNumber"), items = hidden(parent.order, "items"), lookup = hidden(input.lookup), command = hidden(input.operation, "requestBody"), body = hidden(input.operation);
  expect(await replayOrderConversationCommandCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", lookupGetCalls: 0, commandCalls: 0, syntheticCapturedKeyReads: 0 }); for (const getter of [label, items, lookup, command, body]) expect(getter).not.toHaveBeenCalled();
});
it.each(["id", "contextId", "buyerOrganizationId", "supplierOrganizationId"])("thread %s binds before title or private messages", async field => {
  const input = await example(), page = detail(input); page.conversation[field] = id; const title = hidden(page.conversation, "title"), messages = hidden(page, "messages"), body = hidden(input.operation);
  expect(await replayOrderConversationCommandCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", conversationPhase: "contract-error", commandCalls: 0 }); for (const getter of [title, messages, body]) expect(getter).not.toHaveBeenCalled();
});
it("raw message conversation binding precedes private message body", async () => {
  const input = await example(), row = detail(input).messages[0]!; row.conversationId = id; const body = hidden(row); expect(await replayOrderConversationCommandCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", conversationPhase: "contract-error", commandCalls: 0 }); expect(body).not.toHaveBeenCalled();
});
it("missing lookup thread cannot cause a send, detail read or synthetic key", async () => {
  const input = await example(); (input.lookup.body as { conversationId: string | null }).conversationId = null; const detailBody = hidden(input.detail!), body = hidden(input.operation);
  expect(await replayOrderConversationCommandCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", detailGetCalls: 0, commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(detailBody).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it.each(["parent", "lookup", "detail", "support"] as const)("wrong actual %s GET path cannot inspect its response", async field => {
  const input = await example("support-reply"), body = hidden(input[field]!); input[field]!.path += "?SENSITIVE=true"; expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(orderConversationCaptureCases)("wrong actual %s POST path cannot inspect receipt", async caseId => {
  const input = await example(caseId), body = hidden(input.operation); input.operation.path += "?SENSITIVE=true"; expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(orderConversationCaptureCases)("extra %s request secret cannot inspect getter or receipt", async caseId => {
  const input = await example(caseId), secret = hidden(request(input), "headers"), body = hidden(input.operation); expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(secret).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it.each(["start", "send"] as const)("%s text-only input rejects even unread attachment fields while preserving shared hasContent validation", async caseId => {
  const input = await example(caseId), files = hidden(request(input), "attachments"), body = hidden(input.operation); expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(files).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it.each(["start", "send", "support-reply"] as const)("%s empty text still fails original refined schema before receipt", async caseId => {
  const input = await example(caseId); request(input).body = " "; const body = hidden(input.operation); expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["mark-read", "resolve"] as const)("%s remains keyless even if caller adds a secret key getter", async caseId => {
  const input = await example(caseId), key = hidden(request(input), "idempotencyKey"), body = hidden(input.operation); expect(await replayOrderConversationCommandCapture(input)).toMatchObject({ status: "INPUT_INVALID", syntheticCapturedKeyReads: 0 }); expect(key).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it("selected BUYER resolution cannot carry an operator decision field", async () => {
  const input = await example("resolve"), decision = hidden(request(input), "decision"), body = hidden(input.operation); expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(decision).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it("public linked-ticket reply cannot add reopen or internal-message intent", async () => {
  const input = await example("support-reply"), reopen = hidden(request(input), "reopen"), body = hidden(input.operation); expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(reopen).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
  const internal = await example("support-reply"); request(internal).isInternal = true; const receipt = hidden(internal.operation); expect((await replayOrderConversationCommandCapture(internal)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it("public reply attachment input rejects length before inspecting any descriptor", async () => {
  const input = await example("support-reply"), files = [] as unknown[]; files.length = 1; const file = hidden(files, "0"), body = hidden(input.operation); request(input).attachments = files;
  expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(file).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it.each(["start", "send", "escalate", "support-reply"] as const)("noncanonical %s text is compared to exact source-prepared wire before receipt", async caseId => {
  const input = await example(caseId), field = caseId === "escalate" ? "reason" : "body"; request(input)[field] = "  " + request(input)[field] + "  "; const body = hidden(input.operation);
  expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["start-context", "read-sequence", "resolve-version"])("%s drift fails exact actual prepared request before receipt", async changed => {
  const input = await example(changed === "start-context" ? "start" : changed === "read-sequence" ? "mark-read" : "resolve"); if (changed === "start-context") request(input).contextId = id; else if (changed === "read-sequence") request(input).throughSequence = Number(request(input).throughSequence) + 1; else request(input).expectedVersion = Number(request(input).expectedVersion) + 1;
  const body = hidden(input.operation); expect((await replayOrderConversationCommandCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(orderConversationCaptureCases)("%s HTTP failures do not become compatible receipts or trigger follow-up reads", async caseId => {
  for (const status of [400, 401, 403, 404, 409, 429, 500]) {
    const input = await example(caseId); input.operation.httpStatus = status; input.operation.body = conversationReadError(status).payload; const report = await replayOrderConversationCommandCapture(input);
    expect(report).toMatchObject({ status: "CONSUMER_REJECTED", sourceResponseAccepted: false, commandCalls: 1, workflowGetCalls: 1, lookupGetCalls: 1, detailGetCalls: Number(caseId !== "start"), supportGetCalls: Number(caseId === "support-reply") }); flags(report);
  }
});
it.each(["parent", "lookup", "detail", "support"] as const)("%s HTTP failure prevents all command/key access", async field => {
  for (const status of [401, 403, 404, 429, 500]) {
    const input = await example("support-reply"); input[field]!.httpStatus = status; input[field]!.body = conversationReadError(status).payload; const body = hidden(input.operation), command = hidden(input.operation, "requestBody");
    expect(await replayOrderConversationCommandCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled();
  }
});
it.each(orderConversationCaptureCases)("%s incompatible response stays rejected/unknown without candidate leakage", async caseId => {
  const input = await example(caseId), body = result(input); if (caseId === "mark-read") body.throughSequence = Number(request(input).throughSequence) - 1; else if (caseId === "support-reply") body.ticketId = id; else if (caseId === "escalate") body.ticketId = "SENSITIVE"; else body.conversationId = caseId === "start" ? "SENSITIVE" : id;
  const report = await replayOrderConversationCommandCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", sourceResponseAccepted: false, commandCalls: 1 }); flags(report);
});
it.each(["ticketId", "authorId", "isInternal"])("linked reply receipt %s binds before private body", async field => {
  const input = await example("support-reply"), body = result(input); body[field] = field === "isInternal" ? true : id; const text = hidden(body);
  expect(await replayOrderConversationCommandCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "invalid-result", sourceResponseAccepted: false }); expect(text).not.toHaveBeenCalled();
});
it("foreign linked ticket root is rejected before subject/description", async () => {
  const input = await example("support-reply"), body = input.support!.body as Record<string, unknown>; body.organizationId = id; const subject = hidden(body, "subject"), description = hidden(body, "description");
  expect(await replayOrderConversationCommandCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", supportPhase: "contract-error", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(subject).not.toHaveBeenCalled(); expect(description).not.toHaveBeenCalled();
});
it.each(["mark-read", "resolve", "escalate", "support-reply"] as const)("unsupported %s source context never reads receipt or issues key", async caseId => {
  const input = await example(caseId), page = detail(input);
  if (caseId === "mark-read") { page.messages = []; page.hasOlder = false; page.conversation.latestSequence = 0; page.conversation.lastMessage = ""; }
  if (caseId === "resolve") page.conversation.resolved = true;
  if (caseId === "escalate") { page.conversation.supportTicketId = id; page.conversation.supportStatus = "OPEN"; }
  if (caseId === "support-reply") (input.support!.body as Record<string, unknown>).status = "CLOSED";
  const body = hidden(input.operation); expect(await replayOrderConversationCommandCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(["parent", "lookup", "detail", "support", "operation"] as const)("throwing %s body cannot forge a known HTTP denial", async field => {
  const input = await example("support-reply"); Object.defineProperty(input[field]!, "body", { get: () => { throw new MarketHttpError(403, { private: "SENSITIVE" }); } }); const report = await replayOrderConversationCommandCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report);
});
it("all generation/replay cases avoid global fetch and native entropy", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network")); for (const caseId of orderConversationCaptureCases) { const report = await replayOrderConversationCommandCapture(await orderConversationCommandCaptureExample(caseId)); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report); } expect(fetcher).not.toHaveBeenCalled();
});
