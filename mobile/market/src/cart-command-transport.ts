import { z } from "zod";
import { createCartSchema, addCartItemSchema, updateCartItemSchema, cartVersionSchema, recoverCartSchema, repriceCartSchema, checkoutCartSchema } from "../../../packages/schemas/src/index";
import { createMarketOperationScope } from "./market-operation-scope";
import type { ReadScope } from "./read-controller";
export type CartMutationMethod = "POST" | "PATCH" | "DELETE";
export class CartCommandTransportError extends Error {
  constructor(readonly code: "scope" | "input") { super(code === "scope" ? "Cart command context is unavailable" : "Invalid reviewed cart command"); this.name = "CartCommandTransportError"; }
}
function decode<T>(schema: z.ZodType<T>, value: unknown): T {
  try { const parsed = schema.safeParse(value); if (parsed.success) return parsed.data; } catch { /* Never expose a caller's private input error. */ }
  throw new CartCommandTransportError("input");
}
function freeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
const explicitCurrency = z.object({ currency: z.string() }).strict();
const explicitCheckout = z.object({ expectedVersion: cartVersionSchema.shape.expectedVersion, idempotencyKey: z.string() }).strict();
/** Source cart wire preparation only. No authorization, key generation, totals or automatic retry. */
export function createCartCommandTransport(scope: ReadScope, mutateOnce: (method: CartMutationMethod, path: string, body?: Readonly<object>) => Promise<unknown>, isCurrent: () => boolean) {
  if (typeof mutateOnce !== "function") throw new CartCommandTransportError("scope");
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new CartCommandTransportError("scope")), id = (value: unknown) => encodeURIComponent(decode(z.uuid(), value));
  const request = async (candidate: ReadScope, method: CartMutationMethod, path: string, body?: Readonly<object>) => {
    lifetime.assert(candidate);
    try { const result = await mutateOnce(method, path, body); lifetime.assert(candidate); return result; }
    catch (error) { lifetime.assert(candidate); throw error; }
  };
  return Object.freeze({
    create(candidate: ReadScope, buyerOrganizationId: unknown, input: unknown) {
      lifetime.assert(candidate); const buyer = decode(z.uuid(), buyerOrganizationId);
      if (buyer !== lifetime.owner.organizationId) throw new CartCommandTransportError("scope");
      const raw = decode(explicitCurrency, input), body = decode(createCartSchema.strict(), raw);
      if (raw.currency !== body.currency) throw new CartCommandTransportError("input");
      return request(candidate, "POST", `/buyers/${encodeURIComponent(lifetime.owner.organizationId)}/carts`, freeze(body));
    },
    add(candidate: ReadScope, cartId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(cartId), body = decode(addCartItemSchema.strict(), input);
      return request(candidate, "POST", `/carts/${target}/items`, freeze(body));
    },
    update(candidate: ReadScope, cartId: unknown, itemId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(cartId), item = id(itemId), body = decode(updateCartItemSchema, input);
      return request(candidate, "PATCH", `/carts/${target}/items/${item}`, freeze(body));
    },
    remove(candidate: ReadScope, cartId: unknown, itemId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(cartId), item = id(itemId), body = decode(cartVersionSchema, input);
      return request(candidate, "DELETE", `/carts/${target}/items/${item}`, freeze(body));
    },
    recover(candidate: ReadScope, cartId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(cartId), body = decode(recoverCartSchema, input);
      return request(candidate, "POST", `/carts/${target}/recover`, freeze(body));
    },
    validate(candidate: ReadScope, cartId: unknown) {
      lifetime.assert(candidate); return request(candidate, "POST", `/carts/${id(cartId)}/validate`);
    },
    reprice(candidate: ReadScope, cartId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(cartId); decode(cartVersionSchema.strip(), input); const body = decode(repriceCartSchema, input);
      return request(candidate, "POST", `/carts/${target}/reprice`, freeze(body));
    },
    checkout(candidate: ReadScope, cartId: unknown, input: unknown) {
      lifetime.assert(candidate); const target = id(cartId), raw = decode(explicitCheckout, input), body = decode(checkoutCartSchema.strict(), raw);
      if (raw.idempotencyKey !== body.idempotencyKey) throw new CartCommandTransportError("input");
      return request(candidate, "POST", `/carts/${target}/checkout`, freeze(body));
    },
    close: lifetime.close,
  });
}
export type CartCommandTransport = ReturnType<typeof createCartCommandTransport>;
