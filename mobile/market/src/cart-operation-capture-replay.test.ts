import { jest } from "@jest/globals";
import { cartOperationCaptureExample, type CartCaptureExample } from "./test-fixtures/cart-operation-capture-example";
import { replayCartOperationCapture, type CartCaptureReport } from "./test-fixtures/cart-operation-capture-replay";
import { cartCommandError } from "./test-fixtures/cart-commands";
import { cartValidationResult } from "./test-fixtures/cart-validation";
import { MarketHttpError } from "./market-transport";
import type { CartResponse } from "../../../packages/schemas/src/core-api";

async function example(kind: CartCaptureExample["kind"] = "validation", variant: Parameters<typeof cartOperationCaptureExample>[1] = "unchanged"): Promise<CartCaptureExample> {
  return JSON.parse(JSON.stringify(await cartOperationCaptureExample(kind, variant)));
}
function hidden(target: object, field = "body") {
  const getter = jest.fn(() => { throw Error("SENSITIVE_CAPTURE_VALUE"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter;
}
function flags(report: CartCaptureReport) {
  expect(Object.isFrozen(report)).toBe(true);
  expect(report).toMatchObject({ modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, realNetworkRequests: 0, realServerMutations: 0, credentialStoreAccessed: false });
  for (const key of ["scope", "path", "body", "requestBody", "idempotencyKey", "cartId", "cartVersion", "result", "receipt", "error", "validation"]) expect(report).not.toHaveProperty(key);
  expect(JSON.stringify(report)).not.toContain("SENSITIVE");
}
function cart(input: CartCaptureExample) { return (input.parent.body as { current: CartResponse }).current; }
afterEach(() => jest.restoreAllMocks());

it.each(["unchanged", "changed", "unavailable", "empty"] as const)("validation %s uses source quote rules without claiming checkout admission", async variant => {
  const input = await example("validation", variant), before = JSON.stringify(input), report = await replayCartOperationCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", parentPhase: "ready", validationPhase: "ready", syntheticGetCalls: 1, validationCalls: 1, commandCalls: 0, keyRequests: 0 });
  expect(JSON.stringify(input)).toBe(before); flags(report);
});
it("reprice retains exact tax/promotion/minor strings through actual prepared input and result decoder", async () => {
  const input = await example("reprice"), before = JSON.stringify(input), report = await replayCartOperationCapture(input);
  expect(before).toContain("11600000000000000000"); expect(before).toContain("GROSS_LINE_HALF_UP_V1");
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", operationPhase: "result", syntheticGetCalls: 1, validationCalls: 1, commandCalls: 1, keyRequests: 0 });
  expect(JSON.stringify(input)).toBe(before); expect(JSON.stringify(report)).not.toContain("11600000000000000000"); flags(report);
});
it.each(["COMPLETED", "PROCESSING", "FAILED"] as const)("checkout saved %s receipt is compatible source data, with no proved server effect", async variant => {
  const input = await example("checkout", variant), before = JSON.stringify(input), report = await replayCartOperationCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", operationPhase: "receipt", savedReceiptStatus: variant, syntheticGetCalls: 1, validationCalls: 1, commandCalls: 1, keyRequests: 1 });
  expect(JSON.stringify(input)).toBe(before); expect(JSON.stringify(report)).not.toContain("00000000-"); flags(report);
});
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, kind: "future" }])("invalid root produces fixed metadata only: %p", async input => { const report = await replayCartOperationCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report); });
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid scope %s stops before parent body", async field => {
  const input = await example(), getter = hidden(input.parent);
  const scope = { ...input.scope, [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE_SCOPE" };
  const report = await replayCartOperationCapture({ ...input, scope }); expect(report).toMatchObject({ status: "INPUT_INVALID", syntheticGetCalls: 0 }); expect(getter).not.toHaveBeenCalled(); flags(report);
});
it.each(["root", "scope", "expected", "query", "query input", "parent", "validation", "operation"])("extra token/header in %s is rejected before any response body", async target => {
  const input = await example("checkout"), parent = hidden(input.parent), quote = hidden(input.validation), command = hidden(input.operation!);
  const raw = target === "root" ? input : target === "scope" ? input.scope : target === "expected" ? input.expected : target === "query" ? input.query : target === "query input" ? input.query.input : input[target as "parent" | "validation" | "operation"]!;
  const token = hidden(raw, "headers"), report = await replayCartOperationCapture(input);
  expect(report.status).toBe("INPUT_INVALID"); for (const getter of [parent, quote, command, token]) expect(getter).not.toHaveBeenCalled(); flags(report);
});
it.each(["kind", "selector", "query", "operation absent", "unexpected operation"])("invalid envelope %s does not inspect saved responses", async field => {
  const input = await example(), body = hidden(input.parent);
  const value = field === "kind" ? { ...input, kind: "future" } : field === "selector" ? { ...input, expected: { ...input.expected, cartVersion: 0 } } : field === "query" ? { ...input, query: { kind: "cart", input: {} } } : field === "operation absent" ? { ...input, kind: "checkout" } : { ...input, operation: {} };
  expect((await replayCartOperationCapture(value)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["parent", "validation", "operation"] as const)("%s header metadata is validated before parent body", async key => {
  const input = await example("checkout"), getter = hidden(input.parent); input[key]!.method = "GET" === input[key]!.method ? "POST" : "GET";
  const report = await replayCartOperationCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(getter).not.toHaveBeenCalled();
});
it.each([199, 600, 200.5, "200"])("invalid HTTP status %p stops before saved body", async value => {
  const input = await example(), getter = hidden(input.parent); const report = await replayCartOperationCapture({ ...input, validation: { ...input.validation, httpStatus: value } }); expect(report.status).toBe("INPUT_INVALID"); expect(getter).not.toHaveBeenCalled();
});
it.each(["parent", "validation", "operation"] as const)("wrong %s wire path never reads that saved body", async key => {
  const input = await example("checkout"), getter = hidden(input[key]!); input[key]!.path += "?SENSITIVE_EXTRA=true";
  const report = await replayCartOperationCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(getter).not.toHaveBeenCalled(); flags(report);
});
it("bodyless validate rejects a captured requestBody before parent body", async () => {
  const input = await example(), getter = hidden(input.parent), validation = { ...input.validation, requestBody: {} };
  expect((await replayCartOperationCapture({ ...input, validation })).status).toBe("INPUT_INVALID"); expect(getter).not.toHaveBeenCalled();
});
it.each(["id", "version", "buyerOrganizationId"] as const)("selected parent %s mismatch precedes private cart items and all following bodies", async key => {
  const input = await example("checkout"), current = cart(input); if (key === "version") current.version++; else current[key] = "00000000-0000-4000-8000-000000093999";
  const getters = [hidden(current, "items"), hidden(input.validation), hidden(input.operation!)];
  const report = await replayCartOperationCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", validationCalls: 0, commandCalls: 0, keyRequests: 0 }); for (const getter of getters) expect(getter).not.toHaveBeenCalled(); flags(report);
});
it("null current remains unsupported and cannot inspect quote or checkout", async () => {
  const input = await example("checkout"); input.parent.body = { current: null, items: [], nextCursor: null }; const quote = hidden(input.validation), operation = hidden(input.operation!);
  expect(await replayCartOperationCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", parentPhase: "empty", validationCalls: 0, keyRequests: 0 }); expect(quote).not.toHaveBeenCalled(); expect(operation).not.toHaveBeenCalled();
});
it.each(["cartId", "cartVersion", "cartItemId", "offerId"])("validation %s mismatch precedes source quote's private amounts", async field => {
  const input = await example("checkout"), quote = input.validation.body as { cartId: string; cartVersion: number; items: { cartItemId: string; offerId: string }[] };
  if (field === "cartId") quote.cartId = "00000000-0000-4000-8000-000000093999"; else if (field === "cartVersion") quote.cartVersion++; else quote.items[0]![field as "cartItemId" | "offerId"] = "00000000-0000-4000-8000-000000093999";
  const getter = hidden(field === "cartId" || field === "cartVersion" ? quote : quote.items[0]!, field === "cartId" || field === "cartVersion" ? "items" : "previous"), command = hidden(input.operation!);
  expect(await replayCartOperationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", validationPhase: "error", validationIssue: "invalid-result", commandCalls: 0, keyRequests: 0 }); expect(getter).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled();
});
it.each(["changed", "unavailable", "empty"] as const)("ineligible %s checkout never inspects saved command request or body", async variant => {
  const input = await example("checkout"); if (variant === "empty") cart(input).items = [];
  input.validation.body = cartValidationResult(cart(input), variant === "empty" ? "unchanged" : variant);
  const body = hidden(input.operation!), request = hidden(input.operation!, "requestBody");
  expect(await replayCartOperationCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", validationPhase: "ready", commandCalls: 0, keyRequests: 0 }); expect(body).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
});
it("unchanged quote cannot prepare reprice or inspect captured request", async () => {
  const input = await example("reprice"); input.validation.body = cartValidationResult(cart(input)); const body = hidden(input.operation!), request = hidden(input.operation!, "requestBody");
  expect((await replayCartOperationCapture(input)).status).toBe("UNSUPPORTED_CONTEXT"); expect(body).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
});
it.each(["version", "key", "trimmed key", "extra header", "missing key", "bad key"])("captured checkout request %s is checked before receipt", async field => {
  const input = await example("checkout"), request = input.operation!.requestBody as Record<string, unknown>, body = hidden(input.operation!);
  if (field === "version") request.expectedVersion = 42;
  // A changed explicit key is valid input: the captured receipt must be bound to that exact key by the source model.
  if (field === "key") request.idempotencyKey = "SYNTHETIC other captured key";
  if (field === "trimmed key") request.idempotencyKey = ` ${request.idempotencyKey} `;
  if (field === "extra header") hidden(request, "headers"); if (field === "missing key") delete request.idempotencyKey; if (field === "bad key") request.idempotencyKey = "short";
  if (field === "key") { Object.defineProperty(input.operation!, "body", { configurable: true, value: (await example("checkout")).operation!.body }); expect(await replayCartOperationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result" }); }
  else { const report = await replayCartOperationCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled(); flags(report); }
});
it.each(["version", "terms", "line", "extra"])("captured reprice request %s mismatch stops before response", async field => {
  const input = await example("reprice"), request = input.operation!.requestBody as { expectedVersion: number; acceptedItems: { cartItemId: string; snapshot: { totalPriceMinor: string } }[] }, body = hidden(input.operation!);
  if (field === "version") request.expectedVersion++; if (field === "terms") request.acceptedItems[0]!.snapshot.totalPriceMinor = "11600000000000000001"; if (field === "line") request.acceptedItems[0]!.cartItemId = "00000000-0000-4000-8000-000000093999"; if (field === "extra") hidden(request, "headers");
  expect((await replayCartOperationCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each([401, 403, 404, 429, 500])("parent HTTP %i uses the actual source classifier and cannot inspect later records", async status => {
  const input = await example("checkout"), quote = hidden(input.validation), body = hidden(input.operation!); input.parent.httpStatus = status; input.parent.body = cartCommandError(status).payload;
  const report = await replayCartOperationCapture(input); expect(report.status).toBe("CONSUMER_REJECTED"); expect(report.validationCalls).toBe(0); expect(quote).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each([[400, "validation"], [401, "authentication"], [403, "denied"], [404, "not-found"], [409, "conflict"], [429, "read-error"], [500, "read-error"]] as const)("validate HTTP %i preserves source issue %s", async (status, issue) => {
  const input = await example("checkout"), body = hidden(input.operation!); input.validation.httpStatus = status; input.validation.body = cartCommandError(status).payload;
  expect(await replayCartOperationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", validationPhase: "error", validationIssue: issue, commandCalls: 0, keyRequests: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(["reprice", "checkout"] as const)("%s generic409 is never called a successful or proved write", async kind => {
  const input = await example(kind); input.operation!.httpStatus = 409; input.operation!.body = cartCommandError(409, "SENSITIVE_UNRECOGNIZED_CONFLICT").payload;
  const report = await replayCartOperationCapture(input); expect(report.status).toBe("CONSUMER_REJECTED"); expect(report).not.toHaveProperty("savedReceiptStatus"); flags(report);
});
it.each(["parent", "validation", "operation"] as const)("a throwing %s body getter cannot forge HTTP authority", async key => {
  const input = await example("checkout"); Object.defineProperty(input[key]!, "body", { get: () => { throw new MarketHttpError(403, cartCommandError(403).payload); } });
  const report = await replayCartOperationCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report);
});
it("request object key order does not alter actual wire comparison", async () => {
  const input = await example("checkout"), body = input.operation!.requestBody as { expectedVersion: number; idempotencyKey: string }; input.operation!.requestBody = { idempotencyKey: body.idempotencyKey, expectedVersion: body.expectedVersion };
  expect((await replayCartOperationCapture(input)).status).toBe("CONSISTENT_RESPONSE");
});
it("no network or native entropy provider is called while preparing and replaying all three forms", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network"));
  for (const kind of ["validation", "reprice", "checkout"] as const) expect((await replayCartOperationCapture(await example(kind))).status).toBe("CONSISTENT_RESPONSE");
  expect(fetcher).not.toHaveBeenCalled();
});
it.each(["quantity", "unitPriceMinor", "totalPriceMinor", "currency"] as const)("source validation rejects mismatching previous %s before any command", async field => {
  const input = await example("checkout"), quote = input.validation.body as { items: { previous: Record<string, unknown> }[] }; quote.items[0]!.previous[field] = field === "currency" ? "USD" : "99999999999999999999";
  const body = hidden(input.operation!), request = hidden(input.operation!, "requestBody");
  expect(await replayCartOperationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", validationIssue: "invalid-result", commandCalls: 0, keyRequests: 0 }); expect(body).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
});
it.each(["reprice", "checkout"] as const)("foreign %s result metadata is rejected before its private contents", async kind => {
  const input = await example(kind), body = input.operation!.body as Record<string, unknown>; body.buyerOrganizationId = "00000000-0000-4000-8000-000000093999";
  const getter = hidden(body, kind === "checkout" ? "cart" : "items");
  const report = await replayCartOperationCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result", commandCalls: 1 }); expect(getter).not.toHaveBeenCalled(); flags(report);
});
it.each(["reprice", "checkout"] as const)("unchanged %s result version cannot prove a committed outcome", async kind => {
  const input = await example(kind), body = input.operation!.body as Record<string, unknown>; if (kind === "reprice") body.version = input.expected.cartVersion; else (body.cart as { version: number }).version = input.expected.cartVersion;
  expect(await replayCartOperationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result" });
});
it("captured checkout key is read once only after validation and preparation", async () => {
  const input = await example("checkout"), request = input.operation!.requestBody, getter = jest.fn(() => request); Object.defineProperty(input.operation!, "requestBody", { get: getter });
  expect(await replayCartOperationCapture(input)).toMatchObject({ status: "CONSISTENT_RESPONSE", keyRequests: 1 }); expect(getter).toHaveBeenCalledTimes(1);
});
it("a request getter cannot forge a source HTTP error or expose its private payload", async () => {
  const input = await example("checkout"), body = hidden(input.operation!); Object.defineProperty(input.operation!, "requestBody", { get: () => { throw new MarketHttpError(403, { private: "SENSITIVE" }); } });
  const report = await replayCartOperationCapture(input); expect(report).toMatchObject({ status: "INPUT_INVALID", operationPhase: "key-error", commandCalls: 0 }); expect(body).not.toHaveBeenCalled(); flags(report);
});
it("noncanonical or cyclic captured reprice terms cannot trigger response access", async () => {
  const input = await example("reprice"), request = input.operation!.requestBody as { acceptedItems: unknown[] }, body = hidden(input.operation!); request.acceptedItems.push(request);
  expect((await replayCartOperationCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
