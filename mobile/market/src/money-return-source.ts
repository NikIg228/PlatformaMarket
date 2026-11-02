import { supplierOrderResponseSchema, shipmentResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema, orderTransferClaimSchema, type OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { paymentSummarySchema } from "../../../packages/schemas/src/manual-payments";
import { orderReturnSchema, type OrderReturn } from "../../../packages/schemas/src/order-returns";
import type { ReadScope } from "./read-controller";
export type MoneyReturnKind="CANCELLATION"|"OVERPAYMENT";
const root=orderWorkflowResponseSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip().extend({order:supplierOrderResponseSchema.pick({id:true,buyerOrganizationId:true,version:true,status:true,paymentStatus:true,currency:true}).strip()});
const claimIds=orderTransferClaimSchema.pick({id:true,status:true,currency:true}).strip().array();
const returnIds=orderReturnSchema.pick({id:true,supplierOrderId:true,kind:true,status:true,currency:true}).strip().array();
const returnAmounts=orderReturnSchema.pick({id:true,amountMinor:true}).strip().array();
const summary=paymentSummarySchema.pick({confirmedAmountMinor:true,overpaidAmountMinor:true}).strip();
const shipmentIds=shipmentResponseSchema.pick({id:true,supplierOrderId:true,status:true}).strip().array();
const dispatch=shipmentResponseSchema.pick({dispatchedAt:true}).strip();
export type MoneyReturnSource=Readonly<{orderId:string;version:number;status:string;paymentStatus:string;orderNumber:string;kind:MoneyReturnKind;currency:string;confirmedAmountMinor:string;overpaidAmountMinor:string;claims:number;history:readonly Readonly<{id:string;kind:OrderReturn["kind"];status:OrderReturn["status"];amountMinor:string}>[];shipments:number|null;signature:string}>;
export function ownedMoneyReturnWorkflow(scope:ReadScope,workflow:OrderWorkflowResponse,id:string){const parsed=root.safeParse(workflow);if(!parsed.success)return false;const w=parsed.data;return w.orderId===id&&w.order.id===id&&w.order.buyerOrganizationId===scope.organizationId&&w.version>0&&w.version===w.order.version&&w.status===w.order.status&&w.paymentStatus===w.order.paymentStatus;}
export function validMoneyReturnRead(scope:ReadScope,workflow:OrderWorkflowResponse){if(!ownedMoneyReturnWorkflow(scope,workflow,workflow.orderId))return false;const bound=returnIds.safeParse(workflow.returns);return bound.success&&new Set(bound.data.map(row=>row.id)).size===bound.data.length&&bound.data.every(row=>row.supplierOrderId===workflow.orderId&&row.currency===workflow.order.currency);}
/** Summary is a literal source fact, never a calculated refundable/available balance. */
export function moneyReturnSource(scope:ReadScope,workflow:OrderWorkflowResponse,kind:MoneyReturnKind):MoneyReturnSource|null{
 if(!["CANCELLATION","OVERPAYMENT"].includes(kind)||!validMoneyReturnRead(scope,workflow)||workflow.status==="CANCELLED")return null;
 const claims=claimIds.safeParse(workflow.claims),returns=returnIds.parse(workflow.returns);if(!claims.success||claims.data.length===0||new Set(claims.data.map(row=>row.id)).size!==claims.data.length||claims.data.some(row=>row.currency!==workflow.order.currency||row.status!=="CONFIRMED"))return null;
 const committed=returns.filter(row=>row.status!=="REJECTED");if(committed.some(row=>row.status!=="REFUND_RECEIVED")||kind==="CANCELLATION"&&committed.some(row=>row.kind!=="OVERPAYMENT"))return null;
 let shipmentCount:number|null=null;
 if(kind==="CANCELLATION"){
  const shipments=shipmentIds.safeParse(workflow.order.shipments);if(!shipments.success||new Set(shipments.data.map(row=>row.id)).size!==shipments.data.length||shipments.data.some(row=>row.supplierOrderId!==workflow.orderId))return null;
  if(shipments.data.some(row=>["DISPATCHED","IN_TRANSIT","PARTIALLY_DELIVERED","DELIVERED","FAILED","RETURNED"].includes(row.status)))return null;
  for(const row of workflow.order.shipments!){const sent=dispatch.safeParse(row);if(!sent.success||sent.data.dispatchedAt!==null)return null;}shipmentCount=shipments.data.length;
 }
 const amounts=summary.safeParse(workflow.paymentSummary),history=returnAmounts.safeParse(workflow.returns),label=supplierOrderResponseSchema.pick({orderNumber:true}).strip().safeParse(workflow.order);if(!amounts.success||!history.success||!label.success||!/[1-9]/.test(amounts.data.confirmedAmountMinor)||kind==="OVERPAYMENT"&&!/[1-9]/.test(amounts.data.overpaidAmountMinor))return null;
 if(history.data.some((row,index)=>row.id!==returns[index]!.id))return null;
 const value={orderId:workflow.orderId,version:workflow.version,status:workflow.status,paymentStatus:workflow.paymentStatus,orderNumber:label.data.orderNumber,kind,currency:workflow.order.currency,...amounts.data,claims:claims.data.length,history:Object.freeze(returns.map((row,index)=>Object.freeze({id:row.id,kind:row.kind,status:row.status,amountMinor:history.data[index]!.amountMinor}))),shipments:shipmentCount};return Object.freeze({...value,signature:JSON.stringify(value)});
}
