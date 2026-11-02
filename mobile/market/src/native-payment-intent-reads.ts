import { checkoutResponseSchema, type CheckoutResponse } from "../../../packages/schemas/src/core-api";
import { z } from "zod";
import { createMarketOperationScope } from "./market-operation-scope";
import type { ReadScope } from "./read-controller";
import type { PaymentIntentFixtureTarget } from "./payment-intent-fixture-read";
import { decodeNativePaymentTransactions, type NativePaymentTransactions } from "./native-payment-transactions";
const targetSchema = z.object({ paymentIntentId: z.uuid(), checkoutId: z.uuid() }).strict();
const bindingSchema = z.object({ id: z.uuid(), checkoutId: z.uuid(), buyerOrganizationId: z.uuid(), providerId: z.uuid() });
const checkoutIdentitySchema = z.object({ id: z.uuid(), buyerOrganizationId: z.uuid(), currency: z.string().regex(/^[A-Z]{3}$/) });
const providerIdentitySchema = z.object({ id: z.uuid() });
const detailsSchema = z.object({
  status: z.enum(["DRAFT", "AWAITING_CONFIRMATION", "PENDING", "PROCESSING", "AUTHORIZED", "PARTIALLY_CAPTURED", "CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "CANCELLED", "EXPIRED"]),
  totalAmountMinor: z.string().regex(/^-?\d{1,20}$/), currency: z.string().regex(/^[A-Z]{3}$/),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), expiresAt: z.iso.datetime().nullable(),
  provider: z.object({ id: z.uuid(), name: z.string(), code: z.string() }),
});
export type NativePaymentIntent = Readonly<z.output<typeof bindingSchema> & Omit<z.output<typeof detailsSchema>, "provider"> & { provider: Readonly<z.output<typeof detailsSchema>["provider"]> }>;
export type NativeOrderCheckoutTarget = Readonly<{ orderId: string; checkoutId: string }>;
export type NativePaymentIntentReads = Readonly<{ available(scope: ReadScope): boolean; read(scope: ReadScope, target: PaymentIntentFixtureTarget): Promise<NativePaymentIntent>; readTransactions(scope: ReadScope, target: PaymentIntentFixtureTarget): Promise<NativePaymentTransactions>; readCheckoutForOrder(scope: ReadScope, target: NativeOrderCheckoutTarget): Promise<CheckoutResponse> }>;
const orderCheckoutTargetSchema = z.object({ orderId: z.uuid(), checkoutId: z.uuid() }).strict();
const checkoutOrderIdsSchema = z.object({ id: z.uuid(), checkoutId: z.uuid(), buyerOrganizationId: z.uuid() });
const checkoutSourceIdsSchema = z.object({ id: z.uuid(), cartId: z.uuid(), buyerOrganizationId: z.uuid(), cart: z.object({ id: z.uuid(), buyerOrganizationId: z.uuid() }), supplierOrders: z.array(checkoutOrderIdsSchema) });
const checkoutProjectionSchema = checkoutResponseSchema.strip().extend({ cart: checkoutResponseSchema.shape.cart.strip(), supplierOrders: z.array(checkoutResponseSchema.shape.supplierOrders.element.strip()) });
const pointerIdsSchema = z.object({ id: z.uuid(), checkoutId: z.uuid(), buyerOrganizationId: z.uuid() });
function sourceCheckoutIntentPointer(checkout: CheckoutResponse, buyer: string): { kind: "none" | "unavailable" } | { kind: "available"; id: string; status: string } {
  const raw = checkout.paymentIntent; if (raw === null) return { kind: "none" };
  const ids = pointerIdsSchema.safeParse(raw);
  if (!ids.success || ids.data.checkoutId !== checkout.id || ids.data.buyerOrganizationId !== buyer) return { kind: "unavailable" };
  const status = z.object({ status: z.string() }).safeParse(raw);
  return status.success ? { kind: "available", id: ids.data.id, status: status.data.status } : { kind: "unavailable" };
}
export function decodeNativeOrderCheckout(raw: unknown, scope: ReadScope, target: NativeOrderCheckoutTarget): CheckoutResponse {
  try {
    const identity = checkoutSourceIdsSchema.safeParse(raw);
    if (!identity.success) throw Error("contract"); const source = identity.data;
    if (source.id !== target.checkoutId || source.buyerOrganizationId !== scope.organizationId || source.cart.id !== source.cartId || source.cart.buyerOrganizationId !== scope.organizationId || source.supplierOrders.some(row => row.checkoutId !== source.id || row.buyerOrganizationId !== scope.organizationId) || !source.supplierOrders.some(row => row.id === target.orderId) || new Set(source.supplierOrders.map(row=>row.id)).size !== source.supplierOrders.length) throw Error("contract");
    const value = checkoutResponseSchema.parse(raw), pointer = sourceCheckoutIntentPointer(value, scope.organizationId), typed = checkoutProjectionSchema.parse(raw);
    if (typed.cart.items.some(row=>row.cartId!==typed.cartId)) throw Error("contract");
    const paymentIntent = pointer.kind === "none" ? null : pointer.kind === "available" ? Object.freeze({ id: pointer.id, checkoutId: typed.id, buyerOrganizationId: scope.organizationId, status: pointer.status }) : undefined;
    return Object.freeze({ ...typed, ...(paymentIntent === undefined ? {} : { paymentIntent }) });
  } catch { throw new NativePaymentIntentReadError("contract"); }
}
export type NativePaymentIntentClient = { nativePaymentIntentReads?: NativePaymentIntentReads };
export class NativePaymentIntentReadError extends Error { constructor(readonly code: "scope" | "input" | "contract") { super("Payment intent read is unavailable"); this.name = "NativePaymentIntentReadError"; } }
/** Closed projection of existing PaymentsService.getIntent. No provider URLs, sessions, accounts, transactions or keys escape. */
export function decodeNativePaymentIntent(raw: unknown, scope: ReadScope, target: PaymentIntentFixtureTarget): NativePaymentIntent {
  try {
    const binding = bindingSchema.safeParse(raw);
    if (!binding.success || binding.data.id !== target.paymentIntentId || binding.data.checkoutId !== target.checkoutId || binding.data.buyerOrganizationId !== scope.organizationId || !raw || typeof raw !== "object") throw Error("contract");
    const source = raw as Record<string, unknown>, checkout = checkoutIdentitySchema.safeParse(source.checkout), provider = providerIdentitySchema.safeParse(source.provider);
    // Validate both associations before any display field; a checkout total is not the payable amount.
    if (!checkout.success || checkout.data.id !== target.checkoutId || checkout.data.buyerOrganizationId !== scope.organizationId || !provider.success || provider.data.id !== binding.data.providerId) throw Error("contract");
    const details = detailsSchema.safeParse(raw);
    if (!details.success || details.data.currency !== checkout.data.currency) throw Error("contract");
    return Object.freeze({ ...binding.data, ...details.data, provider: Object.freeze({ ...details.data.provider }) });
  } catch { throw new NativePaymentIntentReadError("contract"); }
}
/** Request capability only. Actual payment.view and buyer access remain server-side. */
export function bindNativePaymentIntentReads(scope: ReadScope, read: (path: string) => Promise<unknown>, isCurrent: () => boolean): Readonly<Required<NativePaymentIntentClient>> {
  const lifetime = createMarketOperationScope(scope, isCurrent, () => new NativePaymentIntentReadError("scope"));
  const port: NativePaymentIntentReads = Object.freeze({
    available(candidate) { try { lifetime.assert(candidate); return true; } catch { return false; } },
    async readCheckoutForOrder(candidate, target) {
      lifetime.assert(candidate); const parsed = orderCheckoutTargetSchema.safeParse(target);
      if (!parsed.success) throw new NativePaymentIntentReadError("input"); const selected = Object.freeze(parsed.data);
      try { const raw = await read(`/checkouts/${encodeURIComponent(selected.checkoutId)}`); lifetime.assert(candidate); return decodeNativeOrderCheckout(raw, lifetime.owner, selected); }
      catch (error) { lifetime.assert(candidate); throw error; }
    },
    async read(candidate, target) {
      lifetime.assert(candidate); const parsed = targetSchema.safeParse(target);
      if (!parsed.success) throw new NativePaymentIntentReadError("input");
      const selected = Object.freeze(parsed.data);
      try { const raw = await read(`/payment-intents/${encodeURIComponent(selected.paymentIntentId)}`); lifetime.assert(candidate); return decodeNativePaymentIntent(raw, lifetime.owner, selected); }
      catch (error) { lifetime.assert(candidate); throw error; }
    },
    async readTransactions(candidate, target) {
      lifetime.assert(candidate); const parsed = targetSchema.safeParse(target);
      if (!parsed.success) throw new NativePaymentIntentReadError("input");
      const selected = Object.freeze(parsed.data);
      try {
        const raw = await read(`/payment-intents/${encodeURIComponent(selected.paymentIntentId)}`); lifetime.assert(candidate);
        const intent = decodeNativePaymentIntent(raw, lifetime.owner, selected);
        try { return decodeNativePaymentTransactions(raw, intent); } catch { throw new NativePaymentIntentReadError("contract"); }
      } catch (error) { lifetime.assert(candidate); throw error; }
    },
  });
  return Object.freeze({ nativePaymentIntentReads: port });
}
export function nativePaymentIntentReadsAvailable(port: NativePaymentIntentReads | undefined, scope: ReadScope): boolean {
  try { return !!port && port.available(scope) === true; } catch { return false; }
}
