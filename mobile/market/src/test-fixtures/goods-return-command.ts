import { orderReturnSchema } from "../../../../packages/schemas/src/order-returns";
import { orderWorkflowResultSchema, type OrderWorkflowResponse } from "../../../../packages/schemas/src/order-workflow";
import type { GoodsReturnInput } from "../order-workflow-command-fixture";
import { goodsReturnWorkflow, goodsReturnScope, goodsReturnId } from "./goods-return-draft";
import { cancellationCommandClaim } from "./order-cancellation-command";
export { goodsReturnScope as goodsCommandScope, goodsReturnId as goodsCommandId } from "./goods-return-draft";
export { cancellationCommandAuthorization as goodsCommandAuthorization } from "./order-cancellation-command";
export function goodsCommandWorkflow(two=false){const workflow=goodsReturnWorkflow(two);const claim=cancellationCommandClaim();claim.status="CONFIRMED";claim.amountMinor="100000";claim.receivedAmountMinor="100000";claim.currency=workflow.order.currency;claim.confirmedById=goodsReturnScope.userId;claim.confirmedAt="2026-10-30T03:04:05.000Z";workflow.claims=[claim];workflow.returns=[];return workflow;}
export function goodsCommandResult(orderId:string,input:Readonly<GoodsReturnInput>,status="SHIPPED",eventId=goodsReturnId(9840)){return orderWorkflowResultSchema.parse({orderId,version:input.expectedVersion+1,status,paymentStatus:"PAID",eventId});}
/** Synthetic supplied return amount; no browser/client refund calculation. */
export function goodsCommandReturn(input:Readonly<GoodsReturnInput>,source:OrderWorkflowResponse=goodsCommandWorkflow(),returnId=goodsReturnId(9841)){return orderReturnSchema.parse({id:returnId,supplierOrderId:source.orderId,kind:"GOODS",status:"REQUESTED",reason:input.reason,decisionReason:null,amountMinor:"100",currency:source.order.currency,items:input.items.map(item=>({...item})),requestedById:goodsReturnScope.userId,createdAt:"2026-10-30T03:04:05.000Z",decidedAt:null,goodsSentAt:null,goodsReceivedAt:null,refundDocumentId:null,refundSentAt:null,refundReceivedAt:null});}
export function requestedGoodsWorkflow(input:Readonly<GoodsReturnInput>,source:OrderWorkflowResponse=goodsCommandWorkflow()){
 const workflow=JSON.parse(JSON.stringify(source)) as OrderWorkflowResponse;workflow.version=workflow.order.version=input.expectedVersion+1;workflow.returns=[...(workflow.returns??[]),goodsCommandReturn(input,source)];workflow.events.push({id:goodsReturnId(9840),action:"REQUEST_RETURN",actorId:goodsReturnScope.userId,organizationId:goodsReturnScope.organizationId,createdAt:"2026-10-30T03:04:05.000Z",details:{action:"REQUEST_RETURN",kind:"GOODS",reason:input.reason,items:input.items.map(item=>({...item}))}});return workflow;
}
