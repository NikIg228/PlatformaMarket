import { supportTicketQuerySchema, supportMessageQuerySchema, type SupportTicketSummary } from "../../packages/schemas/src/support-workflow";
import type { z } from "zod";
import type { CompareOffersRequest, SearchCatalogRequest } from "../../packages/schemas/src/index";
import { workspaceOrderQuerySchema, workspacePageQuerySchema, type WorkspaceOrderQuery, type WorkspacePageQuery } from "../../packages/schemas/src/workspace-reads";
import { createMobileReadSlot, type ReadScope, type ReadTarget } from "./read-adapter";

// A consumer port for existing read methods, not a second API or auth implementation.
// Unknown at the response boundary forces every successful read through the real schemas.
export type MobileReadClient = {
  searchCatalog(input: SearchCatalogRequest): Promise<unknown>;
  compareOffers(input: CompareOffersRequest): Promise<unknown>;
  workspaceOrders(role: "buyer", query: WorkspaceOrderQuery): Promise<unknown>;
  getOrderWorkflow(orderId: string): Promise<unknown>;
  workspaceCarts?(query: WorkspacePageQuery): Promise<unknown>;
  workspaceCart?(cartId: string): Promise<unknown>;
  getOrganizationProfile?(): Promise<unknown>;
  getCheckout?(checkoutId: string): Promise<unknown>;
  supportTickets?(status?: SupportTicketSummary["status"], offset?: number, options?: { q?: string; sort?: "queue" | "recent" }): Promise<unknown>;
  supportTicket?(ticketId: string, beforeMessageId?: string): Promise<unknown>;
};

export type MobileReadQuery =
  | { kind: "catalog"; input: Readonly<Omit<SearchCatalogRequest, "buyerOrganizationId">> }
  | { kind: "comparison"; input: Readonly<Omit<CompareOffersRequest, "buyerOrganizationId">> }
  | { kind: "workspace-orders"; input: Readonly<WorkspaceOrderQuery> }
  | { kind: "organization-profile" }
  | { kind: "workflow"; orderId: string }
  | { kind: "cart"; cartId: string }
  | { kind: "checkout"; checkoutId: string; cartId: string }
  | { kind: "workspace-carts"; input: Readonly<WorkspacePageQuery> }
  | { kind: "support-tickets"; input: Readonly<z.input<typeof supportTicketQuerySchema>> }
  | { kind: "support-ticket"; ticketId: string; beforeMessageId?: string };

function snapshotQuery(query: MobileReadQuery): MobileReadQuery {
  // Existing valid query parameters are scalar values (attributeFilters is a JSON string).
  // Retain input strings/opaque cursors; parsing to output types would coerce quantities.
  switch (query.kind) {
    case "organization-profile":
    case "workflow":
    case "cart":
    case "checkout":
    case "support-ticket": return Object.freeze({ ...query });
    case "catalog": return Object.freeze({ ...query, input: Object.freeze({ ...query.input }) });
    case "comparison": return Object.freeze({ ...query, input: Object.freeze({ ...query.input }) });
    case "workspace-orders": return Object.freeze({ ...query, input: Object.freeze({ ...query.input }) });
    case "workspace-carts":
    case "support-tickets": return Object.freeze({ ...query, input: Object.freeze({ ...query.input }) });
  }
}

function targetFor(query: MobileReadQuery): ReadTarget {
  if (query.kind === "cart") return { kind: "cart", cartId: query.cartId };
  if (query.kind === "checkout") return { kind: "checkout", checkoutId: query.checkoutId, cartId: query.cartId };
  if (query.kind === "support-ticket") return { kind: "support-ticket", ticketId: query.ticketId, ...(query.beforeMessageId === undefined ? {} : { beforeMessageId: query.beforeMessageId }) };
  return query.kind === "comparison"
    ? { kind: "comparison", productId: query.input.productId, variantId: query.input.variantId ?? null }
    : query.kind === "workflow" ? { kind: "workflow", orderId: query.orderId }
    : { kind: query.kind };
}

