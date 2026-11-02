import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cartItemResponseSchema, cartResponseSchema, checkoutResponseSchema } from "../../../../packages/schemas/src/core-api";
import { workspaceCartPageSchema } from "../../../../packages/schemas/src/workspace-reads";
import { orderWorkflowResponseSchema } from "../../../../packages/schemas/src/order-workflow";
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const template = () => orderWorkflowResponseSchema.parse(JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === "order-workflow-minimal")!.payload)));
export const cartId = "00000000-0000-4000-8000-000000000040", failedCartId = "00000000-0000-4000-8000-000000000041", checkoutId = "00000000-0000-4000-8000-000000000050";
export const buyerId = "00000000-0000-4000-8000-000000000004";
export function savedCart(id = cartId, version = 1, failed = false) {
  const item = template().order.items[0]!, date = "2026-10-29T01:02:03.000Z";
  return cartResponseSchema.parse({ id, buyerOrganizationId: buyerId, version, currency: item.currency, status: failed ? "ABANDONED" : "ACTIVE", createdById: null,
    items: [cartItemResponseSchema.parse({ id: item.id, cartId: id, offerId: item.offerId, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, totalPriceMinor: item.totalPriceMinor, currency: item.currency, priceSource: "SYNTHETIC_SAVED", priceRuleId: null, pricingSnapshot: { private: "SYNTHETIC private pricing" }, createdAt: date, updatedAt: date })],
    checkout: failed ? { id: checkoutId, status: "FAILED" } : null, createdAt: date, updatedAt: date });
}
export function savedPage(current: ReturnType<typeof savedCart> | null = savedCart(), items = [savedCart(failedCartId, 2, true)], nextCursor: string | null = null) {
  return workspaceCartPageSchema.parse({ current, items, nextCursor });
}
export function savedCheckout(id = checkoutId, parentId = failedCartId) {
  const cart = savedCart(parentId, 2, true); const { checkout: _reference, ...snapshot } = cart;
  const order = template().order; order.checkoutId = id;
  return checkoutResponseSchema.parse({ id, cartId: parentId, buyerOrganizationId: buyerId, totalAmountMinor: "90071992547409931234", currency: "USD", status: "FAILED", idempotencyKey: "SYNTHETIC private idempotency", failureReason: "SYNTHETIC private failure", cart: snapshot, supplierOrders: [order], createdAt: cart.createdAt, updatedAt: cart.updatedAt, paymentIntent: { secret: "SYNTHETIC private payment", url: "https://private.example.invalid/secret" } });
}
