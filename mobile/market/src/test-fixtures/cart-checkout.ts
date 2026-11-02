import { cartResponseSchema, checkoutResponseSchema, type CartResponse } from "../../../../packages/schemas/src/core-api";
import type { CartCheckoutInput } from "../cart-command-fixture";
import { savedCheckout } from "./carts";
export function cartCheckoutReceipt(source: CartResponse, input: CartCheckoutInput, status: "PROCESSING" | "COMPLETED" | "FAILED" = "COMPLETED") {
 const body = savedCheckout(undefined,source.id); body.cartId = source.id; body.buyerOrganizationId = source.buyerOrganizationId; body.currency = source.currency; body.idempotencyKey = input.idempotencyKey; body.status = status;
 const cart = cartResponseSchema.parse(source); cart.version = input.expectedVersion! + (status === "PROCESSING" ? 1 : 2); cart.status = status === "PROCESSING" ? "ACTIVE" : status === "FAILED" ? "ABANDONED" : "CHECKED_OUT";
 const {checkout:_checkout,...snapshot} = cart; body.cart = snapshot; body.failureReason = status === "FAILED" ? "SYNTHETIC private reservation failure" : null;
 for (const order of body.supplierOrders) { order.checkoutId = body.id; order.buyerOrganizationId = source.buyerOrganizationId; order.currency = source.currency; }
 return checkoutResponseSchema.parse(body);
}
