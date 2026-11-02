import { organizationProfileResponseSchema, type OrganizationProfileResponse } from "../../packages/schemas/src/organization-profile";
import { hasCartItemIdentity, hasCheckoutIdentity } from "./cart-read-identity";
import { supportTicketListSchema, supportTicketDetailSchema, type SupportTicketSummary, type SupportTicketDetail } from "../../packages/schemas/src/support-workflow";
import { hasRelatedOrderIdentity, hasWorkflowRelatedIdentity } from "./order-related-identity";
import {
  cartResponseSchema, checkoutResponseSchema, type CartResponse, type CheckoutResponse,
  catalogSearchResponseSchema,
  errorResponseSchema,
  offerComparisonResponseSchema,
  supplierOrderResponseSchema,
  type CatalogSearchResponse,
  type OfferComparisonResponse,
  type SupplierOrderResponse,
} from "../../packages/schemas/src/core-api";
import {
  workspaceOrderPageSchema,
  workspaceOrderStatusSchema,
  workspaceCartPageSchema,
  type WorkspaceOrderPage,
  type WorkspaceCartPage,
} from "../../packages/schemas/src/workspace-reads";
import {
  orderWorkflowResponseSchema,
  type OrderWorkflowResponse,
} from "../../packages/schemas/src/order-workflow";

// Local response-consumption metadata, never credentials or server authorization.
export type ReadScope = Readonly<{
  product: "market";
  environment: string;
  userId: string;
  organizationId: string;
  generation: number;
}>;

export type ReadTarget =
  | Readonly<{ kind: "catalog" }>
  | Readonly<{ kind: "comparison"; productId: string; variantId: string | null }>
  | Readonly<{ kind: "order"; orderId: string }>
  | Readonly<{ kind: "workflow"; orderId: string }>
  | Readonly<{ kind: "workspace-orders" }>
  | Readonly<{ kind: "organization-profile" }>
  | Readonly<{ kind: "workspace-carts" }>
  | Readonly<{ kind: "cart"; cartId: string }>
  | Readonly<{ kind: "checkout"; checkoutId: string; cartId: string }>
  | Readonly<{ kind: "support-tickets" }>
  | Readonly<{ kind: "support-ticket"; ticketId: string; beforeMessageId?: string }>;

export type ReadData =
  | { kind: "catalog"; value: CatalogSearchResponse }
  | { kind: "comparison"; value: OfferComparisonResponse }
  | { kind: "order"; value: SupplierOrderResponse }
  | { kind: "workflow"; value: OrderWorkflowResponse }
  | { kind: "workspace-orders"; value: WorkspaceOrderPage }
  | { kind: "organization-profile"; value: OrganizationProfileResponse }
  | { kind: "workspace-carts"; value: WorkspaceCartPage }
  | { kind: "cart"; value: CartResponse }
  | { kind: "checkout"; value: CheckoutResponse }
  | { kind: "support-tickets"; value: SupportTicketSummary[] }
  | { kind: "support-ticket"; value: SupportTicketDetail };

type ReadyState = { phase: "ready" | "empty" | "unsupported"; read: ReadData };
type ErrorPhase = "contract-error" | "authentication-required" | "denied" | "unavailable" | "retry-limited" | "error";
export type MobileReadState =
  | { phase: "idle" }
  | { phase: "loading"; target: ReadTarget }
  | ReadyState
  | { phase: ErrorPhase; requestId?: string };

export type ReadTicket = Readonly<{ scope: ReadScope; target: ReadTarget }>;
type WireResponse = { status: number; body: unknown };

function sameTarget(left: ReadTarget, right: ReadTarget): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "cart") return right.kind === "cart" && left.cartId === right.cartId;
  if (left.kind === "checkout") return right.kind === "checkout" && left.checkoutId === right.checkoutId && left.cartId === right.cartId;
  if (left.kind === "support-ticket") return right.kind === "support-ticket" && left.ticketId === right.ticketId && left.beforeMessageId === right.beforeMessageId;
  if (left.kind === "order" || left.kind === "workflow") {
    return (right.kind === "order" || right.kind === "workflow") && left.orderId === right.orderId;
  }
  if (left.kind === "comparison") {
    return right.kind === "comparison" && left.productId === right.productId && left.variantId === right.variantId;
  }
  return true;
}

