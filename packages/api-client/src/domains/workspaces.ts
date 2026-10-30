import type { ClientTransport } from "../transport-contract";
import { withQuery } from "../query-path";
import type { WorkspacePageQuery, WorkspaceCorrectionOfferPage, WorkspaceInventoryQuery, WorkspaceInventoryPage, WorkspaceLotPage, WorkspaceReservationPage, WorkspaceOverridePage, WorkspaceOrderQuery, WorkspaceOrderPage, WorkspaceOfferQuery, WorkspaceOfferPage, WorkspaceOffer, WorkspaceCartPage, CartResponse, WorkspaceSummary, CommerceAnalyticsQuery, CommerceAnalyticsResponse } from "@marketplace/schemas";

export function workspaceCorrectionOffers(transport: ClientTransport, query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) {
    return transport.get<WorkspaceCorrectionOfferPage>(withQuery(`/workspaces/supplier/correction-offers`, query), options);
  }

export function workspaceInventory(transport: ClientTransport, query: WorkspaceInventoryQuery = {}, options?: Pick<RequestInit, "signal">) {
    return transport.get<WorkspaceInventoryPage>(withQuery(`/workspaces/supplier/inventory`, query), options);
  }

export function workspaceLots(transport: ClientTransport, balanceId: string, query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) {
    return transport.get<WorkspaceLotPage>(withQuery(`/workspaces/supplier/inventory/${encodeURIComponent(balanceId)}/lots`, query), options);
  }

export function workspaceReservations(transport: ClientTransport, balanceId: string, query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) {
    return transport.get<WorkspaceReservationPage>(withQuery(`/workspaces/supplier/inventory/${encodeURIComponent(balanceId)}/reservations`, query), options);
  }

export function workspaceOverrides(transport: ClientTransport, query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) {
    return transport.get<WorkspaceOverridePage>(withQuery(`/workspaces/supplier/inventory-overrides`, query), options);
  }

export function workspaceOrders(transport: ClientTransport, role: "buyer" | "supplier", query: WorkspaceOrderQuery = {}, options?: Pick<RequestInit, "signal">) {
    return transport.get<WorkspaceOrderPage>(withQuery(`/workspaces/${role}/orders`, query), options);
  }

export function workspaceOffers(transport: ClientTransport, query: WorkspaceOfferQuery = {}, options?: Pick<RequestInit, "signal">) {
    return transport.get<WorkspaceOfferPage>(withQuery("/workspaces/supplier/offers", query), options);
  }

export function workspaceOffer(transport: ClientTransport, offerId: string, options?: Pick<RequestInit, "signal">) {
    return transport.get<WorkspaceOffer>(`/workspaces/supplier/offers/${offerId}`, options);
  }

export function workspaceCarts(transport: ClientTransport, query: WorkspacePageQuery = {}, options?: Pick<RequestInit, "signal">) {
    return transport.get<WorkspaceCartPage>(withQuery("/workspaces/buyer/carts", query), options);
  }

export function workspaceCart(transport: ClientTransport, cartId: string, options?: Pick<RequestInit, "signal">) {
    return transport.get<CartResponse>(`/workspaces/buyer/carts/${cartId}`, options);
  }

export function workspaceSummary(transport: ClientTransport, options?: Pick<RequestInit, "signal">) {
    return transport.get<WorkspaceSummary>("/workspaces/supplier/summary", options);
  }

export function commerceAnalytics(transport: ClientTransport, query: CommerceAnalyticsQuery, options?: Pick<RequestInit, "signal">) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    return transport.get<CommerceAnalyticsResponse>(`/commerce-analytics?${params}`, options);
  }
