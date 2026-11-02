import { jest } from "@jest/globals";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { MarketHttpError } from "./market-transport";
import { commentCreateError } from "./test-fixtures/order-comment-create-command";
import { commentMutationCaptureExample, type CommentMutationCaptureExample } from "./test-fixtures/order-comment-mutation-capture-example";
import { commentMutationCaptureKinds } from "./test-fixtures/order-comment-mutation-capture-kernel";
import { replayCommentMutationCapture, type CommentMutationCaptureReport } from "./test-fixtures/order-comment-mutation-capture-replay";

const id = "00000000-0000-4000-8000-000000099701";
async function example(kind: CommentMutationCaptureExample["kind"] = "comment-edit") { return JSON.parse(JSON.stringify(await commentMutationCaptureExample(kind))) as CommentMutationCaptureExample; }
const workflow = (input: CommentMutationCaptureExample) => input.parent.body as OrderWorkflowResponse;
const rows = (input: CommentMutationCaptureExample) => input.comments.body as Record<string, unknown>[];
const result = (input: CommentMutationCaptureExample) => input.operation.body as Record<string, unknown>;
function hidden(target: object, field = "body") { const getter = jest.fn(() => { throw Error("SENSITIVE_COMMENT_CAPTURE"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter; }
function flags(report: CommentMutationCaptureReport) {
  expect(Object.isFrozen(report)).toBe(true); expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, nativeKeyProviderAccessed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  for (const key of ["scope", "expected", "body", "requestBody", "orderId", "commentId", "commentVersion", "authorUserId", "authorOrganizationId", "idempotencyKey", "version", "receipt", "result", "error"]) expect(report).not.toHaveProperty(key);
  for (const text of ["SENSITIVE", "00000000-", "SYNTHETIC-reviewed-comment"]) expect(JSON.stringify(report)).not.toContain(text);
}
afterEach(() => jest.restoreAllMocks());

it.each(commentMutationCaptureKinds)("saved %s uses original controller-issued author source and command model", async kind => {
  const input = await commentMutationCaptureExample(kind), before = JSON.stringify(input), report = await replayCommentMutationCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", kind, parentGetCalls: 1, commentsGetCalls: 1, commandCalls: 1, operationPhase: kind === "comment-create" ? "receipt" : "result", syntheticCapturedKeyReads: Number(kind === "comment-create"), nativeKeyProviderAccessed: false, receiptBodyMatchesReviewed: true, unresolved: false, effectProven: false, serverAccepted: false });
  expect(JSON.stringify(input)).toBe(before);
  flags(report);
});
it.each(commentMutationCaptureKinds)("%s advanced receipt with different text remains compatible and explicit, without optimistic rewrite", async kind => {
  const input = await example(kind); result(input).body = "SENSITIVE later edited receipt text"; result(input).version = 99;
  const before = JSON.stringify(input), report = await replayCommentMutationCapture(input); expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", receiptBodyMatchesReviewed: false, effectProven: false }); expect(JSON.stringify(input)).toBe(before); flags(report);
});
it("create accepts an empty comment window without requiring an existing author row", async () => {
  const input = await example("comment-create"); input.comments.body = []; const report = await replayCommentMutationCapture(input); expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", commentsPhase: "empty", syntheticCapturedKeyReads: 1 }); flags(report);
});
it("create readonly read never inspects optional author/key/canEdit metadata", async () => {
  const input = await example("comment-create"), getters = rows(input).flatMap(row => [hidden(row, "authorUserId"), hidden(row, "idempotencyKey"), hidden(row, "canEdit")]);
  expect((await replayCommentMutationCapture(input)).status).toBe("CONSISTENT_RESPONSE"); for (const getter of getters) expect(getter).not.toHaveBeenCalled();
});
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, kind: "comment-delete" }])("invalid root remains redacted: %p", async input => { const report = await replayCommentMutationCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report); });
it.each(["root", "scope", "expected", "parent", "comments", "operation"])("extra secret header in %s is rejected before any response", async field => {
  const input = await example(), a = hidden(input.parent), b = hidden(input.comments), c = hidden(input.operation), target = field === "root" ? input : field === "scope" ? input.scope : field === "expected" ? input.expected : input[field as "parent" | "comments" | "operation"], secret = hidden(target, "headers");
  expect((await replayCommentMutationCapture(input)).status).toBe("INPUT_INVALID"); for (const getter of [a, b, c, secret]) expect(getter).not.toHaveBeenCalled();
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid scope %s prevents all callbacks", async field => {
  const input = await example(), body = hidden(input.parent), scope = { ...input.scope, [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE" };
  expect(await replayCommentMutationCapture({ ...input, scope })).toMatchObject({ status: "INPUT_INVALID", parentGetCalls: 0, commentsGetCalls: 0, commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(["orderId", "orderVersion", "commentId", "commentVersion"] as const)("invalid expected %s prevents parent inspection", async field => {
  const input = await example(), body = hidden(input.parent); Object.assign(input.expected, { [field]: field === "orderVersion" ? 0.5 : field === "commentVersion" ? 0 : "SENSITIVE" }); expect((await replayCommentMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it("create forbids caller comment selectors without reading their getters", async () => {
  const input = await example("comment-create"), selector = hidden(input.expected, "commentId"), body = hidden(input.parent); expect((await replayCommentMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(selector).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it.each(["parent", "comments", "operation"] as const)("wrong %s method stops before parent body", async field => {
  const input = await example(), body = hidden(input.parent); input[field].method = field === "operation" ? "POST" : "PATCH"; expect((await replayCommentMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each([199, 600, "200", 200.5])("invalid operation status %p prevents parent inspection", async status => {
  const input = await example(), body = hidden(input.parent); Object.assign(input.operation, { httpStatus: status }); expect((await replayCommentMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["parent", "comments", "operation"] as const)("wrong actual %s path prevents its response inspection", async field => {
  const input = await example(), body = hidden(input[field]); input[field].path += "?SENSITIVE=true"; const report = await replayCommentMutationCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each(["orderId", "version", "buyerOrganizationId"])("parent %s binds before private order number and items", async changed => {
  const input = await example(), parent = workflow(input); if (changed === "orderId") parent.orderId = id; else if (changed === "version") parent.version++; else parent.order.buyerOrganizationId = id;
  const number = hidden(parent.order, "orderNumber"), items = hidden(parent.order, "items"), comments = hidden(input.comments), receipt = hidden(input.operation);
  expect(await replayCommentMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", commentsGetCalls: 0, commandCalls: 0, syntheticCapturedKeyReads: 0 }); for (const getter of [number, items, comments, receipt]) expect(getter).not.toHaveBeenCalled();
});
it("selected edit version drift is rejected before any comment text", async () => {
  const input = await example(); rows(input)[0]!.version = input.expected.commentVersion! + 1; const body = hidden(rows(input)[0]!), request = hidden(input.operation, "requestBody"), receipt = hidden(input.operation);
  expect(await replayCommentMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", commentsPhase: "contract-error", commandCalls: 0 }); for (const getter of [body, request, receipt]) expect(getter).not.toHaveBeenCalled();
});
it("a different comment order is rejected before private body", async () => {
  const input = await example(); rows(input)[0]!.supplierOrderId = id; const body = hidden(rows(input)[0]!); expect(await replayCommentMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", commentsPhase: "contract-error", commandCalls: 0 }); expect(body).not.toHaveBeenCalled();
});
it("an other-party visible comment remains readable but does not gain edit authority", async () => {
  const input = await example(); rows(input)[0]!.authorOrganizationId = id; rows(input)[0]!.canEdit = true; const request = hidden(input.operation, "requestBody"), receipt = hidden(input.operation);
  expect(await replayCommentMutationCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commentsPhase: "ready", commandCalls: 0 }); expect(request).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it.each(["missing", "other-author", "no-author", "supplier"])("%s edit source remains unavailable despite canEdit:true", async source => {
  const input = await example(), row = rows(input)[0]!;
  if (source === "missing") input.comments.body = [];
  if (source === "other-author") row.authorUserId = id;
  if (source === "no-author") delete row.authorUserId;
  if (source === "supplier") row.authorOrganizationId = workflow(input).order.supplierOrganizationId;
  row.canEdit = true; const request = hidden(input.operation, "requestBody"), receipt = hidden(input.operation);
  expect(await replayCommentMutationCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(request).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it("optional canEdit/key getters do not control a genuine current-author edit source", async () => {
  const input = await example(), row = rows(input)[0]!, edit = hidden(row, "canEdit"), key = hidden(row, "idempotencyKey"); expect((await replayCommentMutationCapture(input)).status).toBe("CONSISTENT_RESPONSE"); expect(edit).not.toHaveBeenCalled(); expect(key).not.toHaveBeenCalled();
});
it.each(commentMutationCaptureKinds)("extra %s request key cannot inspect secret getter or receipt", async kind => {
  const input = await example(kind), secret = hidden(input.operation.requestBody as object, "headers"), receipt = hidden(input.operation); expect((await replayCommentMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(secret).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it.each(commentMutationCaptureKinds)("noncanonical %s captured body is compared to prepared wire before receipt", async kind => {
  const input = await example(kind); const request = input.operation.requestBody as { body: string }; request.body = "  " + request.body + "  "; const receipt = hidden(input.operation); expect((await replayCommentMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it("edit captured version drift fails exact actual prepared input before receipt", async () => {
  const input = await example(); (input.operation.requestBody as { version: number }).version++; const receipt = hidden(input.operation); expect((await replayCommentMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it("create noncanonical saved key cannot silently become a different wire key", async () => {
  const input = await example("comment-create"), request = input.operation.requestBody as { idempotencyKey: string }; request.idempotencyKey = "  " + request.idempotencyKey + "  "; const receipt = hidden(input.operation); expect((await replayCommentMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it.each(commentMutationCaptureKinds)("invalid %s request body never reads receipt", async kind => {
  const input = await example(kind); (input.operation.requestBody as { body: string }).body = " "; const receipt = hidden(input.operation); expect((await replayCommentMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it.each(["parent", "comments"] as const)("%s HTTP failures prevent any command/key use", async field => {
  for (const status of [401, 403, 404, 429, 500]) { const input = await example("comment-create"); input[field].httpStatus = status; input[field].body = commentCreateError(status).payload; const request = hidden(input.operation, "requestBody"), receipt = hidden(input.operation); expect(await replayCommentMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 0, syntheticCapturedKeyReads: 0 }); expect(request).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled(); }
});
it.each(commentMutationCaptureKinds)("%s HTTP receipt keeps exact original known/unknown classification", async kind => {
  for (const status of [400, 401, 403, 404, 409, 429, 500]) {
    const input = await example(kind); input.operation.httpStatus = status; input.operation.body = commentCreateError(status).payload; const known = (kind === "comment-create" ? [400, 401, 403, 404, 409] : [400, 401, 403, 409]).includes(status), report = await replayCommentMutationCapture(input);
    expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: known ? "rejected" : "unknown", commandCalls: 1 }); if (!known) expect(report.unresolved).toBe(true); flags(report);
  }
});
it.each(commentMutationCaptureKinds)("%s malformed409 envelope remains unknown", async kind => {
  const input = await example(kind); input.operation.httpStatus = 409; input.operation.body = commentCreateError(403).payload; const report = await replayCommentMutationCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", unresolved: true }); expect(report.operationIssue).toBeUndefined(); flags(report);
});
it.each(["supplierOrderId", "authorOrganizationId", "authorUserId", "idempotencyKey"])("create receipt %s binds before private text", async field => {
  const input = await example("comment-create"), body = result(input); body[field] = field === "idempotencyKey" ? "SENSITIVE-other-key" : id; const text = hidden(body); expect(await replayCommentMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", unresolved: true }); expect(text).not.toHaveBeenCalled();
});
it.each(["id", "supplierOrderId", "authorOrganizationId", "authorUserId", "version"])("edit receipt %s binds before private text", async field => {
  const input = await example(), body = result(input); body[field] = field === "version" ? input.expected.commentVersion : id; const text = hidden(body); expect(await replayCommentMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", unresolved: true }); expect(text).not.toHaveBeenCalled();
});
it.each(commentMutationCaptureKinds)("%s malformed receipt date remains unknown with no optimistic body insertion", async kind => {
  const input = await example(kind); result(input).updatedAt = "SENSITIVE"; const before = JSON.stringify(input), report = await replayCommentMutationCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", unresolved: true }); expect(JSON.stringify(input)).toBe(before); flags(report);
});
it.each(["parent", "comments", "operation"] as const)("throwing %s body cannot forge HTTP denial", async field => {
  const input = await example(); Object.defineProperty(input[field], "body", { get: () => { throw new MarketHttpError(403, { private: "SENSITIVE" }); } }); const report = await replayCommentMutationCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report);
});
it("generation and replay use only an explicit saved create key, no global fetch or native entropy", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network")); for (const kind of commentMutationCaptureKinds) { const report = await replayCommentMutationCapture(await commentMutationCaptureExample(kind)); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report); } expect(fetcher).not.toHaveBeenCalled();
});
