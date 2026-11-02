import { z } from "zod";
import { supplierOrderResponseSchema, supplierOrderItemResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema, orderReservationStateSchema, type OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { ReadScope } from "./read-controller";
const root=orderWorkflowResponseSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip().extend({order:supplierOrderResponseSchema.pick({id:true,buyerOrganizationId:true,version:true,status:true,paymentStatus:true,currency:true}).strip()});
const lineRoot=supplierOrderItemResponseSchema.pick({id:true,supplierOrderId:true,offerId:true,productVariantId:true,warehouseId:true,currency:true}).strip().array();
const lineContent=supplierOrderItemResponseSchema.pick({quantity:true,acceptedQuantity:true,decisionReason:true,unitPriceMinor:true,totalPriceMinor:true,status:true}).strip();
const labelBinding=z.object({id:z.uuid(),productVariant:z.object({id:z.uuid()})});
const label=z.object({id:z.uuid(),productVariant:z.object({id:z.uuid(),product:z.object({id:z.uuid(),canonicalName:z.string()})})});
export type CompositionLine=Readonly<{id:string;offerId:string;variantId:string;warehouseId:string;name:string|null;quantity:string;acceptedQuantity:string|null;reason:string|null;status:string;unitPriceMinor:string;totalPriceMinor:string;currency:string}>;
export type CompositionSource=Readonly<{orderId:string;version:number;orderNumber:string;currency:string;subtotalAmountMinor:string;reservationStatus:string;lines:readonly CompositionLine[];signature:string}>;
export function ownedCompositionWorkflow(scope:ReadScope,workflow:OrderWorkflowResponse,id:string){const parsed=root.safeParse(workflow);if(!parsed.success)return false;const w=parsed.data;return w.orderId===id&&w.order.id===id&&w.order.buyerOrganizationId===scope.organizationId&&w.version>0&&w.version===w.order.version&&w.status===w.order.status&&w.paymentStatus===w.order.paymentStatus;}
/** Current unpaid composition only. Hidden allocation/eligibility is always a server decision. */
export function compositionSource(scope:ReadScope,workflow:OrderWorkflowResponse):CompositionSource|null{
 if(!ownedCompositionWorkflow(scope,workflow,workflow.orderId)||workflow.status!=="PARTIALLY_CONFIRMED"||workflow.paymentStatus!=="UNPAID")return null;
 const reservation=orderReservationStateSchema.safeParse(workflow.reservationState);if(!reservation.success||reservation.data.status==="DUE")return null;
 const bound=lineRoot.safeParse(workflow.order.items);if(!bound.success||new Set(bound.data.map(row=>row.id)).size!==bound.data.length||bound.data.some(row=>row.supplierOrderId!==workflow.orderId||row.currency!==workflow.order.currency))return null;
 const header=supplierOrderResponseSchema.pick({orderNumber:true,subtotalAmountMinor:true}).strip().safeParse(workflow.order);if(!header.success)return null;
 const lines:CompositionLine[]=[];
 for(let index=0;index<bound.data.length;index++){
  const ids=bound.data[index]!,row=workflow.order.items[index]!,parsed=lineContent.safeParse(row);if(!parsed.success)return null;let name:string|null=null;
  if(row.offer!==undefined){const offerRoot=labelBinding.safeParse(row.offer);if(!offerRoot.success||offerRoot.data.id!==ids.offerId||offerRoot.data.productVariant.id!==ids.productVariantId)return null;const offer=label.safeParse(row.offer);if(!offer.success||offer.data.id!==ids.offerId||offer.data.productVariant.id!==ids.productVariantId)return null;name=offer.data.productVariant.product.canonicalName;}
  const value=parsed.data;lines.push(Object.freeze({id:ids.id,offerId:ids.offerId,variantId:ids.productVariantId,warehouseId:ids.warehouseId,name,quantity:value.quantity,acceptedQuantity:value.acceptedQuantity,reason:value.decisionReason,status:value.status,unitPriceMinor:value.unitPriceMinor,totalPriceMinor:value.totalPriceMinor,currency:ids.currency}));
 }
 const value={orderId:workflow.orderId,version:workflow.version,orderNumber:header.data.orderNumber,currency:workflow.order.currency,subtotalAmountMinor:header.data.subtotalAmountMinor,reservationStatus:reservation.data.status,lines:Object.freeze(lines)};return Object.freeze({...value,signature:JSON.stringify(value)});
}
