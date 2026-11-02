import { jest } from "@jest/globals";
import { createCartCommandTransport, CartCommandTransportError, type CartMutationMethod } from "./cart-command-transport";
import { createMarketTransport, MarketHttpError, type FetchTransport, type MarketRequestMethod } from "./market-transport";
import { createConversationReadTransport } from "./conversation-read-transport";
import { createCartCheckout } from "./cart-checkout-fixture";
import { createCartValidation } from "./cart-validation-fixture";
import { createCartQuantityDrafts } from "./cart-quantity-draft";
import type { CartCommandFixture, CartCheckoutInput } from "./cart-command-fixture";
import { cartCommandAuthorization } from "./test-fixtures/cart-commands";
import { cartValidationResult } from "./test-fixtures/cart-validation";
import { savedCart, savedPage, buyerId, cartId } from "./test-fixtures/carts";
import { repriceValidation } from "./test-fixtures/cart-reprice";
import { cartCheckoutReceipt } from "./test-fixtures/cart-checkout";
import { offerConversationScope, offerConversationId as uuid } from "./test-fixtures/offer-conversation";
const scope = Object.freeze({ ...offerConversationScope, organizationId: buyerId, environment: "https://market.example.invalid/api" }), item = uuid(63001), offer = uuid(63002), key = uuid(63003);
function setup() { let live = true; const mutate = jest.fn<(method: CartMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>>().mockResolvedValue({ untouched: true }), model = createCartCommandTransport(scope, mutate, () => live); return { mutate, model, live: (value: boolean) => { live = value; } }; }
it("raw candidate exposes named cart protocols without GET/grant/key or arbitrary HTTP entry", () => {
  const s = setup(); expect(Object.keys(s.model).sort()).toEqual(["add", "checkout", "close", "create", "recover", "remove", "reprice", "update", "validate"]); expect(Object.isFrozen(s.model)).toBe(true); expect(s.mutate).not.toHaveBeenCalled();
});
it("actual source create/add/PATCH/DELETE/recover/validate/reprice/checkout methods and bodies stay distinct", async () => {
  const s = setup(); await s.model.create(scope, buyerId, { currency: "KZT" }); await s.model.add(scope, cartId, { offerId: offer, quantity: 1.25 }); await s.model.update(scope, cartId, item, { expectedVersion: 5, quantity: 1.500001 }); await s.model.remove(scope, cartId, item, { expectedVersion: 5 }); await s.model.recover(scope, cartId, { expectedVersion: 5 }); await s.model.validate(scope, cartId); await s.model.reprice(scope, cartId, { expectedVersion: 5 }); await s.model.checkout(scope, cartId, { expectedVersion: 5, idempotencyKey: key });
  expect(s.mutate.mock.calls).toEqual([["POST", `/buyers/${buyerId}/carts`, { currency: "KZT" }], ["POST", `/carts/${cartId}/items`, { offerId: offer, quantity: 1.25 }], ["PATCH", `/carts/${cartId}/items/${item}`, { expectedVersion: 5, quantity: 1.500001 }], ["DELETE", `/carts/${cartId}/items/${item}`, { expectedVersion: 5 }], ["POST", `/carts/${cartId}/recover`, { expectedVersion: 5 }], ["POST", `/carts/${cartId}/validate`, undefined], ["POST", `/carts/${cartId}/reprice`, { expectedVersion: 5 }], ["POST", `/carts/${cartId}/checkout`, { expectedVersion: 5, idempotencyKey: key }]]);
  expect(s.mutate.mock.calls.every(row => row[2] === undefined || Object.isFrozen(row[2]))).toBe(true);
});
it.each([{}, { currency: " kzt " }, { currency: "KZT " }, { currency: "kzt" }, { currency: "KZT", buyerOrganizationId: item }])("create requires explicit canonical source currency and no actor field:%p", input => {
  const s = setup(); expect(() => s.model.create(scope, buyerId, input)).toThrow(CartCommandTransportError); expect(s.mutate).not.toHaveBeenCalled();
});
it.each([{ offerId: "bad", quantity: 1 }, { offerId: offer, quantity: 0 }, { offerId: offer, quantity: 1000001 }, { offerId: offer, quantity: 1, expectedVersion: 5 }, { offerId: offer, quantity: 1, idempotencyKey: key }])("add retains actual keyless/versionless source input:%p", input => {
  const s = setup(); expect(() => s.model.add(scope, cartId, input)).toThrow(CartCommandTransportError); expect(s.mutate).not.toHaveBeenCalled();
});
it.each([{ expectedVersion: 0, quantity: 1 }, { expectedVersion: 5, quantity: 0 }, { expectedVersion: 5, quantity: 1.0000001 }, { expectedVersion: 5, quantity: 1, idempotencyKey: key }])("PATCH uses captured version and source quantity granularity:%p", input => {
  const s = setup(); expect(() => s.model.update(scope, cartId, item, input)).toThrow(CartCommandTransportError); expect(s.mutate).not.toHaveBeenCalled();
});
it.each(["remove", "recover"] as const)("%s cannot receive an invented UUID or missing source version", method => {
  const s = setup(); for (const input of [{}, { expectedVersion: 0 }, { expectedVersion: 5, idempotencyKey: key }]) expect(() => method === "remove" ? s.model.remove(scope, cartId, item, input) : s.model.recover(scope, cartId, input)).toThrow(CartCommandTransportError); expect(s.mutate).not.toHaveBeenCalled();
});
it.each([{ idempotencyKey: key }, { expectedVersion: 0, idempotencyKey: key }, { expectedVersion: 5, idempotencyKey: "short" }, { expectedVersion: 5, idempotencyKey: ` ${key} ` }, { expectedVersion: 5, idempotencyKey: key, addressId: item }, { expectedVersion: 5, idempotencyKey: key, currency: "USD" }])("checkout preserves exact selected source fields without delivery/currency/key normalization:%p", input => {
  const s = setup(); expect(() => s.model.checkout(scope, cartId, input)).toThrow(CartCommandTransportError); expect(s.mutate).not.toHaveBeenCalled();
});
it("reprice retains exact large minor strings, tax/commercial terms and promotion snapshot without calculation", async () => {
  const s = setup(), cart = savedCart(), snapshot = repriceValidation(cart).items[0]!.current!, input = { expectedVersion: cart.version, acceptedItems: [{ cartItemId: cart.items[0]!.id, snapshot }] }, original = JSON.stringify(input); await s.model.reprice(scope, cart.id, input);
  const body = s.mutate.mock.calls[0]![2] as typeof input; expect(body).toEqual(JSON.parse(original)); expect(body.acceptedItems[0]!.snapshot.unitPriceMinor).toBe("5800000000000000000"); expect(body.acceptedItems[0]!.snapshot.tax!.vatMinor).toBe("1600000000000000000");
  expect(Object.isFrozen(body.acceptedItems)).toBe(true); expect(Object.isFrozen(body.acceptedItems[0]!.snapshot)).toBe(true); expect(Object.isFrozen(body.acceptedItems[0]!.snapshot.promotion!.gift)).toBe(true); expect(Object.isFrozen(input)).toBe(false);
  snapshot.unitPriceMinor = "1"; expect(body.acceptedItems[0]!.snapshot.unitPriceMinor).toBe("5800000000000000000");
});
it.each(["missing-version", "duplicate-item", "invalid-snapshot", "extra-field"])("reprice rejects%s without posting", variant => {
  const s = setup(), cart = savedCart(), snapshot = repriceValidation(cart).items[0]!.current!, input: Record<string, unknown> = { expectedVersion: cart.version, acceptedItems: [{ cartItemId: item, snapshot }] };
  if (variant === "missing-version") delete input.expectedVersion; if (variant === "duplicate-item") input.acceptedItems = [{ cartItemId: item, snapshot }, { cartItemId: item, snapshot }]; if (variant === "invalid-snapshot") snapshot.unitPriceMinor = "not-money"; if (variant === "extra-field") input.force = true;
  expect(() => s.model.reprice(scope, cartId, input)).toThrow(CartCommandTransportError); expect(s.mutate).not.toHaveBeenCalled();
});
it.each(["add", "recover", "validate", "reprice", "checkout"] as const)("%s rejects arbitrary cart path before request input getters", method => {
  const s = setup(), hidden = jest.fn(() => { throw Error("invalid target body"); }), input = {}; for (const field of ["offerId", "expectedVersion", "idempotencyKey"]) Object.defineProperty(input, field, { get: hidden });
  expect(() => method === "validate" ? s.model.validate(scope, "../other") : s.model[method](scope, "../other", input)).toThrow(CartCommandTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.mutate).not.toHaveBeenCalled();
});
it.each(["update", "remove"] as const)("%s rejects invalid line target before body", method => {
  const s = setup(), hidden = jest.fn(() => { throw Error("unbound item body"); }), input = {}; Object.defineProperty(input, "expectedVersion", { get: hidden }); expect(() => s.model[method](scope, cartId, "bad", input)).toThrow(CartCommandTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.mutate).not.toHaveBeenCalled();
});
it.each(["userId", "organizationId", "generation", "environment"] as const)("wrong%s scope blocks cart input and private call", field => {
  const s = setup(), candidate = { ...scope, [field]: field === "generation" ? scope.generation + 1 : field === "environment" ? "https://other.example.invalid/api" : uuid(63004) }, input = {}, hidden = jest.fn(() => { throw Error("foreign checkout body"); }); Object.defineProperty(input, "expectedVersion", { get: hidden }); expect(() => s.model.checkout(candidate, cartId, input)).toThrow(CartCommandTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.mutate).not.toHaveBeenCalled();
});
it.each(["fulfilled", "rejected"] as const)("late%s result after scope loss cannot expose private cart/checkout/error data", async outcome => {
  const s = setup(); let yes!: (value: unknown) => void, no!: (value: unknown) => void; s.mutate.mockImplementationOnce(() => new Promise((resolve, reject) => { yes = resolve; no = reject; })); const work = s.model.checkout(scope, cartId, { expectedVersion: 5, idempotencyKey: key }); s.live(false);
  const hidden = jest.fn(() => { throw Error("late private cart"); }), raw = {}; for (const field of ["id", "buyerOrganizationId", "supplierOrders", "items", "payload", "status"]) Object.defineProperty(raw, field, { get: hidden }); if (outcome === "fulfilled") yes(raw); else no(raw); await expect(work).rejects.toThrow(CartCommandTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.mutate).toHaveBeenCalledTimes(1);
});
it.each([401, 403, 409, "network"] as const)("active%s failure is preserved without implicit replay", async status => {
  const s = setup(), failure = status === "network" ? Error("lost") : new MarketHttpError(status, { statusCode: status, message: "SYNTHETIC failure" }); s.mutate.mockRejectedValueOnce(failure); await expect(s.model.checkout(scope, cartId, { expectedVersion: 5, idempotencyKey: key })).rejects.toBe(failure); expect(s.mutate).toHaveBeenCalledTimes(1);
});
it("explicit checkout replay preserves same source version/key while no response-driven GET is possible", async () => {
  const s = setup(), input = { expectedVersion: 5, idempotencyKey: key }, raw = {}, hidden = jest.fn(() => { throw Error("unbound receipt body"); }); Object.defineProperty(raw, "supplierOrders", { get: hidden }); s.mutate.mockRejectedValueOnce(Error("lost")).mockResolvedValueOnce(raw); await expect(s.model.checkout(scope, cartId, input)).rejects.toThrow("lost"); expect(await s.model.checkout(scope, cartId, input)).toBe(raw); expect(s.mutate.mock.calls[1]).toEqual(s.mutate.mock.calls[0]); expect(hidden).not.toHaveBeenCalled();
});
it("create route uses immutable captured organization even if original caller object is edited", async () => {
  const original = { ...scope, organizationId: String(scope.organizationId) }, mutate = jest.fn<(method: CartMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>>().mockResolvedValue({}), model = createCartCommandTransport(original, mutate, () => true); original.organizationId = item; await model.create(scope, buyerId, { currency: "KZT" }); expect(mutate).toHaveBeenCalledWith("POST", `/buyers/${buyerId}/carts`, { currency: "KZT" }); model.close();
});
it("closing a cart port cannot close a separate conversation reader", async () => {
  const s = setup(), read = jest.fn<(path: string) => Promise<unknown>>().mockResolvedValue({}), reader = createConversationReadTransport(scope, read, () => true); s.model.close(); expect(() => s.model.validate(scope, cartId)).toThrow(CartCommandTransportError); await reader.get(scope, item); expect(read).toHaveBeenCalledTimes(1); expect(s.mutate).not.toHaveBeenCalled(); reader.close();
});
it("existing native HTTP transport carries actual PATCH/DELETE bodies and bodyless validate", async () => {
  const fetcher = jest.fn<FetchTransport>().mockResolvedValue({ status: 200, ok: true, text: async () => "{}" }), http = createMarketTransport(scope.environment, fetcher), model = createCartCommandTransport(scope, (method, path, body) => http.request(path, { method, body, token: "SYNTHETIC-token", csrf: "SYNTHETIC-csrf" }), () => true);
  await model.update(scope, cartId, item, { expectedVersion: 5, quantity: 2.5 }); await model.remove(scope, cartId, item, { expectedVersion: 5 }); await model.validate(scope, cartId); expect(fetcher.mock.calls.map(row => row[1].method)).toEqual(["PATCH", "DELETE", "POST"]); expect(JSON.parse(fetcher.mock.calls[0]![1].body as string)).toEqual({ expectedVersion: 5, quantity: 2.5 }); expect(JSON.parse(fetcher.mock.calls[1]![1].body as string)).toEqual({ expectedVersion: 5 }); expect(fetcher.mock.calls[2]![1].body).toBeUndefined();
  for (const [, request] of fetcher.mock.calls) { expect(request.credentials).toBe("omit"); const headers = request.headers as Record<string, string>; expect(headers.authorization).toBe("Bearer SYNTHETIC-token"); expect(headers["x-user-id"]).toBeUndefined(); } model.close();
});
it("native method allowlist blocks an unsupported verb before fetch", async () => {
  const fetcher = jest.fn<FetchTransport>(), http = createMarketTransport(scope.environment, fetcher); await expect(http.request("/carts", { method: "PUT" as MarketRequestMethod })).rejects.toThrow("Invalid API method"); expect(fetcher).not.toHaveBeenCalled();
});
it("explicit buyer selector must match captured owner before create body is inspected", () => {
  const s = setup(), input = {}, hidden = jest.fn(() => { throw Error("foreign create payload"); }); Object.defineProperty(input, "currency", { get: hidden }); expect(() => s.model.create(scope, item, input)).toThrow(CartCommandTransportError); expect(hidden).not.toHaveBeenCalled(); expect(s.mutate).not.toHaveBeenCalled();
});
it("existing checkout model retains original key and receipt recovery through the raw native protocols", async () => {
  const s = setup(), cart = savedCart(cartId, 3), page = savedPage(cart, []), nextKey = jest.fn(() => key); let receipt: ReturnType<typeof cartCheckoutReceipt> | null = null, checkoutEffects = 0;
  s.mutate.mockImplementation(async (_method, path, body) => { if (path.endsWith("/validate")) return cartValidationResult(cart); if (receipt) return receipt; checkoutEffects++; receipt = cartCheckoutReceipt(cart, body as CartCheckoutInput); throw Error("SYNTHETIC committed checkout response lost"); });
  const fixture: CartCommandFixture = { authorization: { ...cartCommandAuthorization(), scope }, validateCart: s.model.validate, checkoutCart: s.model.checkout, nextCheckoutIdempotencyKey: nextKey }, drafts = createCartQuantityDrafts(scope); drafts.syncCurrent(cart);
  const validation = createCartValidation(scope, fixture, () => page), model = createCartCheckout(scope, fixture, validation, drafts, () => page, async () => page); await validation.validate(page); expect(model.prepare(page)).toBe(true); await model.confirm(cart.id); expect(model.stateFor(cart.id).phase).toBe("unknown"); expect(s.mutate).toHaveBeenCalledTimes(2);
  await model.replay(cart.id); expect(model.stateFor(cart.id).phase).toBe("receipt"); expect(nextKey).toHaveBeenCalledTimes(1); expect(checkoutEffects).toBe(1); expect(s.mutate.mock.calls[2]).toEqual(s.mutate.mock.calls[1]); expect(s.model).not.toHaveProperty("authorization"); model.dispose(); validation.dispose(); drafts.close(); s.model.close();
});
