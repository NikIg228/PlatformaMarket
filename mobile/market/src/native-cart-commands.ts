import { checkoutCartSchema } from "../../../packages/schemas/src/index";
import { createCartCommandTransport, type CartMutationMethod } from "./cart-command-transport";
import { createMarketOperationScope } from "./market-operation-scope";
import { createNativeUuidSource, type NativeUuidProvider } from "./native-uuid-source";
import type { CartCommandFixture, CartCheckoutInput } from "./cart-command-fixture";
import type { ReadScope } from "./read-controller";
export type NativeCartCommands = Readonly<Required<Omit<CartCommandFixture, "authorization">> & {
  available: (scope: ReadScope) => boolean;
  canIssueCheckoutKey: (scope: ReadScope) => boolean;
}>;
export type NativeCartClient = { nativeCartCommands?: NativeCartCommands };
export class NativeCartError extends Error {
  constructor(readonly code: "scope" | "input" | "key") { super("Cart request is unavailable"); this.name = "NativeCartError"; }
}
/** Fixed source cart routes. Scope/request capability does not attest permissions, prices or device support. */
export function createNativeCartCommands(scope: ReadScope, mutateOnce: (method: CartMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>, provider: NativeUuidProvider | undefined, isCurrent: () => boolean) {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativeCartError("scope")), keys = createNativeUuidSource(scope, provider, isCurrent), transport = createCartCommandTransport(scope, mutateOnce, isCurrent), issued = new Set<string>();
  const pinned = new Map<string, Readonly<{ cartId: string; bytes: string; input: CartCheckoutInput }>>();
  const request = async (candidate: ReadScope, work: () => Promise<unknown>) => {
    lifetime.assert(candidate);
    try { const body = await work(); lifetime.assert(candidate); return body; } catch (error) { lifetime.assert(candidate); throw error; }
  };
  const port: NativeCartCommands = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    canIssueCheckoutKey: keys.canIssue,
    nextCheckoutIdempotencyKey() { lifetime.assert(lifetime.owner); const key = keys.next(lifetime.owner); lifetime.assert(lifetime.owner); issued.add(key); return key; },
    createCart: (candidate, buyerId, input) => request(candidate, () => transport.create(candidate, buyerId, input)),
    recoverCart: (candidate, cartId, input) => request(candidate, () => transport.recover(candidate, cartId, input)),
    addCartItem: (candidate, cartId, input) => request(candidate, () => transport.add(candidate, cartId, input)),
    updateCartItem: (candidate, cartId, itemId, input) => request(candidate, () => transport.update(candidate, cartId, itemId, input)),
    removeCartItem: (candidate, cartId, itemId, input) => request(candidate, () => transport.remove(candidate, cartId, itemId, input)),
    validateCart: (candidate, cartId) => request(candidate, () => transport.validate(candidate, cartId)),
    repriceCart: (candidate, cartId, input) => request(candidate, () => transport.reprice(candidate, cartId, input)),
    async checkoutCart(candidate, cartId, input) {
      lifetime.assert(candidate); let body: CartCheckoutInput;
      try { const parsed = checkoutCartSchema.strict().parse(input); if (parsed.idempotencyKey !== input.idempotencyKey) throw Error("input"); body = Object.freeze(parsed); } catch { throw new NativeCartError("input"); }
      lifetime.assert(candidate); if (!issued.has(body.idempotencyKey)) throw new NativeCartError("key"); const bytes = JSON.stringify(body), prior = pinned.get(body.idempotencyKey);
      if (prior && (prior.cartId !== cartId || prior.bytes !== bytes)) throw new NativeCartError("input"); const attempt = prior ?? Object.freeze({ cartId, bytes, input: body });
      if (!prior) pinned.set(body.idempotencyKey, attempt);
      return request(candidate, () => transport.checkout(candidate, cartId, attempt.input));
    },
  });
  return Object.freeze({ port, close() { lifetime.close(); keys.close(); transport.close(); issued.clear(); pinned.clear(); } });
}
export function nativeCartAvailable(port: NativeCartCommands, scope: ReadScope, needsCheckoutKey = false): boolean {
  try { return port.available(scope) === true && (!needsCheckoutKey || port.canIssueCheckoutKey(scope) === true); } catch { return false; }
}
