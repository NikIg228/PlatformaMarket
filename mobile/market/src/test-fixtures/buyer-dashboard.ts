import { orderWorkflowResponseSchema } from "../../../../packages/schemas/src/order-workflow";
import type { BuyerDashboardFixture } from "../buyer-dashboard-fixture-read";
import { listDraftPayload, listDraftScope, listDraftId } from "./list-draft";
import { cartId } from "./carts";
export const dashboardScope = listDraftScope, dashboardId = listDraftId;
export function dashboardWorkflow() { return orderWorkflowResponseSchema.parse(listDraftPayload("order-workflow-minimal")); }
export function buyerDashboardFixture(overrides: Partial<BuyerDashboardFixture> = {}): BuyerDashboardFixture {
  const order = dashboardWorkflow().order;
  return { activeCart: { id: cartId, itemCount: 17, updatedAt: "2026-10-29T01:02:03.000Z" }, pendingOrders: 42, savedLists: 7, recentOrders: [{ id: order.id, buyerOrganizationId: dashboardScope.organizationId, orderNumber: "SYNTHETIC dashboard order", status: "PAID", createdAt: "2026-10-28T00:00:00.000Z", supplier: { displayName: "SYNTHETIC dashboard supplier" } }], ...overrides };
}
