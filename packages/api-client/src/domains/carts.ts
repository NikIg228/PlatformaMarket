import type { ClientTransport } from "../transport-contract";
import type { CartResponse, CreateCartRequest, AddCartItemRequest, CartItemResponse, UpdateCartItemRequest, CartVersionRequest, RepriceCartRequest, CartValidationResponse, CheckoutCartRequest, CheckoutResponse, RecoverCartRequest } from "@marketplace/schemas";

export function listCarts(transport: ClientTransport, buyerOrganizationId: string) {
    return transport.get<CartResponse[]>(`/buyers/${buyerOrganizationId}/carts`);
  }

export function createCart(transport: ClientTransport, buyerOrganizationId: string, input: CreateCartRequest) {
    return transport.post<CartResponse>(
      `/buyers/${buyerOrganizationId}/carts`,
      input,
    );
  }

export function addCartItem(transport: ClientTransport, cartId: string, input: AddCartItemRequest) {
    return transport.post<CartItemResponse>(`/carts/${cartId}/items`, input);
  }

export function updateCartItem(transport: ClientTransport, cartId: string, itemId: string, input: UpdateCartItemRequest) {
    return transport.patch<CartResponse>(`/carts/${cartId}/items/${itemId}`, input);
  }

export function removeCartItem(transport: ClientTransport, cartId: string, itemId: string, input: CartVersionRequest) {
    return transport.request<CartResponse>(`/carts/${cartId}/items/${itemId}`, { method: "DELETE", body: JSON.stringify(input) });
  }

export function repriceCart(transport: ClientTransport, cartId: string, input: RepriceCartRequest = {}) {
    return transport.post<CartResponse>(`/carts/${cartId}/reprice`, input);
  }

export function validateCart(transport: ClientTransport, cartId: string) {
    return transport.post<CartValidationResponse>(`/carts/${cartId}/validate`);
  }

export function checkoutCart(transport: ClientTransport, cartId: string, input: CheckoutCartRequest) {
    return transport.post<CheckoutResponse>(`/carts/${cartId}/checkout`, input);
  }

export function getCheckout(transport: ClientTransport, checkoutId: string) {
    return transport.get<CheckoutResponse>(`/checkouts/${checkoutId}`);
  }

export function recoverCart(transport: ClientTransport, cartId: string, input: RecoverCartRequest) {
    return transport.post<CartResponse>(`/carts/${cartId}/recover`, input);
  }
