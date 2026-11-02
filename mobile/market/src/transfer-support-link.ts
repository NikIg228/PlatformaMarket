import { z } from "zod";
import { orderTransferClaimSchema, type OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { supportTicketDetailSchema, type SupportTicketDetail } from "../../../packages/schemas/src/support-workflow";
import { ownedDisputeWorkflow, type DisputeClaim } from "./payment-dispute-source";
import type { ReadScope } from "./read-controller";
export type TransferSupportSelection=Readonly<{orderId:string;orderVersion:number;claimId:string;ticketId:string}>;
export type TransferSupportOrigin=Readonly<TransferSupportSelection>;
const ids=z.array(orderTransferClaimSchema.pick({id:true}).strip());
const pointer=orderTransferClaimSchema.pick({id:true,supportTicketId:true}).strip();
const ticketRoot=supportTicketDetailSchema.pick({id:true,organizationId:true}).strip();
const links=supportTicketDetailSchema.shape.links.element.pick({id:true,ticketId:true,entityType:true,entityId:true}).strip().array();
/** Local provenance for existing protected GET only; a source pointer never grants support access. */
export function createTransferSupportLinks(scope:ReadScope,currentWorkflow:(id:string)=>OrderWorkflowResponse|null,isWorkflowActive:(id:string)=>boolean,supportsRead=true){
 const owner=Object.freeze({...scope});let active=true,issued=new WeakMap<TransferSupportSelection,Readonly<{workflow:OrderWorkflowResponse;claim:DisputeClaim}>>(),origins=new WeakSet<TransferSupportOrigin>();
 const value=(workflow:OrderWorkflowResponse,claim:DisputeClaim):TransferSupportSelection|null=>{
  if(!active||!supportsRead||!isWorkflowActive(workflow.orderId)||currentWorkflow(workflow.orderId)!==workflow||!ownedDisputeWorkflow(owner,workflow,workflow.orderId)||!workflow.claims.includes(claim))return null;
  try{const bound=ids.safeParse(workflow.claims);if(!bound.success||new Set(bound.data.map(row=>row.id)).size!==bound.data.length)return null;const selected=pointer.safeParse(claim);if(!selected.success||!selected.data.supportTicketId)return null;return Object.freeze({orderId:workflow.orderId,orderVersion:workflow.version,claimId:selected.data.id,ticketId:selected.data.supportTicketId});}catch{return null;}
 };
 return {
  select(workflow:OrderWorkflowResponse,claim:DisputeClaim){const target=value(workflow,claim);if(target)issued.set(target,Object.freeze({workflow,claim}));return target;},
  take(target:TransferSupportSelection){if(!active)return null;const selected=issued.get(target);if(!selected)return null;const current=value(selected.workflow,selected.claim);if(!current||current.orderId!==target.orderId||current.orderVersion!==target.orderVersion||current.claimId!==target.claimId||current.ticketId!==target.ticketId)return null;issued.delete(target);const origin=Object.freeze({...target});origins.add(origin);return origin;},
  accepts(ticket:SupportTicketDetail,origin:TransferSupportOrigin){if(!active||!origins.has(origin))return false;try{const root=ticketRoot.safeParse(ticket);if(!root.success||root.data.id!==origin.ticketId||root.data.organizationId!==owner.organizationId)return false;const bound=links.safeParse(ticket.links);return bound.success&&new Set(bound.data.map(row=>row.id)).size===bound.data.length&&bound.data.every(row=>row.ticketId===origin.ticketId)&&bound.data.some(row=>row.entityType==="SupplierOrder"&&row.entityId===origin.orderId);}catch{return false;}},
  activate(){active=true;},close(){active=false;issued=new WeakMap();origins=new WeakSet();},
 };
}
export type TransferSupportLinks=ReturnType<typeof createTransferSupportLinks>;
