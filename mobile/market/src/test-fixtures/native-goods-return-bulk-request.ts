import { goodsCommandWorkflow,goodsCommandReturn } from "./goods-return-command";
import { discrepancyScope } from "./native-order-discrepancy";
import { receiptId as id } from "./receipt-draft";
import type { GoodsReturnInput } from "../order-workflow-command-fixture";
import type { OrderWorkflowResponse } from "../../../../packages/schemas/src/order-workflow";
export const bulkGoodsScope=discrepancyScope;
export function bulkGoodsWorkflow(count=2){const w=goodsCommandWorkflow(),item=w.order.items[0]!,ship=w.order.shipments![0]!,line=ship.items[0]!;w.order.items=Array.from({length:count},(_,index)=>({...item,id:id(283000+index)}));ship.items=w.order.items.map((item,index)=>({...line,id:id(284000+index),supplierOrderItemId:item.id}));w.order.subtotalAmountMinor=(BigInt(w.order.subtotalAmountMinor)*BigInt(count)).toString();return w;}
export function bulkGoodsReply(version=4,status="SHIPPED"){return{orderId:bulkGoodsWorkflow().orderId,version,status,paymentStatus:"PAID",eventId:id(285000)};}
/** Fixed supplied amount is a fixture fact, never a client refund calculation. */
export function afterBulkGoods(before:OrderWorkflowResponse,input:Readonly<GoodsReturnInput>){const next=JSON.parse(JSON.stringify(before)) as OrderWorkflowResponse,date="2026-11-02T00:00:00.000Z";next.version=next.order.version=before.version+1;next.order.updatedAt=date;const record=goodsCommandReturn(input,before,id(285001));record.createdAt=date;next.returns=[...(next.returns??[]),record];next.events.push({id:id(285000),action:"REQUEST_RETURN",actorId:bulkGoodsScope.userId,organizationId:bulkGoodsScope.organizationId,createdAt:date,details:{action:"REQUEST_RETURN",kind:"GOODS",reason:input.reason,items:input.items.map(line=>({...line}))}});return next;}
