import { z } from "zod";
import { supplierOrderResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema, orderTransferClaimSchema, type OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { ReadScope } from "./read-controller";
const root=orderWorkflowResponseSchema.pick({orderId:true,version:true,status:true,paymentStatus:true}).strip().extend({order:supplierOrderResponseSchema.pick({id:true,buyerOrganizationId:true,version:true,status:true,paymentStatus:true,currency:true}).strip()});
const ids=z.array(orderTransferClaimSchema.pick({id:true}).strip()),claimRoot=orderTransferClaimSchema.pick({id:true,status:true,currency:true}).strip();
const fields=orderTransferClaimSchema.pick({amountMinor:true,paidAt:true,createdAt:true,comment:true,invoiceDocumentId:true,documentId:true,supportTicketId:true}).strip();
export type DisputeClaim=OrderWorkflowResponse["claims"][number];
export type PaymentDisputeSource=Readonly<{orderId:string;version:number;status:string;paymentStatus:string;orderNumber:string;claimId:string;claimStatus:DisputeClaim["status"];amountMinor:string;currency:string;paidAt:string;createdAt:string;comment:string;invoiceDocumentId:string;documentId:string;supportTicketId:string|null|undefined;signature:string}>;
export function ownedDisputeWorkflow(scope:ReadScope,workflow:OrderWorkflowResponse,id:string){const parsed=root.safeParse(workflow);if(!parsed.success)return false;const w=parsed.data;return w.orderId===id&&w.order.id===id&&w.order.buyerOrganizationId===scope.organizationId&&w.version>0&&w.version===w.order.version&&w.status===w.order.status&&w.paymentStatus===w.order.paymentStatus;}
/** Selected initial dispute subset. Parent/window/row provenance establishes membership, never role or money confirmation. */
export function paymentDisputeSource(scope:ReadScope,workflow:OrderWorkflowResponse,claim:DisputeClaim):PaymentDisputeSource|null{
 if(!ownedDisputeWorkflow(scope,workflow,workflow.orderId)||!workflow.claims.includes(claim))return null;
 const bound=ids.safeParse(workflow.claims);if(!bound.success||new Set(bound.data.map(row=>row.id)).size!==bound.data.length)return null;
 const identity=claimRoot.safeParse(claim);if(!identity.success||!["PENDING","NEEDS_INFORMATION","NOT_RECEIVED"].includes(identity.data.status)||identity.data.currency!==workflow.order.currency)return null;
 const parsed=fields.safeParse(claim),header=supplierOrderResponseSchema.pick({orderNumber:true}).strip().safeParse(workflow.order);if(!parsed.success||!header.success)return null;
 const value={orderId:workflow.orderId,version:workflow.version,status:workflow.status,paymentStatus:workflow.paymentStatus,orderNumber:header.data.orderNumber,claimId:identity.data.id,claimStatus:identity.data.status,currency:identity.data.currency,...parsed.data,supportTicketId:parsed.data.supportTicketId};return Object.freeze({...value,signature:JSON.stringify(value)});
}

export function validDisputeClaimRead(workflow:OrderWorkflowResponse,claimId:string,expectDisputed=false){const bound=ids.safeParse(workflow.claims);if(!bound.success||new Set(bound.data.map(row=>row.id)).size!==bound.data.length)return false;const claim=workflow.claims.find(row=>row.id===claimId);if(!claim)return !expectDisputed;const identity=claimRoot.safeParse(claim);return identity.success&&identity.data.currency===workflow.order.currency&&(!expectDisputed||identity.data.status==="DISPUTED")&&fields.safeParse(claim).success;}
