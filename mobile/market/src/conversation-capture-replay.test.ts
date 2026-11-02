import { jest } from "@jest/globals";
import { replayConversationCapture as replay } from "./test-fixtures/conversation-capture-replay";
import { conversationCaptureExample as example } from "./test-fixtures/conversation-capture-example";
import { conversationId as uuid, conversationReadError as error } from "./test-fixtures/order-conversation";

it.each(["ORDER", "OFFER"] as const)("replays captured own %s GETs without network, mutation or production admission", async kind => {
  const capture = example(kind), result = await replay(capture);
  expect(result).toMatchObject({ status: "CONSISTENT_READ", stage: "complete", serverAccepted: false, productionAuthorizationVerified: false, networkRequests: 0, mutations: 0,
    pages: [{ messages: 50, version: 5, latestSequence: 65, hasOlder: true }] });
  expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.pages)).toBe(true); expect(Object.isFrozen(result.pages[0])).toBe(true);
  const text = JSON.stringify(result);
  for (const privateValue of [capture.scope.userId, capture.scope.organizationId, capture.expected.id, capture.summary.title, capture.detail.body.messages[0]!.body]) expect(text).not.toContain(privateValue);
});
it.each(["ORDER", "OFFER"] as const)("%s older replay derives cursor16 from protected prior page instead of trusting supplied cursor", async kind => {
  const capture = example(kind, false, true);
  expect(await replay(capture)).toMatchObject({ status: "CONSISTENT_READ", pages: [{ messages: 50 }, { messages: 15, hasOlder: false }] });
  capture.olderDetails[0]!.request.beforeSequence = 17;
  const hidden = jest.fn(() => { throw Error("wrong cursor body"); }); Object.defineProperty(capture.olderDetails[0]!, "body", { get: hidden });
  expect(await replay(capture)).toMatchObject({ status: "INPUT_INVALID", stage: "older-detail", pages: [{ messages: 50 }] }); expect(hidden).not.toHaveBeenCalled();
});
it.each(["ORDER", "OFFER"] as const)("%s support replay uses exact owned public parent-pointer guard", async kind => {
  expect(await replay(example(kind, true))).toMatchObject({ status: "CONSISTENT_READ", supportMessages: 3, pages: [{ messages: 2 }] });
});
it("foreign expected owner is rejected before every captured response slot", async () => {
  const capture = example(), hidden = jest.fn(() => { throw Error("foreign capture body"); }); capture.expected.buyerOrganizationId = uuid(60001);
  for (const field of ["summary", "detail", "orderWorkflow", "supportDetail"]) Object.defineProperty(capture, field, { get: hidden });
  expect(await replay(capture)).toMatchObject({ status: "INPUT_INVALID", stage: "envelope", pages: [] }); expect(hidden).not.toHaveBeenCalled();
});
it.each(["id", "contextId", "productId", "supplierOrganizationId"] as const)("wrong OFFER captured summary %s cannot touch nested labels or detail", async field => {
  const capture = example(), hidden = jest.fn(() => { throw Error("unbound private capture"); }); capture.summary[field] = uuid(60002);
  Object.defineProperty(capture.summary, "context", { get: hidden }); Object.defineProperty(capture, "detail", { get: hidden });
  expect(await replay(capture)).toMatchObject({ status: "CONSUMER_REJECTED", stage: "parent", pages: [] }); expect(hidden).not.toHaveBeenCalled();
});
it("wrong captured ORDER workflow request is input failure before private workflow body", async () => {
  const capture = example("ORDER"), hidden = jest.fn(() => { throw Error("unrequested workflow"); }); capture.orderWorkflow!.request.orderId = uuid(60003);
  Object.defineProperty(capture.orderWorkflow!, "body", { get: hidden }); Object.defineProperty(capture, "detail", { get: hidden });
  expect(await replay(capture)).toMatchObject({ status: "INPUT_INVALID", stage: "parent" }); expect(hidden).not.toHaveBeenCalled();
});
it("a shared-DTO-only message without raw conversationId exposes the serialization gap before body", async () => {
  const capture = example(), hidden = jest.fn(() => { throw Error("unbound message"); });
  Reflect.deleteProperty(capture.detail.body.messages[0]!, "conversationId"); Object.defineProperty(capture.detail.body.messages[0]!, "body", { get: hidden });
  expect(await replay(capture)).toMatchObject({ status: "CONSUMER_REJECTED", stage: "detail", phase: "contract-error", pages: [] }); expect(hidden).not.toHaveBeenCalled();
});
it("archived null product and unknown variant references remain consistent, never synthesized", async () => {
  const capture = example(); capture.expected.productId = null; capture.summary.productId = null; capture.summary.context!.productId = null;
  expect(await replay(capture)).toMatchObject({ status: "CONSISTENT_READ", serverAccepted: false });
});
it.each([401, 403, 404, 429, 500])("captured HTTP%s preserves source failure classification without private error output", async status => {
  const capture = example(), failure = error(status); capture.detail.httpStatus = status;
  Object.defineProperty(capture.detail, "body", { value: failure.payload });
  const result = await replay(capture);
  expect(result).toMatchObject({ status: "CONSUMER_REJECTED", stage: "detail", phase: status === 401 ? "authentication-required" : status === 403 ? "denied" : status === 404 ? "unavailable" : status === 429 ? "retry-limited" : "error" });
  expect(JSON.stringify(result)).not.toContain("payload");
});
it("wrong support owner fails before subject/messages and does not serialize a ticket", async () => {
  const capture = example("OFFER", true), hidden = jest.fn(() => { throw Error("foreign ticket"); }); capture.supportDetail!.body.organizationId = uuid(60004);
  Object.defineProperty(capture.supportDetail!.body, "subject", { get: hidden }); Object.defineProperty(capture.supportDetail!.body, "messages", { get: hidden });
  const result = await replay(capture); expect(result).toMatchObject({ status: "CONSUMER_REJECTED", stage: "support", phase: "contract-error" }); expect(result).not.toHaveProperty("supportMessages"); expect(hidden).not.toHaveBeenCalled();
});
it("support capture is never read unless explicitly included and actually linked", async () => {
  const capture = example(), hidden = jest.fn(() => { throw Error("unselected ticket"); }); Object.defineProperty(capture, "supportDetail", { get: hidden });
  expect(await replay(capture)).toMatchObject({ status: "CONSISTENT_READ" }); capture.includeSupport = true;
  expect(await replay(capture)).toMatchObject({ status: "CONSUMER_REJECTED", stage: "support", phase: "support-pointer-missing" }); expect(hidden).not.toHaveBeenCalled();
});
it.each(["generation", "version", "latestSequence"] as const)("invalid envelope %s cannot read captured payload slots", async field => {
  const capture = example(), hidden = jest.fn(() => { throw Error("invalid envelope body"); });
  if (field === "generation") capture.scope = { ...capture.scope, generation: 0 }; else capture.expected[field] = -1;
  Object.defineProperty(capture, "summary", { get: hidden });
  expect(await replay(capture)).toMatchObject({ status: "INPUT_INVALID", stage: "envelope" }); expect(hidden).not.toHaveBeenCalled();
});
it("caller acceptance claims cannot upgrade a source consistency report", async () => {
  const capture = { ...example(), serverAccepted: true, productionAuthorizationVerified: true, nativeBusinessAdmission: true };
  expect(await replay(capture)).toMatchObject({ status: "CONSISTENT_READ", serverAccepted: false, productionAuthorizationVerified: false });
});
it("missing GET body is malformed capture rather than an invented HTTP source failure", async () => {
  const capture = example(); Reflect.deleteProperty(capture.detail, "body");
  expect(await replay(capture)).toMatchObject({ status: "INPUT_INVALID", stage: "detail", pages: [] });
});
it.each([401, 403, 404, 429, 500])("captured ORDER parent HTTP%s uses the existing protected error classifier before detail", async status => {
  const capture = example("ORDER"), hidden = jest.fn(() => { throw Error("unrequested detail"); });
  capture.orderWorkflow!.httpStatus = status; Object.defineProperty(capture.orderWorkflow!, "body", { value: error(status).payload });
  Object.defineProperty(capture, "detail", { get: hidden });
  expect(await replay(capture)).toMatchObject({ status: "CONSUMER_REJECTED", stage: "parent", phase: status === 401 ? "authentication-required" : status === 403 ? "denied" : status === 404 ? "unavailable" : status === 429 ? "retry-limited" : "error" });
  expect(hidden).not.toHaveBeenCalled();
});
it("never calls the network transport even when captured replies contain media URLs", async () => {
  const original = globalThis.fetch, transport = jest.fn<typeof fetch>().mockImplementation(async () => { throw Error("Network is forbidden in capture replay"); });
  globalThis.fetch = transport;
  try { expect(await replay(example("OFFER", true))).toMatchObject({ status: "CONSISTENT_READ", networkRequests: 0, mutations: 0 }); expect(transport).not.toHaveBeenCalled(); }
  finally { globalThis.fetch = original; }
});
it.each(["method", "path"] as const)("captured detail wrong %s is input failure before body", async field => {
  const capture = example(), hidden = jest.fn(() => { throw Error("wrong route body"); });
  Object.assign(capture.detail, { [field]: field === "method" ? "POST" : `/conversations/${uuid(60005)}` });
  Object.defineProperty(capture.detail, "body", { get: hidden });
  expect(await replay(capture)).toMatchObject({ status: "INPUT_INVALID", stage: "detail", pages: [] }); expect(hidden).not.toHaveBeenCalled();
});
