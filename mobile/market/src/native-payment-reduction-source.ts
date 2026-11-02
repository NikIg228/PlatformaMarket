import { z } from "zod";
import { supplierOrderResponseSchema,supplierOrderItemResponseSchema,shipmentResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema,orderTransferClaimSchema,type OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { paymentReductionSchema,paymentReductionLineSchema,nonnegativeMinorAmountSchema } from "../../../packages/schemas/src/manual-payments";
import { orderReturnSchema } from "../../../packages/schemas/src/order-returns";
import { compareReceiptCounts } from "./shipment-receipt-draft";
import type { ReadScope } from "./read-controller";
type Reduction=NonNullable<OrderWorkflowResponse["reductions"]>[number];
export type PaymentReductionLine=Readonly<{itemId:string;lineNumber:number;name:string|null;previousQuantity:string;acceptedQuantity:string;unitPriceMinor:string;totalPriceMinor:string}>;
export type PaymentReductionProposal=Readonly<{id:string;status:Reduction["status"];party:"BUYER"|"SUPPLIER"|"UNKNOWN";createdAt:string|null;decidedAt:string|null;invalidDates:boolean;details:Readonly<{reason:string;previousAmountMinor:string;proposedAmountMinor:string;lines:readonly PaymentReductionLine[]}>|null}>;
export type PaymentReductionSnapshot=Readonly<{orderId:string;orderVersion:number;orderNumber:string;currency:string;issue:"missing"|"invalid"|null;proposals:readonly PaymentReductionProposal[]}>;
/** Private capture: original references and checks stay model-owned, outside the rendered snapshot. */
export type PaymentReductionContext={workflow:OrderWorkflowResponse;snapshot:PaymentReductionSnapshot;signature:string;items:readonly object[];rows:readonly object[];lineRefs:readonly object[];bindings:ReadonlyMap<PaymentReductionProposal,Reduction>;decidable:ReadonlyMap<PaymentReductionProposal,Readonly<{accept:boolean;reject:boolean}>>};
const root=orderWorkflowResponseSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip().extend({order:supplierOrderResponseSchema.pick({id:true,buyerOrganizationId:true,supplierOrganizationId:true,version:true,status:true,paymentStatus:true}).strip()});
const header=supplierOrderResponseSchema.pick({orderNumber:true,currency:true,subtotalAmountMinor:true}).strip();
const itemIds=supplierOrderItemResponseSchema.pick({id:true,supplierOrderId:true,offerId:true,productVariantId:true}).strip().array();
const itemValues=supplierOrderItemResponseSchema.pick({id:true,acceptedQuantity:true,unitPriceMinor:true,totalPriceMinor:true}).strip().array();
const proposalHeaders=paymentReductionSchema.pick({id:true,proposedByOrganizationId:true,proposedById:true,status:true}).strip().array();
const lineIds=paymentReductionLineSchema.pick({itemId:true}).strip().array();
const returnHeaders=orderReturnSchema.pick({id:true,supplierOrderId:true,currency:true,status:true}).strip().extend({items:orderReturnSchema.shape.items.element.pick({orderItemId:true}).strip().array()}).array();
const quantity=paymentReductionLineSchema.shape.acceptedQuantity;
const date=supplierOrderResponseSchema.shape.createdAt;
function parsedDate(value:unknown){const result=date.safeParse(value);return result.success?result.data:null;}
function nameFor(item:OrderWorkflowResponse["order"]["items"][number]){try{const offer=item.offer;if(!offer||offer.id!==item.offerId||offer.productVariant.id!==item.productVariantId)return null;const name=offer.productVariant.product.canonicalName;return typeof name==="string"&&name.trim()?name:null;}catch{return null;}}
export function ownedPaymentReductionWorkflow(scope:ReadScope,workflow:OrderWorkflowResponse,id=workflow.orderId){try{const p=root.safeParse(workflow);if(!p.success)return false;const w=p.data;return w.orderId===id&&w.order.id===id&&w.order.buyerOrganizationId===scope.organizationId&&w.order.supplierOrganizationId!==scope.organizationId&&w.version>0&&w.version===w.order.version&&w.status===w.order.status&&w.paymentStatus===w.order.paymentStatus;}catch{return false;}}
export function capturePaymentReductions(scope:ReadScope,workflow:OrderWorkflowResponse):PaymentReductionContext|null{
 try{
  if(!ownedPaymentReductionWorkflow(scope,workflow))return null;
  const label=header.safeParse(workflow.order),identities=itemIds.safeParse(workflow.order.items);if(!label.success||!identities.success||new Set(identities.data.map(row=>row.id)).size!==identities.data.length||identities.data.some(row=>row.supplierOrderId!==workflow.orderId))return null;
  const indices=new Map(identities.data.map((row,index)=>[row.id,index]));
  const sourceItems=workflow.order.items,ids=new Set(identities.data.map(row=>row.id)),rows=workflow.reductions,headers=rows===undefined?null:proposalHeaders.safeParse(rows),proposals:PaymentReductionProposal[]=[],bindings=new Map<PaymentReductionProposal,Reduction>(),lineRefs:object[]=[],decidable=new Map<PaymentReductionProposal,Readonly<{accept:boolean;reject:boolean}>>();
  const groupValid=!!headers?.success&&new Set(headers.data.map(row=>row.id)).size===headers.data.length;
  if(groupValid&&headers?.success&&rows)for(const [index,h] of headers.data.entries()){
   const raw=rows[index]!,party=h.proposedByOrganizationId===scope.organizationId?"BUYER":h.proposedByOrganizationId===workflow.order.supplierOrganizationId?"SUPPLIER":"UNKNOWN";
   let details:PaymentReductionProposal["details"]=null,createdAt:string|null=null,decidedAt:string|null=null,invalidDates=false;
   if(party!=="UNKNOWN"){
    const lines=lineIds.safeParse(raw.items);
    if(lines.success&&new Set(lines.data.map(row=>row.itemId)).size===lines.data.length&&lines.data.every(row=>ids.has(row.itemId))){
     const full=paymentReductionSchema.safeParse(raw);
     if(full.success){const v=full.data;createdAt=parsedDate(v.createdAt);decidedAt=v.decidedAt===null?null:parsedDate(v.decidedAt);invalidDates=createdAt===null||v.decidedAt!==null&&decidedAt===null;
      if(v.reason.trim().length>=3&&v.reason.length<=2000&&v.items.every(line=>quantity.safeParse(line.previousQuantity).success&&nonnegativeMinorAmountSchema.safeParse(line.unitPriceMinor).success&&nonnegativeMinorAmountSchema.safeParse(line.totalPriceMinor).success)){
       details=Object.freeze({reason:v.reason,previousAmountMinor:v.previousAmountMinor,proposedAmountMinor:v.proposedAmountMinor,lines:Object.freeze(v.items.map(line=>{const ordinal=indices.get(line.itemId)!;return Object.freeze({itemId:line.itemId,lineNumber:ordinal+1,name:nameFor(sourceItems[ordinal]!),previousQuantity:line.previousQuantity,acceptedQuantity:line.acceptedQuantity,unitPriceMinor:line.unitPriceMinor,totalPriceMinor:line.totalPriceMinor});}))});lineRefs.push(...raw.items);
      }
     }
    }
   }
   const proposal=Object.freeze({id:h.id,status:h.status,party,createdAt,decidedAt,invalidDates,details});proposals.push(proposal);bindings.set(proposal,raw);
  }
  const snapshot=Object.freeze({orderId:workflow.orderId,orderVersion:workflow.version,orderNumber:label.data.orderNumber,currency:label.data.currency,issue:rows===undefined?"missing" as const:!groupValid?"invalid" as const:null,proposals:Object.freeze(proposals)});
  const values=itemValues.safeParse(sourceItems),claims=orderTransferClaimSchema.pick({id:true,currency:true,status:true}).strip().array().safeParse(workflow.claims),ships=workflow.order.shipments===undefined?null:shipmentResponseSchema.pick({id:true,supplierOrderId:true,version:true,status:true}).strip().array().safeParse(workflow.order.shipments),returns=workflow.returns===undefined?null:returnHeaders.safeParse(workflow.returns);
  const knownGuards=values.success&&claims.success&&ships?.success&&returns?.success&&new Set(claims.data.map(row=>row.id)).size===claims.data.length&&claims.data.every(row=>row.currency===label.data.currency&&row.status==="CONFIRMED")&&ships.data.length===0&&new Set(returns.data.map(row=>row.id)).size===returns.data.length&&returns.data.every(row=>row.supplierOrderId===workflow.orderId&&row.currency===label.data.currency&&["REJECTED","REFUND_RECEIVED"].includes(row.status)&&row.items.every(line=>ids.has(line.orderItemId)));
  if(knownGuards&&values.success&&workflow.paymentStatus==="UNPAID"&&["CONFIRMED","AWAITING_PAYMENT"].includes(workflow.status)&&proposals.filter(row=>row.status==="PENDING").length===1&&nonnegativeMinorAmountSchema.safeParse(label.data.subtotalAmountMinor).success){
   for(const proposal of proposals){const d=proposal.details;if(proposal.status!=="PENDING"||proposal.party!=="SUPPLIER"||!d)continue;decidable.set(proposal,Object.freeze({accept:false,reject:true}));if(d.lines.length!==sourceItems.length||!d.lines.length||d.lines.length>500||BigInt(d.previousAmountMinor)!==BigInt(label.data.subtotalAmountMinor)||BigInt(d.proposedAmountMinor)>=BigInt(d.previousAmountMinor))continue;
    const matches=d.lines.every(line=>{const current=values.data.find(item=>item.id===line.itemId);return !!current&&current.acceptedQuantity!==null&&compareReceiptCounts(line.previousQuantity,current.acceptedQuantity)===0&&compareReceiptCounts(line.acceptedQuantity,line.previousQuantity)!==null&&compareReceiptCounts(line.acceptedQuantity,line.previousQuantity)!==1&&nonnegativeMinorAmountSchema.safeParse(current.unitPriceMinor).success&&BigInt(current.unitPriceMinor)===BigInt(line.unitPriceMinor);});
    if(matches&&d.lines.reduce((sum,line)=>sum+BigInt(line.totalPriceMinor),0n)===BigInt(d.proposedAmountMinor))decidable.set(proposal,Object.freeze({accept:true,reject:true}));
   }
  }
  const guards={status:workflow.status,paymentStatus:workflow.paymentStatus,supplier:workflow.order.supplierOrganizationId,subtotal:label.data.subtotalAmountMinor,identities:identities.data,values:values.success?values.data:null,claims:claims.success?claims.data:null,shipments:ships?.success?ships.data:null,returns:returns?.success?returns.data.map(row=>({id:row.id,status:row.status,supplierOrderId:row.supplierOrderId,currency:row.currency,items:row.items})):null};
  return{workflow,snapshot,signature:JSON.stringify({snapshot,guards,decidable:[...decidable].map(([row,choices])=>({id:row.id,...choices}))}),items:Object.freeze([...sourceItems]),rows:Object.freeze([...(rows??[])]),lineRefs:Object.freeze(lineRefs),bindings,decidable};
 }catch{return null;}
}
export function samePaymentReductionContext(a:PaymentReductionContext,b:PaymentReductionContext){return a.workflow===b.workflow&&a.signature===b.signature&&a.items.length===b.items.length&&a.items.every((row,index)=>row===b.items[index])&&a.rows.length===b.rows.length&&a.rows.every((row,index)=>row===b.rows[index])&&a.lineRefs.length===b.lineRefs.length&&a.lineRefs.every((row,index)=>row===b.lineRefs[index]);}

export type PaymentReductionProposalBasis=Readonly<{orderId:string;orderVersion:number;orderNumber:string;status:string;paymentStatus:string;currency:string;previousAmountMinor:string;lines:readonly Readonly<{itemId:string;lineNumber:number;name:string|null;acceptedQuantity:string;unitPriceMinor:string;totalPriceMinor:string}>[]}>;
export type PaymentReductionProposalSource=Readonly<{workflow:OrderWorkflowResponse;snapshot:PaymentReductionProposalBasis;signature:string;items:readonly object[]}>;
export function capturePaymentReductionProposalSource(scope:ReadScope,workflow:OrderWorkflowResponse):PaymentReductionProposalSource|null{
 try{
  if(!ownedPaymentReductionWorkflow(scope,workflow)||workflow.paymentStatus!=="UNPAID"||!["CONFIRMED","AWAITING_PAYMENT"].includes(workflow.status))return null;
  const h=header.safeParse(workflow.order),bound=itemIds.safeParse(workflow.order.items);
  if(!h.success||!bound.success||bound.data.length<1||bound.data.length>500||new Set(bound.data.map(item=>item.id)).size!==bound.data.length||bound.data.some(item=>item.supplierOrderId!==workflow.orderId)||!nonnegativeMinorAmountSchema.safeParse(h.data.subtotalAmountMinor).success||BigInt(h.data.subtotalAmountMinor)<=0n)return null;
  const ids=new Set(bound.data.map(item=>item.id)),values=itemValues.safeParse(workflow.order.items),claims=orderTransferClaimSchema.pick({id:true,currency:true,status:true}).strip().array().safeParse(workflow.claims),proposals=proposalHeaders.safeParse(workflow.reductions),returns=returnHeaders.safeParse(workflow.returns),ships=shipmentResponseSchema.pick({id:true,supplierOrderId:true}).strip().array().safeParse(workflow.order.shipments);
  if(!values.success||!claims.success||!proposals.success||!returns.success||!ships.success||ships.data.length!==0||new Set(claims.data.map(row=>row.id)).size!==claims.data.length||claims.data.some(row=>row.currency!==h.data.currency||row.status!=="CONFIRMED")||new Set(proposals.data.map(row=>row.id)).size!==proposals.data.length||proposals.data.some(row=>row.status==="PENDING"||row.proposedByOrganizationId!==scope.organizationId&&row.proposedByOrganizationId!==workflow.order.supplierOrganizationId)||new Set(returns.data.map(row=>row.id)).size!==returns.data.length||returns.data.some(row=>row.supplierOrderId!==workflow.orderId||row.currency!==h.data.currency||!["REJECTED","REFUND_RECEIVED"].includes(row.status)||row.items.some(line=>!ids.has(line.orderItemId))))return null;
  if(values.data.some(item=>item.acceptedQuantity===null||!quantity.safeParse(item.acceptedQuantity).success||!nonnegativeMinorAmountSchema.safeParse(item.unitPriceMinor).success||!nonnegativeMinorAmountSchema.safeParse(item.totalPriceMinor).success))return null;
  const lines=Object.freeze(values.data.map((item,index)=>Object.freeze({itemId:item.id,lineNumber:index+1,name:nameFor(workflow.order.items[index]!),acceptedQuantity:item.acceptedQuantity!,unitPriceMinor:item.unitPriceMinor,totalPriceMinor:item.totalPriceMinor}))),snapshot=Object.freeze({orderId:workflow.orderId,orderVersion:workflow.version,orderNumber:h.data.orderNumber,status:workflow.status,paymentStatus:workflow.paymentStatus,currency:h.data.currency,previousAmountMinor:h.data.subtotalAmountMinor,lines});
  return Object.freeze({workflow,snapshot,items:Object.freeze([...workflow.order.items]),signature:JSON.stringify({snapshot,identities:bound.data,claims:claims.data,proposals:proposals.data,returns:returns.data.map(row=>({id:row.id,status:row.status,supplierOrderId:row.supplierOrderId,currency:row.currency,items:row.items}))})});
 }catch{return null;}
}
export function samePaymentReductionProposalSource(a:PaymentReductionProposalSource,b:PaymentReductionProposalSource){return a.workflow===b.workflow&&a.signature===b.signature&&a.items.length===b.items.length&&a.items.every((item,index)=>item===b.items[index]);}
