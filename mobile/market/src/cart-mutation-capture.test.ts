import { jest } from "@jest/globals";
import { cartMutationCaptureExample, type CartMutationCaptureExample } from "./test-fixtures/cart-mutation-capture-example";
import { replayCartMutationCapture, type CartMutationCaptureReport } from "./test-fixtures/cart-mutation-capture-replay";
import { cartMutationCaptureKinds } from "./test-fixtures/cart-mutation-capture-kernel";
import { commandCart, quantityCartResult, cartCommandError } from "./test-fixtures/cart-commands";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { MarketHttpError } from "./market-transport";

async function example(kind: CartMutationCaptureExample["kind"] = "quantity"): Promise<CartMutationCaptureExample> { return JSON.parse(JSON.stringify(await cartMutationCaptureExample(kind))); }
function hidden(target: object, field = "body") { const getter = jest.fn(() => { throw Error("SENSITIVE_CART_MUTATION_CAPTURE"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter; }
function flags(report: CartMutationCaptureReport) {
  expect(Object.isFrozen(report)).toBe(true); expect(report).toMatchObject({ modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, keyProviderAccessed: false, realNetworkRequests: 0, realServerMutations: 0, credentialStoreAccessed: false });
  for (const key of ["scope", "parent", "body", "requestBody", "cartId", "itemId", "sourceCartId", "currency", "quantity", "version", "result", "idempotencyKey", "error"]) expect(report).not.toHaveProperty(key);
  expect(JSON.stringify(report)).not.toContain("SENSITIVE");
}
const page = (input: CartMutationCaptureExample) => input.parent.body as WorkspaceCartPage;
function lineExpected(input: CartMutationCaptureExample) { const value = input.expected; if (!value || !("cartId" in value)) throw Error("Missing synthetic line selector"); return value; }
afterEach(() => jest.restoreAllMocks());
it.each(cartMutationCaptureKinds)("saved %s response uses actual source models/raw candidate and keeps input unchanged", async kind => {
  const input = await example(kind), before = JSON.stringify(input), report = await replayCartMutationCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", kind, operationPhase: kind === "create" || kind === "recover" ? "result" : "success", syntheticGetCalls: 1, commandCalls: 1 });
  expect(JSON.stringify(input)).toBe(before); expect(JSON.stringify(report)).not.toContain("00000000-"); expect(JSON.stringify(report)).not.toContain("90071992547409931234"); flags(report);
});
it("create-or-get accepts another colleague's existing ACTIVE cart with items/checkout pointer, without claiming creation", async () => {
  const input = await example("create"), body = input.operation.body as CartResponse; expect(body.items.length).toBeGreaterThan(0); expect(body.createdById).not.toBe(input.scope.userId); body.checkout = { id: "00000000-0000-4000-8000-000000099401", status: "PENDING" };
  const report = await replayCartMutationCapture(input); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report);
});
it("create uses explicit captured currency instead of substituting source default", async () => {
  const input = await example("create"), body = input.operation.body as CartResponse; input.operation.requestBody = { currency: "USD" }; body.currency = "USD"; body.items.forEach(item => { item.currency = "USD"; });
  expect((await replayCartMutationCapture(input)).status).toBe("CONSISTENT_RESPONSE");
});
it("recovery permits an existing empty active cart and an advanced returned target snapshot under source rules", async () => {
  const input = await example("recover"), current = commandCart(12); current.items = []; page(input).current = current;
  const result = input.operation.body as CartResponse; result.version = 42; result.status = "CHECKED_OUT";
  const report = await replayCartMutationCapture(input); expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", operationPhase: "result" }); flags(report);
});
it("same-quantity response can retain source version while exact huge price strings stay outside the report", async () => {
  const input = await example("quantity"), selected = lineExpected(input); input.operation.requestBody = { expectedVersion: selected.cartVersion, quantity: 2 }; input.operation.body = quantityCartResult({ expectedVersion: selected.cartVersion, quantity: 2 }, selected.cartVersion);
  const before = JSON.stringify(input), report = await replayCartMutationCapture(input); expect(report.status).toBe("CONSISTENT_RESPONSE"); expect(JSON.stringify(input)).toBe(before); flags(report);
});
it("removal accepts source's already-absent/same-version result without asserting a new delete", async () => {
  const input = await example("remove"); (input.operation.body as CartResponse).version = lineExpected(input).cartVersion; const report = await replayCartMutationCapture(input); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report);
});
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, kind: "unknown" }])("invalid root stays redacted: %p", async input => { const report = await replayCartMutationCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report); });
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid scope %s stops before both saved responses", async field => {
  const input = await example(), parent = hidden(input.parent), response = hidden(input.operation), scope = { ...input.scope, [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE_SCOPE" };
  expect(await replayCartMutationCapture({ ...input, scope })).toMatchObject({ status: "INPUT_INVALID", syntheticGetCalls: 0, commandCalls: 0 }); expect(parent).not.toHaveBeenCalled(); expect(response).not.toHaveBeenCalled();
});
it.each(["root", "scope", "expected", "query", "query-input", "parent", "operation"])("extra headers/token in %s cannot inspect responses or secret getters", async field => {
  const input = await example(), parent = hidden(input.parent), response = hidden(input.operation), target = field === "root" ? input : field === "scope" ? input.scope : field === "expected" ? input.expected! : field === "query" ? input.query : field === "query-input" ? input.query.input : input[field as "parent" | "operation"];
  const secret = hidden(target, "headers"), report = await replayCartMutationCapture(input); expect(report.status).toBe("INPUT_INVALID"); for (const getter of [parent, response, secret]) expect(getter).not.toHaveBeenCalled(); flags(report);
});
it.each(["recover", "quantity", "remove"] as const)("%s requires own expected metadata before response body", async kind => {
  const input = await example(kind), parent = hidden(input.parent); delete input.expected; expect((await replayCartMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(parent).not.toHaveBeenCalled();
});
it("create rejects even an unread caller expected field before body", async () => {
  const input = await example("create"), parent = hidden(input.parent), expected = hidden(input, "expected"); expect((await replayCartMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(parent).not.toHaveBeenCalled(); expect(expected).not.toHaveBeenCalled();
});
it.each(["cartId", "cartVersion", "itemId"] as const)("invalid selected %s is input failure before body", async field => {
  const input = await example(), parent = hidden(input.parent); input.expected = { ...lineExpected(input), [field]: field === "cartVersion" ? 0 : "../SENSITIVE" };
  expect((await replayCartMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(parent).not.toHaveBeenCalled();
});
it("invalid query cannot inspect parent", async () => {
  const input = await example(), parent = hidden(input.parent); expect((await replayCartMutationCapture({ ...input, query: { kind: "cart", input: {} } })).status).toBe("INPUT_INVALID"); expect(parent).not.toHaveBeenCalled();
});
it("operation GET method is rejected before parent; native source still decides POST/PATCH/DELETE for valid headers", async () => {
  const input = await example(), parent = hidden(input.parent); (input.operation as Record<string, unknown>).method = "GET";
  expect((await replayCartMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(parent).not.toHaveBeenCalled();
});
it.each(cartMutationCaptureKinds)("wrong %s native path never reads its saved receipt", async kind => {
  const input = await example(kind), response = hidden(input.operation); input.operation.path += "?SENSITIVE_EXTRA=true"; expect((await replayCartMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(response).not.toHaveBeenCalled();
});
it("wrong allowed mutation method is compared to actual source method before receipt", async () => {
  const input = await example("quantity"), response = hidden(input.operation); input.operation.method = "POST"; expect((await replayCartMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(response).not.toHaveBeenCalled();
});
it.each([199, 600, "200", 200.5])("invalid status %p stops before parent body", async status => {
  const input = await example(), parent = hidden(input.parent); const report = await replayCartMutationCapture({ ...input, operation: { ...input.operation, httpStatus: status } }); expect(report.status).toBe("INPUT_INVALID"); expect(parent).not.toHaveBeenCalled();
});
it.each(["quantity", "remove"] as const)("%s stale selected current version/id is rejected before private parent items", async kind => {
  for (const field of ["id", "version"] as const) {
    const input = await example(kind), current = page(input).current!; if (field === "id") current.id = "00000000-0000-4000-8000-000000099402"; else current.version++;
    const items = hidden(current, "items"), receipt = hidden(input.operation); expect(await replayCartMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", commandCalls: 0 }); expect(items).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
  }
});
it("recovery source version is bound before its private items", async () => {
  const input = await example("recover"), source = page(input).items[0]!; source.version++; const items = hidden(source, "items"), receipt = hidden(input.operation);
  expect(await replayCartMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", commandCalls: 0 }); expect(items).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it.each(["quantity", "recover"] as const)("foreign %s parent is rejected before private cart items", async kind => {
  const input = await example(kind), cart = kind === "quantity" ? page(input).current! : page(input).items[0]!; cart.buyerOrganizationId = "00000000-0000-4000-8000-000000099403";
  const items = hidden(cart, "items"), receipt = hidden(input.operation); expect((await replayCartMutationCapture(input)).status).toBe("CONSUMER_REJECTED"); expect(items).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it.each(["quantity", "remove"] as const)("unsupported %s missing current/selected item cannot inspect command request/response", async kind => {
  for (const missing of ["cart", "item"] as const) {
    const input = await example(kind); if (missing === "cart") page(input).current = null; else lineExpected(input).itemId = "00000000-0000-4000-8000-000000099404";
    const request = hidden(input.operation, "requestBody"), receipt = hidden(input.operation); expect(await replayCartMutationCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0 }); expect(request).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
  }
});
it("create with a current cart does not inspect captured currency or receipt", async () => {
  const input = await example("create"); page(input).current = commandCart(); const request = hidden(input.operation, "requestBody"), receipt = hidden(input.operation);
  expect(await replayCartMutationCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0 }); expect(request).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it.each(["missing", "already-recovered", "current-work", "completed"])("recovery %s context preserves source guards and never reads operation contents", async field => {
  const input = await example("recover"), state = page(input), source = state.items[0]!;
  if (field === "missing") state.items = [];
  if (field === "already-recovered") source.recoveredCartId = "00000000-0000-4000-8000-000000099405";
  if (field === "current-work") { state.current = commandCart(); state.current.items[0]!.id = "00000000-0000-4000-8000-000000099406"; }
  if (field === "completed") { source.status = "CHECKED_OUT"; source.checkout!.status = "COMPLETED"; }
  const request = hidden(input.operation, "requestBody"), receipt = hidden(input.operation); expect(await replayCartMutationCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0 }); expect(request).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it.each(cartMutationCaptureKinds)("extra %s request headers rejected before secret getter and receipt", async kind => {
  const input = await example(kind), request = input.operation.requestBody as object, secret = hidden(request, "headers"), receipt = hidden(input.operation);
  expect((await replayCartMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(secret).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it.each(["recover", "quantity", "remove"] as const)("captured %s version drift is compared to model-generated exact input before receipt", async kind => {
  const input = await example(kind); (input.operation.requestBody as { expectedVersion: number }).expectedVersion++; const receipt = hidden(input.operation);
  expect((await replayCartMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it("noncanonical create currency is not silently accepted after source trimming", async () => {
  const input = await example("create"); input.operation.requestBody = { currency: " KZT " }; const receipt = hidden(input.operation); expect((await replayCartMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it.each([0, -1, "3.5", 3.5000001])("invalid wire quantity %p cannot inspect receipt", async value => {
  const input = await example(); input.operation.requestBody = { expectedVersion: lineExpected(input).cartVersion, quantity: value }; const receipt = hidden(input.operation); expect((await replayCartMutationCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it.each(cartMutationCaptureKinds)("%s actual parent HTTP classifier prevents any command/body access", async kind => {
  for (const status of [401, 403, 404, 429, 500]) {
    const input = await example(kind); input.parent.httpStatus = status; input.parent.body = cartCommandError(status).payload; const request = hidden(input.operation, "requestBody"), receipt = hidden(input.operation);
    expect(await replayCartMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 0 }); expect(request).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
  }
});
it.each(cartMutationCaptureKinds)("%s command HTTP source rules preserve rejection/conflict/unknown and no proved effect", async kind => {
  for (const status of [400, 401, 403, 404, 409, 429, 500]) {
    const input = await example(kind); input.operation.httpStatus = status; input.operation.body = cartCommandError(status).payload; const report = await replayCartMutationCapture(input);
    expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: status >= 429 ? "unknown" : status === 409 && (kind === "quantity" || kind === "remove") ? "conflict" : "rejected", commandCalls: 1 }); flags(report);
  }
});
it.each(cartMutationCaptureKinds)("foreign %s receipt buyer is rejected before its private cart items", async kind => {
  const input = await example(kind), body = input.operation.body as CartResponse; body.buyerOrganizationId = "00000000-0000-4000-8000-000000099407"; const items = hidden(body, "items");
  expect(await replayCartMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result" }); expect(items).not.toHaveBeenCalled();
});
it("recovery cannot identify its failed source as recovered target before private receipt decode", async () => {
  const input = await example("recover"), body = input.operation.body as CartResponse; body.id = page(input).items[0]!.id; const items = hidden(body, "items");
  expect(await replayCartMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result" }); expect(items).not.toHaveBeenCalled();
});
it.each(["quantity", "remove"] as const)("%s bad response item-cart binding fails before private quantities", async kind => {
  const input = await example(kind), body = commandCart(4); body.items[0]!.cartId = "00000000-0000-4000-8000-000000099408"; input.operation.body = body; const quantity = hidden(body.items[0]!, "quantity");
  expect((await replayCartMutationCapture(input)).status).toBe("CONSUMER_REJECTED"); expect(quantity).not.toHaveBeenCalled();
});
it.each(["quantity", "offerId", "unitPriceMinor"] as const)("quantity response %s mismatch remains unknown", async field => {
  const input = await example(), body = input.operation.body as CartResponse; body.items[0]![field] = field === "offerId" ? "00000000-0000-4000-8000-000000099409" : "999";
  expect(await replayCartMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result" });
});
it.each(["quantity", "remove"] as const)("%s cannot claim an overly advanced result version under its exact source outcome rules", async kind => {
  const input = await example(kind); (input.operation.body as CartResponse).version = lineExpected(input).cartVersion + 2;
  expect(await replayCartMutationCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result" });
});
it.each(["parent", "operation"] as const)("throwing %s body cannot forge an HTTP denial", async key => {
  const input = await example(); Object.defineProperty(input[key], "body", { get: () => { throw new MarketHttpError(403, { private: "SENSITIVE" }); } }); const report = await replayCartMutationCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report);
});
it("actual source generation and four replays never use global fetch or a key provider", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network")); for (const kind of cartMutationCaptureKinds) { const report = await replayCartMutationCapture(await cartMutationCaptureExample(kind)); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report); }
  expect(fetcher).not.toHaveBeenCalled();
});