function request(client: MobileReadClient, scope: ReadScope, query: MobileReadQuery): Promise<unknown> {
  switch (query.kind) {
    case "catalog": return client.searchCatalog({ ...query.input, buyerOrganizationId: scope.organizationId });
    case "comparison": return client.compareOffers({ ...query.input, buyerOrganizationId: scope.organizationId });
    case "workspace-orders": return client.workspaceOrders("buyer", workspaceOrderQuerySchema.parse(query.input));
    case "organization-profile": { if (!client.getOrganizationProfile) throw new Error("Organization profile port unavailable"); return client.getOrganizationProfile(); }
    case "workflow": return client.getOrderWorkflow(query.orderId);
    case "cart": { if (!client.workspaceCart) throw new Error("Cart detail port unavailable"); return client.workspaceCart(query.cartId); }
    case "checkout": { if (!client.getCheckout) throw new Error("Saved checkout port unavailable"); return client.getCheckout(query.checkoutId); }
    case "workspace-carts": {
      if (!client.workspaceCarts) throw new Error("Cart read port unavailable");
      return client.workspaceCarts(workspacePageQuerySchema.parse(query.input));
    }
    case "support-tickets": {
      if (!client.supportTickets) throw new Error("Support list port unavailable");
      const input = supportTicketQuerySchema.parse(query.input);
      return client.supportTickets(input.status, input.offset, { ...(input.q === undefined ? {} : { q: input.q }), ...(input.sort === undefined ? {} : { sort: input.sort }) });
    }
    case "support-ticket": {
      if (!client.supportTicket) throw new Error("Support detail port unavailable");
      const input = supportMessageQuerySchema.parse({ beforeMessageId: query.beforeMessageId });
      return client.supportTicket(query.ticketId, input.beforeMessageId);
    }
  }
}

function apiFailure(error: unknown): { status: number; body: unknown } | null {
  // MarketplaceApiError exposes these two fields. Do not import its browser-bound module
  // or classify errors by Error.message, payload prose or a guessed business code.
  if (typeof error !== "object" || error === null || !("status" in error) || !("payload" in error)) return null;
  if (typeof error.status !== "number" || (error.status >= 200 && error.status < 300)) return null;
  return { status: error.status, body: error.payload };
}

/** Single read surface with an injected, context-bound existing client. Calls occur only on load/refresh. */
export function createMobileReadQueries(initialScope: ReadScope, initialClient: MobileReadClient) {
  const slot = createMobileReadSlot(initialScope);
  let scope = Object.freeze({ ...initialScope });
  let client = initialClient;
  let lastQuery: MobileReadQuery | undefined;

  async function load(input: MobileReadQuery): Promise<"applied" | "discarded"> {
    const query = snapshotQuery(input);
    lastQuery = query;
    const ticket = slot.begin(targetFor(query));
    // Capture client/scope before awaiting. reset must not rebind a pending request.
    const requestClient = client;
    const requestScope = scope;
    try {
      const body = await request(requestClient, requestScope, query);
      // Existing methods return payloads only; 200 is a local success marker, not wire evidence.
      return slot.complete(ticket, { status: 200, body });
    } catch (error) {
      const response = apiFailure(error);
      return response ? slot.complete(ticket, response) : slot.fail(ticket);
    }
  }

  return {
    getState: slot.getState,
    load,
    refresh(): Promise<"applied" | "discarded" | "no-query"> {
      // Manual read refresh only: no timers, hidden replay, backoff or mutation retry.
      return lastQuery ? load(lastQuery) : Promise.resolve("no-query");
    },
    reset(nextScope: ReadScope, nextClient: MobileReadClient) {
      scope = Object.freeze({ ...nextScope });
      client = nextClient;
      lastQuery = undefined;
      slot.reset(scope);
    },
  };
}