function decode(target: ReadTarget, body: unknown): ReadData | null {
  switch (target.kind) {
    case "catalog": {
      const parsed = catalogSearchResponseSchema.safeParse(body);
      return parsed.success ? { kind: "catalog", value: parsed.data } : null;
    }
    case "comparison": {
      const parsed = offerComparisonResponseSchema.safeParse(body);
      if (!parsed.success || parsed.data.product.id !== target.productId) return null;
      // Never silently substitute another variant for an explicit selection.
      if (target.variantId !== null && parsed.data.selectedVariantId !== target.variantId) return null;
      return { kind: "comparison", value: parsed.data };
    }
    case "order": {
      const parsed = supplierOrderResponseSchema.safeParse(body);
      return parsed.success && parsed.data.id === target.orderId && hasRelatedOrderIdentity(parsed.data) ? { kind: "order", value: parsed.data } : null;
    }
    case "workflow": {
      const parsed = orderWorkflowResponseSchema.safeParse(body);
      return parsed.success && parsed.data.orderId === target.orderId && parsed.data.order.id === target.orderId && hasWorkflowRelatedIdentity(parsed.data)
        ? { kind: "workflow", value: parsed.data } : null;
    }
    case "workspace-orders": {
      const parsed = workspaceOrderPageSchema.safeParse(body);
      return parsed.success ? { kind: "workspace-orders", value: parsed.data } : null;
    }
    case "workspace-carts": {
      const parsed = workspaceCartPageSchema.safeParse(body);
      return parsed.success && (!parsed.data.current || hasCartItemIdentity(parsed.data.current)) && parsed.data.items.every(hasCartItemIdentity)
        ? { kind: "workspace-carts", value: parsed.data } : null;
    }
    case "organization-profile": {
      const parsed = organizationProfileResponseSchema.safeParse(body);
      return parsed.success ? { kind: "organization-profile", value: parsed.data } : null;
    }
    case "cart": {
      const parsed = cartResponseSchema.safeParse(body);
      return parsed.success && parsed.data.id === target.cartId && hasCartItemIdentity(parsed.data) ? { kind: "cart", value: parsed.data } : null;
    }
    case "checkout": {
      const parsed = checkoutResponseSchema.safeParse(body);
      return parsed.success && parsed.data.id === target.checkoutId && parsed.data.cartId === target.cartId && hasCheckoutIdentity(parsed.data) ? { kind: "checkout", value: parsed.data } : null;
    }
    case "support-tickets": {
      const parsed = supportTicketListSchema.safeParse(body);
      return parsed.success ? { kind: "support-tickets", value: parsed.data } : null;
    }
    case "support-ticket": {
      const parsed = supportTicketDetailSchema.safeParse(body);
      if (!parsed.success || parsed.data.id !== target.ticketId) return null;
      // This is the organizational buyer surface, not the operator support console.
      if (parsed.data.messages.some(message => message.ticketId !== target.ticketId || message.isInternal)
        || parsed.data.links.some(link => link.ticketId !== target.ticketId)) return null;
      return { kind: "support-ticket", value: parsed.data };
    }
  }
}

function inOrganization(read: ReadData, organizationId: string): boolean {
  if (read.kind === "organization-profile") return read.value.organizationId === organizationId;
  if (read.kind === "cart" || read.kind === "checkout") return read.value.buyerOrganizationId === organizationId;
  if (read.kind === "support-tickets") return read.value.every(ticket => ticket.organizationId === organizationId);
  if (read.kind === "support-ticket") return read.value.organizationId === organizationId;
  if (read.kind === "order" || read.kind === "workflow") {
    const order = read.kind === "order" ? read.value : read.value.order;
    return order.buyerOrganizationId === organizationId || order.supplierOrganizationId === organizationId;
  }
  if (read.kind === "workspace-orders") {
    return read.value.items.every((order) => order.buyer.id === organizationId || order.supplier.id === organizationId);
  }
  if (read.kind === "workspace-carts") {
    return (!read.value.current || read.value.current.buyerOrganizationId === organizationId)
      && read.value.items.every(cart => cart.buyerOrganizationId === organizationId);
  }
  return true;
}

