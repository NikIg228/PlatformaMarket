import { cartItemResponseSchema, cartResponseSchema, type CartResponse } from "../../../../packages/schemas/src/core-api";
import type { CartAddInput, CartCommandFixture, CartQuantityInput, CartVersionInput } from "../cart-command-fixture";
import { listDraftComparison, listDraftScope } from "./list-draft";
import { cartId, failedCartId, savedCart } from "./carts";
export const cartCommandScope = listDraftScope;
export function cartCommandAuthorization(): CartCommandFixture["authorization"] { return { provenance: "synthetic-source-contract", scope: { ...cartCommandScope }, permissions: ["order.create"] }; }
export function commandCart(version = 1, quantity = "2"): CartResponse { const cart = savedCart(cartId, version); cart.items[0]!.quantity = quantity; cart.items[0]!.unitPriceMinor = "90071992547409931234"; cart.items[0]!.totalPriceMinor = "180143985094819862468"; return cart; }
export function quantityCartResult(input: CartQuantityInput, version = input.expectedVersion + 1): CartResponse { const cart = commandCart(version, String(input.quantity)); cart.items[0]!.totalPriceMinor = "90071992547409939999"; return cart; }
export function cartCommandError(status: number, code = status === 409 ? "CART_VERSION_CONFLICT" : "SYNTHETIC_CART_ERROR") { return { status, payload: { statusCode: status, code, message: "SYNTHETIC private cart error", path: "/carts/synthetic/items/synthetic", timestamp: "2026-10-30T01:02:03.000Z" } }; }

export function removedCartResult(source: CartResponse, itemId: string, input: CartVersionInput, version = input.expectedVersion + 1): CartResponse { const value = cartResponseSchema.parse(source); value.version = version; value.items = value.items.filter(item => item.id !== itemId); return value; }

export function createdCartResult(): CartResponse {
 const cart = commandCart(7, "3.000001"); cart.currency = "KZT"; cart.createdById = "00000000-0000-4000-8000-000000000098";
 for (const item of cart.items) item.currency = "KZT";
 return cart;
}
export const recoveryTargetId = "00000000-0000-4000-8000-000000000078";
export function recoveryCartSource(version = 4): CartResponse { return savedCart(failedCartId, version, true); }
export function recoveredCartResult(version = 1): CartResponse { const cart = savedCart(recoveryTargetId, version); cart.items[0]!.id = "00000000-0000-4000-8000-000000000079"; return cart; }
export function cartAddComparison() {
 const comparison = listDraftComparison(), offer = comparison.offers[0]!;
 offer.minimumOrderQuantity = "1.5"; offer.orderIncrement = "1";
 offer.availability = [{ warehouseId: "00000000-0000-4000-8000-000000000891", warehouse: "SYNTHETIC add warehouse", cityId: "00000000-0000-4000-8000-000000000892", quantityAvailable: "100", updatedAt: "2026-10-30T01:02:03.000Z", freshnessExpiresAt: "2099-01-01T00:00:00.000Z" }];
 return comparison;
}
export function addCommandCart(version = 1, quantity = "2", withOffer = true): CartResponse {
 const cart = commandCart(version, quantity), offer = cartAddComparison().offers[0]!;
 cart.currency = offer.price.currency; cart.items[0]!.currency = cart.currency;
 cart.items[0]!.offerId = withOffer ? offer.offerId : "00000000-0000-4000-8000-000000000893";
 return cart;
}
export function addCartItemResult(cart: CartResponse, input: CartAddInput) {
 return cartItemResponseSchema.parse({ ...(cart.items[0] ?? commandCart().items[0]!), id: cart.items.find(item => item.offerId === input.offerId)?.id ?? "00000000-0000-4000-8000-000000000894", cartId: cart.id, offerId: input.offerId, quantity: String(input.quantity), currency: cart.currency, unitPriceMinor: "90071992547409939998", totalPriceMinor: "90071992547409939999", pricingSnapshot: { private: "SYNTHETIC private add pricing" } });
}
