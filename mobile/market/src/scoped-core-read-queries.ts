import { z } from "zod";
import { cartResponseSchema, checkoutResponseSchema, supplierOrderResponseSchema, offerComparisonResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { organizationProfileResponseSchema } from "../../../packages/schemas/src/organization-profile";
import { supportTicketListSchema, supportTicketDetailSchema } from "../../../packages/schemas/src/support-workflow";
import { workspaceOrderSchema } from "../../../packages/schemas/src/workspace-reads";
import { createMobileReadQueries, type MobileReadClient, type MobileReadQuery } from "../../../contracts/mobile-read/read-queries";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

// Internal metadata projections of actual schemas; not response DTOs or action permission proofs.
const order = z.object({ buyerOrganizationId: supplierOrderResponseSchema.shape.buyerOrganizationId, supplierOrganizationId: supplierOrderResponseSchema.shape.supplierOrganizationId });
const cart = z.object({ buyerOrganizationId: cartResponseSchema.shape.buyerOrganizationId });
const checkout = z.object({ buyerOrganizationId: checkoutResponseSchema.shape.buyerOrganizationId });
const organization = z.object({ organizationId: organizationProfileResponseSchema.shape.organizationId });
const support = z.object({ organizationId: supportTicketDetailSchema.shape.organizationId });
const supportList = z.array(z.object({ organizationId: supportTicketListSchema.element.shape.organizationId }));
const workspaceOrders = z.object({ items: z.array(z.object({ buyer: z.object({ id: workspaceOrderSchema.shape.buyer.shape.id }), supplier: z.object({ id: workspaceOrderSchema.shape.supplier.shape.id }) })) });
const workspaceCarts = z.object({ current: cart.nullable(), items: z.array(cart) });
const workflowIdentity = z.object({ orderId: orderWorkflowResponseSchema.shape.orderId, order: z.object({ id: supplierOrderResponseSchema.shape.id }) });
const cartIdentity = z.object({ id: cartResponseSchema.shape.id });
const checkoutIdentity = z.object({ id: checkoutResponseSchema.shape.id, cartId: checkoutResponseSchema.shape.cartId });
const comparisonIdentity = z.object({ product: z.object({ id: offerComparisonResponseSchema.shape.product.shape.id }), selectedVariantId: offerComparisonResponseSchema.shape.selectedVariantId });
const supportIdentity = z.object({ id: supportTicketDetailSchema.shape.id });
const supportPublicMetadata = z.object({
  messages: z.array(z.object({ ticketId: supportTicketDetailSchema.shape.messages.element.shape.ticketId, isInternal: supportTicketDetailSchema.shape.messages.element.shape.isInternal })),
  links: z.array(z.object({ ticketId: supportTicketDetailSchema.shape.links.element.shape.ticketId })),
});
type Selection = Readonly<
  | { kind: "workflow"; orderId: string }
  | { kind: "cart"; cartId: string }
  | { kind: "checkout"; checkoutId: string; cartId: string }
  | { kind: "support-ticket"; ticketId: string }
  | { kind: "comparison"; productId: string; variantId: string | null }
>;
function selectionFor(query: MobileReadQuery): Selection | undefined {
  if (query.kind === "workflow") return Object.freeze({ kind: query.kind, orderId: query.orderId });
  if (query.kind === "cart") return Object.freeze({ kind: query.kind, cartId: query.cartId });
  if (query.kind === "checkout") return Object.freeze({ kind: query.kind, checkoutId: query.checkoutId, cartId: query.cartId });
  if (query.kind === "support-ticket") return Object.freeze({ kind: query.kind, ticketId: query.ticketId });
  if (query.kind === "comparison") return Object.freeze({ kind: query.kind, productId: query.input.productId, variantId: query.input.variantId ?? null });
  return undefined;
}
// Repeat only the existing consumer's selected identity/public-message predicates, before private content.
function matchesSelection(selection: Selection | undefined, body: unknown): boolean {
  try {
    if (!selection) return true;
    if (selection.kind === "workflow") { const value = workflowIdentity.safeParse(body); return value.success && value.data.orderId === selection.orderId && value.data.order.id === selection.orderId; }
    if (selection.kind === "cart") { const value = cartIdentity.safeParse(body); return value.success && value.data.id === selection.cartId; }
    if (selection.kind === "checkout") { const value = checkoutIdentity.safeParse(body); return value.success && value.data.id === selection.checkoutId && value.data.cartId === selection.cartId; }
    if (selection.kind === "comparison") { const value = comparisonIdentity.safeParse(body); return value.success && value.data.product.id === selection.productId && (selection.variantId === null || value.data.selectedVariantId === selection.variantId); }
    const identity = supportIdentity.safeParse(body);
    if (!identity.success || identity.data.id !== selection.ticketId) return false;
    const value = supportPublicMetadata.safeParse(body);
    return value.success && value.data.messages.every(message => message.ticketId === selection.ticketId && !message.isInternal) && value.data.links.every(link => link.ticketId === selection.ticketId);
  } catch { return false; }
}
type Binding = "public" | "workflow" | "cart" | "checkout" | "organization" | "support-list" | "support" | "workspace-orders" | "workspace-carts";
function inOrganization(kind: Binding, body: unknown, id: string): boolean {
  try {
    if (kind === "public") return true;
    if (kind === "workflow") { const value = z.object({ order }).safeParse(body); return value.success && (value.data.order.buyerOrganizationId === id || value.data.order.supplierOrganizationId === id); }
    if (kind === "cart") { const value = cart.safeParse(body); return value.success && value.data.buyerOrganizationId === id; }
    if (kind === "checkout") { const value = checkout.safeParse(body); return value.success && value.data.buyerOrganizationId === id; }
    if (kind === "organization") { const value = organization.safeParse(body); return value.success && value.data.organizationId === id; }
    if (kind === "support-list") { const value = supportList.safeParse(body); return value.success && value.data.every(row => row.organizationId === id); }
    if (kind === "support") { const value = support.safeParse(body); return value.success && value.data.organizationId === id; }
    if (kind === "workspace-orders") { const value = workspaceOrders.safeParse(body); return value.success && value.data.items.every(row => row.buyer.id === id || row.supplier.id === id); }
    const value = workspaceCarts.safeParse(body); return value.success && (!value.data.current || value.data.current.buyerOrganizationId === id) && value.data.items.every(row => row.buyerOrganizationId === id);
  } catch { return false; }
}

/** Same source read consumer and tenant predicate, with metadata/late-result guards before private DTO decoding. */
export function createScopedCoreReadQueries(initialScope: ReadScope, initialClient: MobileReadClient) {
  let epoch = 0, sequence = 0;
  let selection: Selection | undefined;
  const bind = (scope: ReadScope, client: MobileReadClient, generation: number): MobileReadClient => {
    const organizationId = scope.organizationId;
    const read = async (kind: Binding, request: () => Promise<unknown>) => {
      const ticket = sequence, selected = selection, live = () => epoch === generation && sequence === ticket;
      try { const body = await request(); if (!live()) return null; const owned = inOrganization(kind, body, organizationId); if (!live() || !owned) return null; const matches = matchesSelection(selected, body); return live() && matches ? body : null; }
      catch (error) { if (!live()) return null; throw error; }
    };
    return Object.freeze({
      searchCatalog: input => read("public", () => client.searchCatalog(input)),
      compareOffers: input => read("public", () => client.compareOffers(input)),
      workspaceOrders: (role, input) => read("workspace-orders", () => client.workspaceOrders(role, input)),
      getOrderWorkflow: id => read("workflow", () => client.getOrderWorkflow(id)),
      workspaceCarts: typeof client.workspaceCarts === "function" ? input => read("workspace-carts", () => client.workspaceCarts!(input)) : undefined,
      workspaceCart: typeof client.workspaceCart === "function" ? id => read("cart", () => client.workspaceCart!(id)) : undefined,
      getCheckout: typeof client.getCheckout === "function" ? id => read("checkout", () => client.getCheckout!(id)) : undefined,
      getOrganizationProfile: typeof client.getOrganizationProfile === "function" ? () => read("organization", () => client.getOrganizationProfile!()) : undefined,
      supportTickets: typeof client.supportTickets === "function" ? (status, offset, options) => read("support-list", () => client.supportTickets!(status, offset, options)) : undefined,
      supportTicket: typeof client.supportTicket === "function" ? (id, cursor) => read("support", () => client.supportTicket!(id, cursor)) : undefined,
    });
  };
  const owner = Object.freeze({ ...initialScope });
  const queries = createMobileReadQueries(owner, bind(owner, initialClient, epoch));
  return {
    getState: queries.getState,
    load(input: MobileReadQuery) { sequence++; selection = selectionFor(input); return queries.load(input); },
    refresh() { sequence++; return queries.refresh(); },
    reset(scope: ReadScope, client: MobileReadClient) { sequence++; epoch++; selection = undefined; const owner = Object.freeze({ ...scope }); queries.reset(owner, bind(owner, client, epoch)); },
  };
}
