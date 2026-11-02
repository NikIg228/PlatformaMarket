import { jest } from "@jest/globals";
import type { CartResponse, OfferComparisonResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { cartAddCaptureExample, type CartAddCaptureExample } from "./test-fixtures/cart-add-capture-example";
import { replayCartAddCapture, type CartAddCaptureReport } from "./test-fixtures/cart-add-capture-replay";
import { cartCommandError } from "./test-fixtures/cart-commands";
import { MarketHttpError } from "./market-transport";

const id = "00000000-0000-4000-8000-000000099501";
async function example() { return JSON.parse(JSON.stringify(await cartAddCaptureExample())) as CartAddCaptureExample; }
const page = (value: CartAddCaptureExample) => value.parent.body as WorkspaceCartPage;
const compared = (value: CartAddCaptureExample) => value.comparison.body as OfferComparisonResponse;
const result = (value: CartAddCaptureExample) => value.operation.body as CartResponse["items"][number];
function hidden(target: object, field = "body") { const getter = jest.fn(() => { throw Error("SENSITIVE_CART_ADD_CAPTURE"); }); Object.defineProperty(target, field, { configurable: true, enumerable: true, get: getter }); return getter; }
function flags(report: CartAddCaptureReport) {
  expect(Object.isFrozen(report)).toBe(true);
  expect(report).toMatchObject({ modelAuthorization: "SYNTHETIC_ONLY", nativeBindingPerformed: false, businessEligibilityVerified: false, productionAuthorizationVerified: false, serverAccepted: false, effectProven: false, cartVersionInferred: false, keyProviderAccessed: false, realNetworkRequests: 0, realServerMutations: 0, credentialStoreAccessed: false });
  for (const key of ["scope", "expected", "body", "requestBody", "cartId", "offerId", "quantity", "currency", "version", "result", "idempotencyKey", "error"]) expect(report).not.toHaveProperty(key);
  for (const text of ["SENSITIVE", "00000000-", "90071992547409939999"]) expect(JSON.stringify(report)).not.toContain(text);
}
afterEach(() => jest.restoreAllMocks());

it.each([true, false])("saved add uses actual source selection and command with existing offer=%s", async existing => {
  const input = await cartAddCaptureExample(existing), before = JSON.stringify(input), report = await replayCartAddCapture(input);
  expect(report).toMatchObject({ status: "CONSISTENT_RESPONSE", operationPhase: "result", comparisonGetCalls: 1, cartGetCalls: 1, commandCalls: 1, cartVersionInferred: false, effectProven: false, serverAccepted: false });
  expect(JSON.stringify(input)).toBe(before);
  flags(report);
});
it("an upsert may return a different item UUID while huge money stays as source strings", async () => {
  const input = await example(); result(input).id = id; result(input).quantity = "3.500000";
  const before = JSON.stringify(input), report = await replayCartAddCapture(input);
  expect(report.status).toBe("CONSISTENT_RESPONSE"); expect(JSON.stringify(input)).toBe(before); flags(report);
});
it.each([null, [], {}, { formatVersion: 2 }, { formatVersion: 1, kind: "unknown" }])("invalid envelope remains redacted: %p", async value => { const report = await replayCartAddCapture(value); expect(report.status).toBe("INPUT_INVALID"); flags(report); });
it.each(["root", "scope", "expected", "comparison-query", "comparison-input", "cart-query", "cart-input", "comparison", "parent", "operation"])("extra secret field in %s is rejected before any response access", async field => {
  const input = await example(), a = hidden(input.comparison), b = hidden(input.parent), c = hidden(input.operation);
  const target = field === "root" ? input : field === "scope" ? input.scope : field === "expected" ? input.expected : field === "comparison-query" ? input.comparisonQuery : field === "comparison-input" ? input.comparisonQuery.input : field === "cart-query" ? input.cartQuery : field === "cart-input" ? input.cartQuery.input : input[field as "comparison" | "parent" | "operation"];
  const secret = hidden(target, "headers"), report = await replayCartAddCapture(input); expect(report.status).toBe("INPUT_INVALID");
  for (const getter of [a, b, c, secret]) expect(getter).not.toHaveBeenCalled(); flags(report);
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("invalid scope %s cannot read saved responses", async field => {
  const input = await example(), body = hidden(input.comparison); const scope = { ...input.scope, [field]: field === "generation" ? 0 : field === "environment" ? "http://private.invalid/api" : "SENSITIVE" };
  expect(await replayCartAddCapture({ ...input, scope })).toMatchObject({ status: "INPUT_INVALID", comparisonGetCalls: 0, cartGetCalls: 0, commandCalls: 0 }); expect(body).not.toHaveBeenCalled();
});
it.each(["cartId", "cartVersion", "offerId"] as const)("invalid expected %s cannot read comparison", async field => {
  const input = await example(), body = hidden(input.comparison); Object.assign(input.expected, { [field]: field === "cartVersion" ? 0 : "SENSITIVE" });
  expect((await replayCartAddCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it("comparison buyer override is forbidden without reading its value", async () => {
  const input = await example(), buyer = hidden(input.comparisonQuery.input, "buyerOrganizationId"), body = hidden(input.comparison);
  expect((await replayCartAddCapture(input)).status).toBe("INPUT_INVALID"); expect(buyer).not.toHaveBeenCalled(); expect(body).not.toHaveBeenCalled();
});
it.each(["comparison", "parent", "operation"] as const)("wrong %s method is rejected before any body", async field => {
  const input = await example(), body = hidden(input.comparison); input[field].method = field === "operation" ? "GET" : "POST";
  expect((await replayCartAddCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each([199, 600, "200", 200.5])("invalid operation status %p is rejected before comparison", async status => {
  const input = await example(), body = hidden(input.comparison); Object.assign(input.operation, { httpStatus: status }); expect((await replayCartAddCapture(input)).status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled();
});
it.each(["comparison", "parent", "operation"] as const)("wrong actual %s path cannot read that response", async field => {
  const input = await example(), body = hidden(input[field]); input[field].path += "?SENSITIVE=true";
  const report = await replayCartAddCapture(input); expect(report.status).toBe("INPUT_INVALID"); expect(body).not.toHaveBeenCalled(); flags(report);
});
it.each(["id", "version", "buyerOrganizationId"] as const)("selected parent %s is bound before private cart items", async field => {
  const input = await example(), cart = page(input).current!; Object.assign(cart, { [field]: field === "version" ? cart.version + 1 : id }); const items = hidden(cart, "items"), receipt = hidden(input.operation);
  expect(await replayCartAddCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", parentPhase: "contract-error", commandCalls: 0 }); expect(items).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it("foreign historical cart is rejected before its private lines", async () => {
  const input = await example(), cart = JSON.parse(JSON.stringify(page(input).current!)) as CartResponse; cart.id = id; cart.buyerOrganizationId = id; page(input).items.push(cart); const items = hidden(cart, "items");
  expect(await replayCartAddCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 0 }); expect(items).not.toHaveBeenCalled();
});
it.each(["cart", "offer"])("missing %s context cannot read command request or receipt", async missing => {
  const input = await example(); if (missing === "cart") page(input).current = null; else input.expected.offerId = id;
  const request = hidden(input.operation, "requestBody"), receipt = hidden(input.operation);
  expect(await replayCartAddCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0 }); expect(request).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it.each(["stock", "minimum", "increment", "currency", "checkout", "duplicate-offer"])("source %s eligibility guard prevents reading receipt", async changed => {
  const input = await example(), offer = compared(input).offers[0]!, cart = page(input).current!;
  if (changed === "stock") offer.availability.forEach(row => { row.quantityAvailable = "0"; });
  if (changed === "minimum") offer.minimumOrderQuantity = "0";
  if (changed === "increment") offer.orderIncrement = "0";
  if (changed === "currency") { cart.currency = "USD"; cart.items.forEach(item => { item.currency = "USD"; }); }
  if (changed === "checkout") cart.checkout = { id, status: "PENDING" };
  if (changed === "duplicate-offer") cart.items.push({ ...cart.items[0]!, id });
  const receipt = hidden(input.operation); expect(await replayCartAddCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", commandCalls: 0 }); expect(receipt).not.toHaveBeenCalled();
});
it.each([[1, "offer-minimum"], [2, "offer-step"], [1.5000001, "step"]] as const)("quantity %s follows source rules (%s) without receipt access", async (quantity, issue) => {
  const input = await example(); (input.operation.requestBody as { quantity: number }).quantity = quantity; const receipt = hidden(input.operation);
  expect(await replayCartAddCapture(input)).toMatchObject({ status: "UNSUPPORTED_CONTEXT", quantityIssueKind: issue, commandCalls: 0 }); expect(receipt).not.toHaveBeenCalled();
});
it.each(["expectedVersion", "currency", "idempotencyKey", "price", "note", "headers"])("extra request %s is rejected before secret getter and receipt", async key => {
  const input = await example(), secret = hidden(input.operation.requestBody as object, key), receipt = hidden(input.operation);
  expect((await replayCartAddCapture(input)).status).toBe("INPUT_INVALID"); expect(secret).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it.each([0, -1, "3.5", null])("invalid wire quantity %p cannot inspect receipt", async quantity => {
  const input = await example(); Object.assign(input.operation.requestBody as object, { quantity }); const receipt = hidden(input.operation);
  expect((await replayCartAddCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it("request offer drift fails exact source input comparison before receipt", async () => {
  const input = await example(); (input.operation.requestBody as { offerId: string }).offerId = id; const receipt = hidden(input.operation);
  expect((await replayCartAddCapture(input)).status).toBe("INPUT_INVALID"); expect(receipt).not.toHaveBeenCalled();
});
it.each(["comparison", "parent"] as const)("%s HTTP rejection uses source read classification and prevents POST", async field => {
  for (const status of [401, 403, 404, 429, 500]) {
    const input = await example(); input[field].httpStatus = status; input[field].body = cartCommandError(status).payload; const request = hidden(input.operation, "requestBody"), receipt = hidden(input.operation);
    expect(await replayCartAddCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", commandCalls: 0 }); expect(request).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
  }
});
it.each([[400, "validation"], [401, "authentication"], [403, "denied"], [404, "not-found"], [409, "conflict"], [429, undefined], [500, undefined]] as const)("command HTTP %s retains source issue %s", async (status, issue) => {
  const input = await example(); input.operation.httpStatus = status; input.operation.body = cartCommandError(status).payload; const report = await replayCartAddCapture(input);
  expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: status >= 429 ? "unknown" : "rejected", commandCalls: 1 }); expect(report.operationIssue).toBe(issue); flags(report);
});
it.each(["cartId", "offerId"] as const)("wrong receipt %s fails before private money or quantity", async field => {
  const input = await example(), body = result(input); body[field] = id; const quantity = hidden(body, "quantity"), money = hidden(body, "unitPriceMinor");
  expect(await replayCartAddCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result" }); expect(quantity).not.toHaveBeenCalled(); expect(money).not.toHaveBeenCalled();
});
it.each(["quantity", "currency", "unitPriceMinor"] as const)("invalid returned %s cannot prove effect", async field => {
  const input = await example(); result(input)[field] = field === "quantity" ? "4.5" : field === "currency" ? "USD" : "SENSITIVE";
  const report = await replayCartAddCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", operationIssue: "invalid-result" }); flags(report);
});
it.each(["comparison", "parent", "operation"] as const)("throwing %s body cannot forge HTTP denial", async field => {
  const input = await example(); Object.defineProperty(input[field], "body", { get: () => { throw new MarketHttpError(403, { private: "SENSITIVE" }); } });
  const report = await replayCartAddCapture(input); expect(report.status).toBe("INPUT_INVALID"); flags(report);
});
it("source generation and replay never access fetch, key storage or server", async () => {
  const fetcher = jest.spyOn(globalThis, "fetch").mockRejectedValue(Error("Unexpected network")); const report = await replayCartAddCapture(await cartAddCaptureExample()); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report); expect(fetcher).not.toHaveBeenCalled();
});
it.each(["product", "variant"])("wrong comparison %s selector stops before cart read or command", async changed => {
  const input = await example(); if (changed === "product") compared(input).product.id = id; else compared(input).selectedVariantId = id;
  const parent = hidden(input.parent), receipt = hidden(input.operation);
  expect(await replayCartAddCapture(input)).toMatchObject({ status: "CONSUMER_REJECTED", comparisonPhase: "contract-error", cartGetCalls: 0, commandCalls: 0 }); expect(parent).not.toHaveBeenCalled(); expect(receipt).not.toHaveBeenCalled();
});
it("positive source stock is not treated as a new server reservation or quantity ceiling", async () => {
  const input = await example(); compared(input).offers[0]!.availability[0]!.quantityAvailable = "0.1";
  const report = await replayCartAddCapture(input); expect(report.status).toBe("CONSISTENT_RESPONSE"); flags(report);
});
it("a malformed HTTP409 envelope preserves unknown rather than manufacturing conflict", async () => {
  const input = await example(); input.operation.httpStatus = 409; input.operation.body = cartCommandError(403).payload;
  const report = await replayCartAddCapture(input); expect(report).toMatchObject({ status: "CONSUMER_REJECTED", operationPhase: "unknown", commandCalls: 1 }); expect(report.operationIssue).toBeUndefined(); flags(report);
});
