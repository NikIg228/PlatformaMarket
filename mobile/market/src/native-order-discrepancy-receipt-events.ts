import { z } from "zod";
import { orderWorkflowEventSchema } from "../../../packages/schemas/src/order-workflow";
import type { OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import type { ReadScope } from "./read-controller";
export type DiscrepancyReceiptEvent=Readonly<{id:string;createdAt:string}>;
const header=z.array(orderWorkflowEventSchema.pick({id:true,action:true}).strip()),identity=orderWorkflowEventSchema.pick({id:true,action:true,actorId:true,organizationId:true}).strip(),relation=z.object({details:z.object({shipmentId:z.uuid()})});
/** Source workflow GET includes own order events; retain only a linked receipt ID/date for CREATE.
 * Actor, organization and original receipt quantities remain outside the public choices. */
export function bindDiscrepancyReceiptEvents(workflow:OrderWorkflowResponse,scope:ReadScope,shipmentId:string){
 const organizationId=scope.organizationId,orderId=workflow.orderId;
 const choices:DiscrepancyReceiptEvent[]=[],pins=new WeakMap<DiscrepancyReceiptEvent,Readonly<{event:unknown;signature:string}>>();let events:typeof workflow.events=[],complete=true,ids="";
 const own=()=>z.uuid().safeParse(workflow.orderId).success&&z.uuid().safeParse(shipmentId).success&&workflow.orderId===orderId&&workflow.orderId===workflow.order.id&&workflow.order.buyerOrganizationId===organizationId&&Array.isArray(workflow.order.shipments)&&workflow.order.shipments.some(ship=>ship.id===shipmentId&&ship.supplierOrderId===workflow.orderId);
 const signature=(raw:unknown,expectedId?:string)=>{const who=identity.parse(raw);if(who.action!=="RECEIVE_SHIPMENT"||who.organizationId!==organizationId||expectedId&&who.id!==expectedId)throw Error("Unavailable receipt");const link=relation.parse(raw);if(link.details.shipmentId!==shipmentId)return null;const date=z.iso.datetime().parse((raw as {createdAt:unknown}).createdAt);return{id:who.id,createdAt:date,signature:JSON.stringify([who.id,who.action,who.actorId,who.organizationId,link.details.shipmentId,date])};};
 try{if(!own())throw Error();events=workflow.events;const rows=header.parse(events);if(new Set(rows.map(row=>row.id)).size!==rows.length)throw Error();ids=JSON.stringify(rows);rows.forEach((row,index)=>{if(row.action!=="RECEIVE_SHIPMENT")return;try{const value=signature(events[index]);if(!value)return;const choice=Object.freeze({id:value.id,createdAt:value.createdAt});pins.set(choice,Object.freeze({event:events[index],signature:value.signature}));choices.push(choice);}catch{complete=false;}});}catch{complete=false;}
 return Object.freeze({choices:Object.freeze(choices),complete,isCurrent(choice:DiscrepancyReceiptEvent){const pin=pins.get(choice);if(!pin||!own()||workflow.events!==events||!events.includes(pin.event as typeof events[number]))return false;try{if(JSON.stringify(header.parse(events))!==ids)return false;return signature(pin.event,choice.id)?.signature===pin.signature;}catch{return false;}}});
}
