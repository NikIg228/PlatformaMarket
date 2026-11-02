import { orderWorkflowResultSchema, type OrderWorkflowResponse } from "../../../../packages/schemas/src/order-workflow";
import type { ReceiveShipmentInput } from "../order-workflow-command-fixture";
import { receiptWorkflow, receiptScope, receiptId } from "./receipt-draft";
export { receiptScope as receiptCommandScope, receiptId as receiptCommandId, receiptWorkflow as receiptCommandWorkflow } from "./receipt-draft";
export { cancellationCommandAuthorization as receiptCommandAuthorization } from "./order-cancellation-command";
/** A supplied source result, not a frontend fulfillment calculation. */
export function receiptCommandResult(orderId:string,input:Readonly<ReceiveShipmentInput>,status="PARTIALLY_FULFILLED",eventId=receiptId(9850)){return orderWorkflowResultSchema.parse({orderId,version:input.expectedVersion+1,status,paymentStatus:"PAID",eventId});}
export function receivedCommandWorkflow(input:Readonly<ReceiveShipmentInput>,source:OrderWorkflowResponse=receiptWorkflow(),status="PARTIALLY_FULFILLED"){
 const workflow=JSON.parse(JSON.stringify(source)) as OrderWorkflowResponse;workflow.version=workflow.order.version=input.expectedVersion+1;workflow.status=workflow.order.status=status;const shipment=workflow.order.shipments!.find(row=>row.id===input.shipmentId)!;shipment.version++;shipment.status="PARTIALLY_DELIVERED";for(const line of input.items)shipment.items.find(row=>row.id===line.shipmentItemId)!.deliveredQuantity=line.deliveredQuantity;
 workflow.events.push({id:receiptId(9850),action:"RECEIVE_SHIPMENT",actorId:receiptScope.userId,organizationId:receiptScope.organizationId,createdAt:"2026-10-30T02:03:04.000Z",details:{action:"RECEIVE_SHIPMENT",shipmentId:input.shipmentId,items:input.items.map(item=>({...item}))}});return workflow;
}
