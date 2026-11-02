import { createNativeCartCommands, nativeCartAvailable } from "./native-cart-commands";
import { createMarketSession } from "./market-session";
import type { ReadScope } from "./read-controller";
import { api, response, server, deferred } from "./test-fixtures/market-session";
import { listDraftScope, listDraftId as id } from "./test-fixtures/list-draft";
import { cartCommandError, commandCart } from "./test-fixtures/cart-commands";
import { repriceValidation } from "./test-fixtures/cart-reprice";
const scope: ReadScope = { ...listDraftScope, environment: api }, cart = commandCart(), item = cart.items[0]!, key = id(123001);
function setup(entropy = true) {
  const uuid = jest.fn(() => key), mutate = jest.fn(async (_method: string, _path: string, _body?: Readonly<object>): Promise<unknown> => ({}));
  const binding = createNativeCartCommands(scope, mutate, entropy ? { randomUUID: uuid } : {}, () => true);
  return { uuid, mutate, binding, port: binding.port };
}
it("sends all eight source cart routes with exact methods, versions and reviewed snapshots", async () => {
  const s = setup(), snapshot = repriceValidation(cart).items[0]!.current!, acceptedItems = [{ cartItemId: item.id, snapshot }];
  await s.port.createCart(scope, scope.organizationId, { currency: "KZT" });
  await s.port.recoverCart(scope, cart.id, { expectedVersion: 1 });
  await s.port.addCartItem(scope, cart.id, { offerId: item.offerId, quantity: 2.5 });
  await s.port.updateCartItem(scope, cart.id, item.id, { expectedVersion: 1, quantity: 3.5 });
  await s.port.removeCartItem(scope, cart.id, item.id, { expectedVersion: 1 });
  await s.port.validateCart(scope, cart.id);
  await s.port.repriceCart(scope, cart.id, { expectedVersion: 1, acceptedItems });
  expect(s.uuid).not.toHaveBeenCalled();
  const issued = s.port.nextCheckoutIdempotencyKey(); await s.port.checkoutCart(scope, cart.id, { expectedVersion: 1, idempotencyKey: issued });
  expect(s.mutate.mock.calls).toEqual([
    ["POST", `/buyers/${scope.organizationId}/carts`, { currency: "KZT" }],
    ["POST", `/carts/${cart.id}/recover`, { expectedVersion: 1 }],
    ["POST", `/carts/${cart.id}/items`, { offerId: item.offerId, quantity: 2.5 }],
    ["PATCH", `/carts/${cart.id}/items/${item.id}`, { expectedVersion: 1, quantity: 3.5 }],
    ["DELETE", `/carts/${cart.id}/items/${item.id}`, { expectedVersion: 1 }],
    ["POST", `/carts/${cart.id}/validate`, undefined],
    ["POST", `/carts/${cart.id}/reprice`, { expectedVersion: 1, acceptedItems }],
    ["POST", `/carts/${cart.id}/checkout`, { expectedVersion: 1, idempotencyKey: key }],
  ]); expect(s.uuid).toHaveBeenCalledTimes(1); expect("authorization" in s.port).toBe(false); s.binding.close();
});
it.each(["product", "environment", "userId", "organizationId", "generation"] as const)("blocks a changed %s before a cart write", async field => {
  const s = setup(), wrong = { ...scope, [field]: field === "generation" ? 2 : "SYNTHETIC_OTHER" } as ReadScope;
  expect(s.port.available(wrong)).toBe(false); await expect(s.port.validateCart(wrong, cart.id)).rejects.toMatchObject({ code: "scope" });
  await expect(s.port.updateCartItem(wrong, cart.id, item.id, { expectedVersion: 1, quantity: 2 })).rejects.toMatchObject({ code: "scope" }); expect(s.mutate).not.toHaveBeenCalled(); s.binding.close();
});
it("keeps keyless cart work available without native UUID, while blocking checkout", async () => {
  const s = setup(false); expect(nativeCartAvailable(s.port, scope)).toBe(true); expect(nativeCartAvailable(s.port, scope, true)).toBe(false);
  await s.port.createCart(scope, scope.organizationId, { currency: "KZT" }); await s.port.validateCart(scope, cart.id);
  expect(() => s.port.nextCheckoutIdempotencyKey()).toThrow(); await expect(s.port.checkoutCart(scope, cart.id, { expectedVersion: 1, idempotencyKey: key })).rejects.toMatchObject({ code: "key" }); expect(s.mutate).toHaveBeenCalledTimes(2); s.binding.close();
});
it("rejects another buyer, path injection, missing version and noncanonical checkout before network", async () => {
  const s = setup(); await expect(s.port.createCart(scope, id(123002), { currency: "KZT" })).rejects.toMatchObject({ code: "scope" });
  await expect(s.port.validateCart(scope, "../cart")).rejects.toMatchObject({ code: "input" });
  await expect(s.port.removeCartItem(scope, cart.id, item.id, {} as { expectedVersion: number })).rejects.toMatchObject({ code: "input" });
  await expect(s.port.createCart(scope, scope.organizationId, { currency: " kzt " })).rejects.toMatchObject({ code: "input" });
  s.port.nextCheckoutIdempotencyKey(); await expect(s.port.checkoutCart(scope, cart.id, { expectedVersion: 1, idempotencyKey: ` ${key} ` })).rejects.toMatchObject({ code: "input" }); expect(s.mutate).not.toHaveBeenCalled(); s.binding.close();
});
it("pins checkout key, original version and cart through an unknown response and explicit replay", async () => {
  const s = setup(), input = { expectedVersion: 1, idempotencyKey: s.port.nextCheckoutIdempotencyKey() }; s.mutate.mockRejectedValueOnce(cartCommandError(500));
  await expect(s.port.checkoutCart(scope, cart.id, input)).rejects.toMatchObject({ status: 500 }); expect(s.mutate).toHaveBeenCalledTimes(1);
  await expect(s.port.checkoutCart(scope, cart.id, { ...input, expectedVersion: 2 })).rejects.toMatchObject({ code: "input" });
  await expect(s.port.checkoutCart(scope, id(123003), input)).rejects.toMatchObject({ code: "input" });
  await expect(s.port.checkoutCart(scope, cart.id, { ...input, idempotencyKey: id(123004) })).rejects.toMatchObject({ code: "key" });
  await s.port.checkoutCart(scope, cart.id, input); expect(s.mutate.mock.calls[1]).toEqual(s.mutate.mock.calls[0]); expect(s.uuid).toHaveBeenCalledTimes(1); s.binding.close();
});
it("discards a late private cart body and closes all request capabilities", async () => {
  const s = setup(), pending = deferred<unknown>(); s.mutate.mockImplementationOnce(() => pending.promise);
  const work = s.port.validateCart(scope, cart.id); s.binding.close(); pending.resolve({ private: "SYNTHETIC old cart body" }); await expect(work).rejects.toMatchObject({ code: "scope" });
  expect(s.port.available(scope)).toBe(false); expect(s.port.canIssueCheckoutKey(scope)).toBe(false); expect(() => s.port.nextCheckoutIdempotencyKey()).toThrow();
});
it.each(["quantity", "remove", "validate", "checkout"] as const)("does not refresh or replay cart %s after business401", async action => {
  const path = `/carts/${cart.id}/${action === "quantity" || action === "remove" ? `items/${item.id}` : action}`, fetcher = server(route => route === path ? response(cartCommandError(401).payload, 401) : undefined), manager = createMarketSession(api, fetcher, Date.now, { randomUUID: () => key });
  await manager.start(); const session = manager.getSnapshot().session!, port = session.client.nativeCartCommands!;
  const work = action === "quantity" ? port.updateCartItem(session.scope, cart.id, item.id, { expectedVersion: 1, quantity: 2 }) : action === "remove" ? port.removeCartItem(session.scope, cart.id, item.id, { expectedVersion: 1 }) : action === "validate" ? port.validateCart(session.scope, cart.id) : port.checkoutCart(session.scope, cart.id, { expectedVersion: 1, idempotencyKey: port.nextCheckoutIdempotencyKey() });
  await expect(work).rejects.toBeDefined(); expect(fetcher.mock.calls.filter(([url]) => url.endsWith(path))).toHaveLength(1); expect(fetcher.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false); expect(manager.getSnapshot().phase).toBe("signed-out");
});
