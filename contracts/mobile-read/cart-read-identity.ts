import type { CartResponse, CheckoutResponse } from "../../packages/schemas/src/core-api";
import { hasRelatedOrderIdentity } from "./order-related-identity";
/** Projection links only; server permission and business policies stay on the server. */
export const hasCartItemIdentity = (cart: Pick<CartResponse, "id" | "items">): boolean => cart.items.every(item => item.cartId === cart.id);
export function hasCheckoutIdentity(checkout: CheckoutResponse): boolean {
  return checkout.cart.id === checkout.cartId && checkout.cart.buyerOrganizationId === checkout.buyerOrganizationId
    && hasCartItemIdentity(checkout.cart)
    && checkout.supplierOrders.every(order => order.checkoutId === checkout.id && order.buyerOrganizationId === checkout.buyerOrganizationId && hasRelatedOrderIdentity(order));
}
