import { jest } from "@jest/globals";
import { workspaceReadCaptureExample, type WorkspaceCaptureExample } from "./test-fixtures/workspace-read-capture-example";
import { replayWorkspaceReadCapture, type WorkspaceCaptureReport } from "./test-fixtures/workspace-read-capture-replay";
import { savedListFixture, savedListId as id } from "./test-fixtures/saved-lists";
import { cartCommandError } from "./test-fixtures/cart-commands";
import { MarketHttpError } from "./market-transport";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";

async function example(kind: WorkspaceCaptureExample["kind"] = "saved-lists", empty = false): Promise<WorkspaceCaptureExample> { return JSON.parse(JSON.stringify(await workspaceReadCaptureExample(kind, empty))); }
function hidden(target: object, field = "body") { const getter = jest.fn(() => { throw Error("SENSITIVE_WORKSPACE_CAPTURE"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter; }
function flags(report: WorkspaceCaptureReport) {
  expect(Object.isFrozen(report)).toBe(true);
  expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, authorProvenanceCaptured: false, productionAuthorizationVerified: false, serverAccepted: false, networkRequests: 0, mutations: 0, credentialStoreAccessed: false });
  for (const field of ["scope", "path", "body", "read", "query", "expected", "orderId", "orderVersion", "createdById", "authorUserId", "canEdit", "error"]) expect(report).not.toHaveProperty(field);
  expect(JSON.stringify(report)).not.toContain("SENSITIVE");
}
afterEach(() => jest.restoreAllMocks());
it.each(["saved-lists", "order-comments"] as const)("replays actual %s controller/GET candidate and local fixture decoder without private display fields", async kind => {
  const input = await example(kind), before = JSON.stringify(input), report = await replayWorkspaceReadCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_READ", kind, consumerPhase: "ready", parentGetCalls: kind === "order-comments" ? 1 : 0, workspaceGetCalls: 1 }); expect(JSON.stringify(input)).toBe(before); flags(report);
  expect(JSON.stringify(report)).not.toContain("999999999999.999999"); expect(JSON.stringify(report)).not.toContain("00000000-");
});
it.each(["saved-lists", "order-comments"] as const)("empty %s is an actual empty read", async kind => { const report = await replayWorkspaceReadCapture(await example(kind, true)); expect(report).toMatchObject({ status: "CONSISTENT_READ", consumerPhase: "empty", workspaceGetCalls: 1 }); flags(report); });
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, kind: "unknown" }])("malformed input remains fixed and redacted: %p", async input => { const report = await replayWorkspaceReadCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report); });
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid scope %s cannot inspect any saved body", async field => {
  const input = await example("order-comments"), read = hidden(input.read), parent = hidden(input.parent!), scope = { ...input.scope, [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE_INVALID_SCOPE" };
  expect(await replayWorkspaceReadCapture({ ...input, scope })).toMatchObject({ status: "INPUT_INVALID", parentGetCalls: 0, workspaceGetCalls: 0 }); expect(read).not.toHaveBeenCalled(); expect(parent).not.toHaveBeenCalled();
});
it.each(["root", "scope", "expected", "parent", "read"] as const)("extra headers/token at %s fail before parent or child response contents", async target => {
  const input = await example("order-comments"), read = hidden(input.read), parent = hidden(input.parent!), raw = target === "root" ? input : input[target]!;
  const secret = hidden(raw, "headers"), report = await replayWorkspaceReadCapture(input); expect(report.status).toBe("INPUT_INVALID"); for (const getter of [read, parent, secret]) expect(getter).not.toHaveBeenCalled(); flags(report);
});
it.each(["parent", "expected", "query", "target"])("saved lists cannot accept a caller %s context", async field => {
  const input = await example(), read = hidden(input.read), extra = hidden(input, field); expect((await replayWorkspaceReadCapture(input)).status).toBe("INPUT_INVALID"); expect(read).not.toHaveBeenCalled(); expect(extra).not.toHaveBeenCalled();
});
it.each(["parent", "expected"] as const)("comments require explicit own %s metadata before contents", async field => {
  const input = await example("order-comments"), read = hidden(input.read); delete input[field]; expect((await replayWorkspaceReadCapture(input)).status).toBe("INPUT_INVALID"); expect(read).not.toHaveBeenCalled();
});
it.each(["parent", "read"] as const)("wrong %s method rejects headers before any body", async key => {
  const input = await example("order-comments"), read = hidden(input.read), parent = hidden(input.parent!), raw = input[key]! as Record<string, unknown>; raw.method = "POST";
  expect((await replayWorkspaceReadCapture(input)).status).toBe("INPUT_INVALID"); expect(read).not.toHaveBeenCalled(); expect(parent).not.toHaveBeenCalled();
});
it.each([199, 600, 200.5, "200"])("invalid status %p is input failure before parent body", async value => {
  const input = await example("order-comments"), parent = hidden(input.parent!); const report = await replayWorkspaceReadCapture({ ...input, read: { ...input.read, httpStatus: value } }); expect(report.status).toBe("INPUT_INVALID"); expect(parent).not.toHaveBeenCalled();
});
it.each(["parent", "read"] as const)("wrong %s exact native path cannot read that response", async key => {
  const input = await example("order-comments"), getter = hidden(input[key]!); input[key]!.path += "?SENSITIVE_WRONG_SELECTOR=true"; const report = await replayWorkspaceReadCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(getter).not.toHaveBeenCalled(); flags(report);
});
it("missing own GET body is invalid before parent decoding", async () => {
  const input = await example("order-comments"), parent = hidden(input.parent!), { method, path, httpStatus } = input.read;
  expect((await replayWorkspaceReadCapture({ ...input, read: { method, path, httpStatus } })).status).toBe("INPUT_INVALID"); expect(parent).not.toHaveBeenCalled();
});
it.each(["root-id", "root-version", "nested-id", "nested-version", "buyer"])("wrong selected parent %s is refused before private order number and comment contents", async field => {
  const input = await example("order-comments"), body = input.parent!.body as OrderWorkflowResponse;
  if (field === "root-id") body.orderId = id(99801); if (field === "root-version") body.version++; if (field === "nested-id") body.order.id = id(99801); if (field === "nested-version") body.order.version++; if (field === "buyer") body.order.buyerOrganizationId = id(99801);
  const label = hidden(body.order, "orderNumber"), child = hidden(input.read), report = await replayWorkspaceReadCapture(input);
  expect(report).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", workspaceGetCalls: 0 }); expect(label).not.toHaveBeenCalled(); expect(child).not.toHaveBeenCalled(); flags(report);
});
it("foreign saved-list row prevents private names/notes of every row from decoding", async () => {
  const input = await example(), body = input.read.body as ReturnType<typeof savedListFixture>[]; body[1]!.organizationId = id(99802); const name = hidden(body[0]!, "name"), note = hidden(body[0]!.items[0]!, "note");
  expect(await replayWorkspaceReadCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "contract-error" }); expect(name).not.toHaveBeenCalled(); expect(note).not.toHaveBeenCalled();
});
it.each(["listId", "duplicate-item", "duplicate-offer"])("saved-list %s binding fails before quantity/note", async field => {
  const input = await example(), body = input.read.body as ReturnType<typeof savedListFixture>[], list = body[0]!, item = list.items[0]!;
  if (field === "listId") item.listId = id(99803); else list.items.push({ ...item, ...(field === "duplicate-item" ? { offerId: id(99804) } : { id: id(99804) }) });
  const quantity = hidden(item, "quantity"), note = hidden(item, "note"); expect((await replayWorkspaceReadCapture(input)).status).toBe("CONSUMER_REJECTED"); expect(quantity).not.toHaveBeenCalled(); expect(note).not.toHaveBeenCalled();
});
it("numeric Decimal encoding remains unaccepted, with no permissive numeric conversion", async () => {
  const input = await example(), body = input.read.body as { items: { quantity: unknown }[] }[]; body[0]!.items[0]!.quantity = 1.25;
  expect(await replayWorkspaceReadCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "contract-error" });
});
it("historical negative quantity/empty name/null note keeps exact read semantics and creates no write eligibility", async () => {
  const input = await example(), body = input.read.body as ReturnType<typeof savedListFixture>[]; body[0]!.name = ""; body[0]!.items[0]!.quantity = "-1.000001"; body[0]!.items[0]!.note = null;
  const before = JSON.stringify(input), report = await replayWorkspaceReadCapture(input); expect(report.status).toBe("CONSISTENT_READ"); expect(JSON.stringify(input)).toBe(before); flags(report);
});
it.each(["order", "visibility", "duplicate-id"])("comment %s metadata is checked before any comment body", async field => {
  const input = await example("order-comments"), body = input.read.body as { id: string; supplierOrderId: string; visibility: string }[];
  if (field === "order") body[1]!.supplierOrderId = id(99805); if (field === "visibility") body[1]!.visibility = "INTERNAL"; if (field === "duplicate-id") body[1]!.id = body[0]!.id;
  const text = hidden(body[0]!, "body"), report = await replayWorkspaceReadCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "contract-error" }); expect(text).not.toHaveBeenCalled(); flags(report);
});
it("default readonly comment path never reads optional actor/key/grant proof or creates author authority", async () => {
  const input = await example("order-comments"), body = input.read.body as object[], actor = hidden(body[0]!, "authorUserId"), key = hidden(body[0]!, "idempotencyKey"), grant = hidden(body[0]!, "canEdit");
  const report = await replayWorkspaceReadCapture(input); expect(report).toMatchObject({ status: "CONSISTENT_READ", authorProvenanceCaptured: false }); for (const getter of [actor, key, grant]) expect(getter).not.toHaveBeenCalled(); flags(report);
});
it("source-unsupported workflow status still permits only the existing selected readonly comment path", async () => {
  const input = await example("order-comments"), parent = input.parent!.body as OrderWorkflowResponse; parent.status = parent.order.status = "SENSITIVE_FUTURE_STATUS";
  const report = await replayWorkspaceReadCapture(input); expect(report).toMatchObject({ status: "CONSISTENT_READ", parentPhase: "unsupported", consumerPhase: "ready", authorProvenanceCaptured: false }); flags(report);
});
it.each(["saved-lists", "order-comments"] as const)("contradictory %s HTTP/error envelope remains source contract-error", async kind => {
  const input = await example(kind); input.read.httpStatus = 403; input.read.body = cartCommandError(401).payload;
  expect(await replayWorkspaceReadCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: "contract-error" });
});
it.each(["saved-lists", "order-comments"] as const)("actual %s HTTP classifiers produce only source phase, never private error prose", async kind => {
  for (const [status, phase] of [[401, "authentication-required"], [403, "denied"], [404, "unavailable"], [429, "retry-limited"], [500, "error"]] as const) {
    const input = await example(kind); input.read.httpStatus = status; input.read.body = cartCommandError(status).payload; const report = await replayWorkspaceReadCapture(input);
    expect(report).toMatchObject({ status: "CONSUMER_REJECTED", consumerPhase: phase }); flags(report);
  }
});
it.each([401, 403, 404, 429, 500])("parent HTTP%i cannot read child comment contents", async status => {
  const input = await example("order-comments"), child = hidden(input.read); input.parent!.httpStatus = status; input.parent!.body = cartCommandError(status).payload;
  const report = await replayWorkspaceReadCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", workspaceGetCalls: 0 }); expect(child).not.toHaveBeenCalled(); flags(report);
});
it.each(["parent", "read"] as const)("throwing %s body getter cannot forge a server HTTP error", async key => {
  const input = await example("order-comments"); Object.defineProperty(input[key]!, "body", { get: () => { throw new MarketHttpError(403, { private: "SENSITIVE" }); } });
  const report = await replayWorkspaceReadCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report);
});
it("saved replay and example generation use no fetch, command/key provider or credential store", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network"));
  for (const kind of ["saved-lists", "order-comments"] as const) { const report = await replayWorkspaceReadCapture(await workspaceReadCaptureExample(kind)); expect(report.status).toBe("CONSISTENT_READ"); flags(report); }
  expect(fetcher).not.toHaveBeenCalled();
});
