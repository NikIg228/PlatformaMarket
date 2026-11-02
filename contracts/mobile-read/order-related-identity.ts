import type { SupplierOrderResponse } from "../../packages/schemas/src/core-api";
import type { OrderWorkflowResponse } from "../../packages/schemas/src/order-workflow";

/** Defensive projection consistency after schema parsing, never a server permission grant. */
export function hasRelatedOrderIdentity(order: SupplierOrderResponse): boolean {
  return (order.shipments ?? []).every(shipment => shipment.supplierOrderId === order.id
    && shipment.items.every(item => item.shipmentId === shipment.id)
    && shipment.fulfillmentSteps.every(step => step.shipmentId === shipment.id))
    && (order.documents ?? []).every(document => document.supplierOrderId === order.id);
  // Documents may precede an included shipment projection. Do not invent a membership rule.
}
export function hasWorkflowRelatedIdentity(workflow: OrderWorkflowResponse): boolean {
  return hasRelatedOrderIdentity(workflow.order)
    && (workflow.returns ?? []).every(record => record.supplierOrderId === workflow.orderId);
}