function readyState(read: ReadData): ReadyState {
  if (read.kind === "support-tickets" && read.value.length === 0) return { phase: "empty", read };
  if ((read.kind === "catalog" || read.kind === "workspace-orders") && read.value.items.length === 0) {
    return { phase: "empty", read };
  }
  if (read.kind === "comparison" && read.value.offers.length === 0) return { phase: "empty", read };
  if (read.kind === "workspace-carts" && read.value.current === null) return { phase: "empty", read };
  // Display support only. The open detail string remains intact; this enum never grants actions.
  if ((read.kind === "order" || read.kind === "workflow") && !workspaceOrderStatusSchema.safeParse(read.value.status).success) {
    return { phase: "unsupported", read };
  }
  return { phase: "ready", read };
}

/** One visible read slot. No HTTP, persistence, timers, mutations or authority decisions. */
export function createMobileReadSlot(initialScope: ReadScope) {
  let scope = Object.freeze({ ...initialScope });
  let pending: ReadTicket | undefined;
  let state: MobileReadState = { phase: "idle" };
  let accepted: { target: ReadTarget; state: ReadyState; version?: number } | undefined;

  function clear(next: MobileReadState) {
    accepted = undefined;
    state = next;
  }

  return {
    getState(): MobileReadState { return state; },
    reset(nextScope: ReadScope) {
      // Also invalidates tickets when the caller resets to identical scope values.
      scope = Object.freeze({ ...nextScope });
      pending = undefined;
      clear({ phase: "idle" });
    },
    begin(target: ReadTarget): ReadTicket {
      const ticket = Object.freeze({ scope, target: Object.freeze({ ...target }) });
      if (accepted && !sameTarget(accepted.target, ticket.target)) accepted = undefined;
      pending = ticket;
      state = { phase: "loading", target: ticket.target };
      return ticket;
    },
    complete(ticket: ReadTicket, response: WireResponse): "applied" | "discarded" {
      // Object identity binds the completion to this exact request and slot, not matching IDs alone.
      if (pending !== ticket) return "discarded";
      pending = undefined;
      if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
        clear({ phase: "contract-error" });
      } else if (response.status < 200 || response.status >= 300) {
        const error = errorResponseSchema.safeParse(response.body);
        if (!error.success || error.data.statusCode !== response.status) {
          clear({ phase: "contract-error" });
        } else {
          const phase: ErrorPhase = response.status === 401 ? "authentication-required"
            : response.status === 403 ? "denied"
            : response.status === 404 ? "unavailable"
            : response.status === 429 ? "retry-limited" : "error";
          clear({ phase, ...(error.data.requestId === undefined ? {} : { requestId: error.data.requestId }) });
        }
      } else {
        const read = decode(ticket.target, response.body);
        if (!read || !inOrganization(read, scope.organizationId)) {
          clear({ phase: "contract-error" });
        } else {
          const version = read.kind === "order" || read.kind === "workflow" || read.kind === "support-ticket" || read.kind === "cart" || read.kind === "organization-profile" ? read.value.version
            : read.kind === "workspace-carts" ? read.value.current?.version : undefined;
          const sameEntity = read.kind !== "workspace-carts" || (accepted?.state.read.kind === "workspace-carts"
            && accepted.state.read.value.current?.id === read.value.current?.id);
          if (sameEntity && version !== undefined && accepted?.version !== undefined && version < accepted.version) {
            state = accepted.state;
          } else {
            state = readyState(read);
            accepted = { target: ticket.target, state, version };
          }
        }
      }
      return "applied";
    },
    fail(ticket: ReadTicket): "applied" | "discarded" {
      if (pending !== ticket) return "discarded";
      pending = undefined;
      clear({ phase: "error" });
      return "applied";
    },
  };
}

/** Exact read selection only; availability and price are not purchase authorization. */
export function selectComparedOffer(comparison: OfferComparisonResponse, variantId: string, offerId: string) {
  if (comparison.selectedVariantId !== variantId || !comparison.variants.some((variant) => variant.id === variantId)) return null;
  return comparison.offers.find((offer) => offer.variantId === variantId && offer.offerId === offerId) ?? null;
}
