import { jest } from "@jest/globals";
import type { OfferComparisonResponse } from "../../../packages/schemas/src/core-api";
import type { FixtureSavedList } from "./saved-lists-fixture-read";
import { MarketHttpError } from "./market-transport";
import { cartCommandError } from "./test-fixtures/cart-commands";
import { savedListMutationCaptureExample, type SavedListMutationCaptureExample } from "./test-fixtures/saved-list-mutation-capture-example";
import { savedListCaptureKinds } from "./test-fixtures/saved-list-mutation-capture-kernel";
import { replaySavedListMutationCapture, type SavedListMutationCaptureReport } from "./test-fixtures/saved-list-mutation-capture-replay";

const id = "00000000-0000-4000-8000-000000099601";
async function example(kind: SavedListMutationCaptureExample["kind"] = "list-upsert") { return JSON.parse(JSON.stringify(await savedListMutationCaptureExample(kind))) as SavedListMutationCaptureExample; }
const page = (input: SavedListMutationCaptureExample) => input.parent.body as FixtureSavedList[];
const result = (input: SavedListMutationCaptureExample) => input.operation.body as Record<string, unknown>;
function hidden(target: object, field = "body") { const getter = jest.fn(() => { throw Error("SENSITIVE_SAVED_LIST_CAPTURE"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter; }
function flags(report: SavedListMutationCaptureReport) {
  expect(Object.isFrozen(report)).toBe(true); expect(report).toMatchObject({ responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, keyProviderAccessed: false, credentialStoreAccessed: false, realNetworkRequests: 0, realServerMutations: 0 });
  for (const key of ["scope", "expected", "body", "requestBody", "listId", "itemId", "offerId", "name", "note", "quantity", "result", "idempotencyKey", "error"]) expect(report).not.toHaveProperty(key);
  for (const text of ["SENSITIVE", "00000000-", "SYNTHETIC", "999999999999.999999"]) expect(JSON.stringify(report).replaceAll("SYNTHETIC_ONLY", "")).not.toContain(text);
}
afterEach(() => jest.restoreAllMocks());

it.each(savedListCaptureKinds)("saved %s uses original source model and actual native candidate", async kind => {
  const input = await savedListMutationCaptureExample(kind), before = JSON.stringify(input), report = await replaySavedListMutationCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", kind, comparisonGetCalls: kind === "list-upsert" ? 1 : 0, workspaceGetCalls: 1, commandCalls: 1, operationPhase: "result", unresolvedAttempts: 0, responseSchemaProvenance: "LOCAL_SOURCE_FIXTURE_ONLY", modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, serverAccepted: false, effectProven: false });
  expect(JSON.stringify(input)).toBe(before);
  flags(report);
});
it("create accepts an empty page and does not invent a default-list update in its header response", async () => {
  const input = await example("list-create"); input.parent.body = []; const report = await replaySavedListMutationCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", parentPhase: "empty", commandCalls: 1 }); flags(report);
});
it("source create permits a duplicate list name without claiming a unique name or merging defaults", async () => {
  const input = await example("list-create"); page(input)[0]!.name = (input.operation.requestBody as { name: string }).name;
  const before = JSON.stringify(input), report = await replaySavedListMutationCapture(input); expect(report.status).toBe("CONSISTENT_RESPONSE"); expect(JSON.stringify(input)).toBe(before); flags(report);
});
it("upsert into a new row accepts a changed UUID while colleague ownership remains organizational", async () => {
  const input = await example(); page(input)[0]!.items = []; result(input).id = id;
  const report = await replaySavedListMutationCapture(input); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report);
});
it("list storage does not impose cart stock or minimum-order rules", async () => {
  const input = await example(), compared = input.comparison!.body as OfferComparisonResponse; compared.offers[0]!.availability.forEach(row => { row.quantityAvailable = "0"; });
  const report = await replaySavedListMutationCapture(input); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report);
});
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, kind: "list-delete" }])("invalid root remains fixed/redacted: %p", async input => { const report = await replaySavedListMutationCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report); });
it.each(["root", "scope", "expected", "comparison-query", "comparison-input", "comparison", "parent", "operation"])("extra secret field in %s stops before private responses", async field => {
  const input = await example(), a = hidden(input.comparison!), b = hidden(input.parent), c = hidden(input.operation);
  const target = field === "root" ? input : field === "scope" ? input.scope : field === "expected" ? input.expected! : field === "comparison-query" ? input.comparisonQuery! : field === "comparison-input" ? input.comparisonQuery!.input : input[field as "comparison" | "parent" | "operation"]!;
  const secret = hidden(target, "headers"); expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); for (const getter of [a, b, c, secret]) expect(getter).not.toHaveBeenCalled();
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid scope %s stops before parent", async field => {
  const input = await example("list-create"), body = hidden(input.parent); const scope = { ...input.scope, [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE" };
  expect(await replaySavedListMutationCapture({ ...input, scope })).toMatchObject({ status: "INPUT_INVALID", workspaceGetCalls: 0, commandCalls: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(savedListCaptureKinds)("wrong %s operation method stops before parent", async kind => {
  const input = await example(kind), body = hidden(input.parent); input.operation.method = kind === "list-remove" ? "POST" : "DELETE";
  expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each([199, 600, "200", 200.5])("invalid status %p cannot inspect any body", async status => {
  const input = await example("list-create"), body = hidden(input.parent); Object.assign(input.operation, { httpStatus: status }); expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["expected", "comparison", "comparisonQuery"])("create forbids even an unread %s field", async field => {
  const input = await example("list-create"), secret = hidden(input, field), body = hidden(input.parent); expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(secret).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it.each(["comparison", "comparisonQuery"])("remove forbids unused %s before getters", async field => {
  const input = await example("list-remove"), secret = hidden(input, field), body = hidden(input.parent); expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(secret).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it("remove forbids an invented requestBody without reading it", async () => {
  const input = await example("list-remove"), request = hidden(input.operation, "requestBody"), body = hidden(input.parent); expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(request).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it.each(["list-upsert", "list-remove"] as const)("%s requires selected UUID metadata before body", async kind => {
  const input = await example(kind), body = hidden(input.parent); delete input.expected; expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["list-create", "list-upsert", "list-remove"] as const)("wrong actual %s mutation path cannot inspect its receipt", async kind => {
  const input = await example(kind), body = hidden(input.operation); input.operation.path += "?SENSITIVE=true"; expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it("wrong actual parent GET path cannot inspect lists", async () => {
  const input = await example("list-create"), body = hidden(input.parent); input.parent.path += "/SENSITIVE"; expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it("comparison buyer override rejects its secret getter before response", async () => {
  const input = await example(), buyer = hidden(input.comparisonQuery!.input, "buyerOrganizationId"), body = hidden(input.comparison!); expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(buyer).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it.each(["product", "variant"])("wrong comparison %s selector prevents destination GET", async changed => {
  const input = await example(), compared = input.comparison!.body as OfferComparisonResponse; if (changed === "product") compared.product.id = id; else compared.selectedVariantId = id;
  const body = hidden(input.parent); expect(await replaySavedListMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", comparisonPhase: "contract-error", workspaceGetCalls: 0, commandCalls: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(savedListCaptureKinds)("foreign %s parent is rejected before list name/note", async kind => {
  const input = await example(kind), list = page(input)[0]!; list.organizationId = id; const name = hidden(list, "name"), items = hidden(list, "items"), receipt = hidden(input.operation);
  expect(await replaySavedListMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", commandCalls: 0 }); for (const getter of [name, items, receipt]) expect(getter).not.toHaveBeenCalled();
});
it.each(["foreign-line", "duplicate-line", "duplicate-offer"])("invalid %s binding stops before private quantities and notes", async changed => {
  const input = await example(), list = page(input)[0]!, item = list.items[0]!;
  if (changed === "foreign-line") item.listId = id; else list.items.push({ ...item, ...(changed === "duplicate-offer" ? { id } : { offerId: id }) });
  const quantity = hidden(item, "quantity"), note = hidden(item, "note"), receipt = hidden(input.operation);
  expect(await replaySavedListMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", commandCalls: 0 }); for (const getter of [quantity, note, receipt]) expect(getter).not.toHaveBeenCalled();
});
it.each(["list-upsert", "list-remove"] as const)("missing %s list cannot inspect operation contents", async kind => {
  const input = await example(kind); input.parent.body = []; const body = hidden(input.operation), request = kind === "list-upsert" ? hidden(input.operation, "requestBody") : undefined;
  expect(await replaySavedListMutationCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0 }); expect(body).not.toHaveBeenCalled(); if (request) expect(request).not.toHaveBeenCalled();
});
it("missing selected removal row cannot inspect its receipt", async () => {
  const input = await example("list-remove"); page(input)[0]!.items = []; const body = hidden(input.operation); expect(await replaySavedListMutationCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(["list-create", "list-upsert"] as const)("extra %s request key cannot inspect secret or result", async kind => {
  const input = await example(kind), secret = hidden(input.operation.requestBody as object, "idempotencyKey"), receipt = hidden(input.operation);
  expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(secret).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it.each(["name", "note"])("noncanonical captured %s is compared to actual prepared wire before receipt", async field => {
  const input = await example(field === "name" ? "list-create" : "list-upsert"); const request = input.operation.requestBody as Record<string, unknown>; request[field] = "  " + request[field] + "  "; const receipt = hidden(input.operation);
  expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it("upsert offer drift fails exact source command input before receipt", async () => {
  const input = await example(); (input.operation.requestBody as { offerId: string }).offerId = id; const receipt = hidden(input.operation); expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it.each([0, -1, "0.5", null])("invalid numeric quantity %p cannot inspect receipt", async quantity => {
  const input = await example(); Object.assign(input.operation.requestBody as object, { quantity }); const receipt = hidden(input.operation); expect((await replaySavedListMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it.each([0.5000001, 1000000000000])("source storage precision rejects %s without applying cart min/stock rules", async quantity => {
  const input = await example(); (input.operation.requestBody as { quantity: number }).quantity = quantity; const receipt = hidden(input.operation);
  expect(await replaySavedListMutationCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", quantityIssueKind: "storage", commandCalls: 0 }); expect(receipt).not.toHaveBeenCalled();
});
it.each([null, undefined])("captured note %p is outside source form's string-note path, without conversion", async note => {
  const input = await example(), request = input.operation.requestBody as { note?: string | null }; if (note === undefined) delete request.note; else request.note = note; const receipt = hidden(input.operation);
  expect(await replaySavedListMutationCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0 }); expect(receipt).not.toHaveBeenCalled();
});
it.each(["name", "note"])("source-allowed %s text is preserved without inventing a new sanitization rule", async field => {
  const input = await example(field === "name" ? "list-create" : "list-upsert"); Object.assign(input.operation.requestBody as object, { [field]: "a\u0000b" }); result(input)[field] = "a\u0000b";
  const before = JSON.stringify(input), report = await replaySavedListMutationCapture(input); expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", commandCalls: 1 }); expect(JSON.stringify(input)).toBe(before); flags(report);
});
it.each(savedListCaptureKinds)("%s parent HTTP failures never dispatch mutation", async kind => {
  for (const status of [401, 403, 404, 429, 500]) { const input = await example(kind); input.parent.httpStatus = status; input.parent.body = cartCommandError(status).payload; const receipt = hidden(input.operation); expect(await replaySavedListMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 0 }); expect(receipt).not.toHaveBeenCalled(); }
});
it.each(savedListCaptureKinds)("%s command HTTP errors retain exact original source classification and unknown count", async kind => {
  for (const status of [400, 401, 403, 404, 409, 429, 500]) {
    const input = await example(kind); input.operation.httpStatus = status; input.operation.body = cartCommandError(status).payload;
    const known = kind === "list-create" ? [400, 401, 403].includes(status) : kind === "list-remove" ? [401, 403, 404].includes(status) : [400, 401, 403, 404].includes(status), report = await replaySavedListMutationCapture(input);
    expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: known ? "rejected" : "unknown", unresolvedAttempts: known ? 0 : 1, commandCalls: 1 }); flags(report);
  }
});
it.each(["organizationId", "createdById", "existing-id"])("create receipt %s binding fails before name", async changed => {
  const input = await example("list-create"), body = result(input); body[changed === "existing-id" ? "id" : changed] = changed === "existing-id" ? page(input)[0]!.id : id; const name = hidden(body, "name");
  expect(await replaySavedListMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", unresolvedAttempts: 1 }); expect(name).not.toHaveBeenCalled();
});
it.each(["listId", "offerId"])("upsert receipt %s binding fails before note/quantity", async field => {
  const input = await example(), body = result(input); body[field] = id; const note = hidden(body, "note"), quantity = hidden(body, "quantity");
  expect(await replaySavedListMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", unresolvedAttempts: 1 }); expect(note).not.toHaveBeenCalled(); expect(quantity).not.toHaveBeenCalled();
});
it.each(["quantity", "note", "updatedAt"])("upsert incompatible %s receipt remains unknown without changing parent", async field => {
  const input = await example(); result(input)[field] = field === "quantity" ? "0.500002" : "SENSITIVE"; const before = JSON.stringify(input);
  const report = await replaySavedListMutationCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", unresolvedAttempts: 1 }); expect(JSON.stringify(input)).toBe(before); flags(report);
});
it.each([false, 1, "true", null])("remove result deleted:%p does not prove effect", async deleted => {
  const input = await example("list-remove"); input.operation.body = { deleted }; const report = await replaySavedListMutationCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", unresolvedAttempts: 1 }); flags(report);
});
it.each(["comparison", "parent", "operation"] as const)("throwing %s body cannot forge source HTTP denial", async field => {
  const input = await example(); Object.defineProperty(input[field]!, "body", { get: () => { throw new MarketHttpError(403, { private: "SENSITIVE" }); } }); const report = await replaySavedListMutationCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report);
});
it("all generated operations avoid fetch, native keys and any independent read/retry", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network")); for (const kind of savedListCaptureKinds) { const report = await replaySavedListMutationCapture(await savedListMutationCaptureExample(kind)); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report); } expect(fetcher).not.toHaveBeenCalled();
});
