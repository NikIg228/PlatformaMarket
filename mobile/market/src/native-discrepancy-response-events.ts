import { z } from "zod";
import { orderDiscrepancyCommandSchema,orderDiscrepancyViewSchema,type DiscrepancyStatement } from "../../../packages/schemas/src/order-discrepancy";
const supplierBody=orderDiscrepancyCommandSchema.options[3].pick({decision:true,resolution:true,reason:true}).strip();
const buyerBody=orderDiscrepancyCommandSchema.options[4].pick({accepted:true,reason:true}).strip();
type BaseEvent=Readonly<{id:string;version:number;action:string;createdAt:string}>;
export type DiscrepancyPublicResponse=Readonly<{kind:"SUPPLIER";decision:"AGREE"|"REJECT"|"COUNTER";resolution:DiscrepancyStatement["requestedResolution"];reason:string}|{kind:"BUYER";accepted:boolean;reason:string}>;
export type DiscrepancyResponseEvent=BaseEvent&Readonly<{response?:DiscrepancyPublicResponse;responseIssue?:"unverified"}>;
export type DiscrepancyCounterProposal=Readonly<{id:string;version:number;createdAt:string;resolution:DiscrepancyStatement["requestedResolution"];reason:string}>;
const identity=orderDiscrepancyViewSchema.shape.events.element.pick({id:true,version:true,action:true,actorId:true,organizationId:true}).strip();
/** Known public response bodies only; raw event details and actor labels never enter native state. */
export function decodeDiscrepancyResponseEvents(raw:unknown,context:Readonly<{version:number;status:string;resolution:DiscrepancyStatement["requestedResolution"]|null;buyerOrganizationId:string;supplierOrganizationId:string;events:readonly BaseEvent[]}>):Readonly<{events:readonly DiscrepancyResponseEvent[];counterProposal:DiscrepancyCounterProposal|null}>{
 const input=z.array(z.unknown()).safeParse(raw),versions=new Map<number,number>();context.events.forEach(event=>versions.set(event.version,(versions.get(event.version)??0)+1));
 const events:DiscrepancyResponseEvent[]=context.events.map((event,index)=>{
  const base=Object.freeze({id:event.id,version:event.version,action:event.action,createdAt:event.createdAt});
  if(event.action!=="RESPOND"&&event.action!=="DECIDE")return base;
  try{if(!input.success||input.data.length!==context.events.length||versions.get(event.version)!==1)throw Error();const value=input.data[index],who=identity.parse(value),expected=event.action==="RESPOND"?context.supplierOrganizationId:context.buyerOrganizationId;
   if(!z.uuid().safeParse(expected).success||who.id!==event.id||who.version!==event.version||who.action!==event.action||who.organizationId!==expected)throw Error();
   const date=z.iso.datetime().parse((value as {createdAt:unknown}).createdAt);if(date!==event.createdAt)throw Error();
   const body=(value as {details:unknown}).details,response:DiscrepancyPublicResponse=event.action==="RESPOND"?Object.freeze({kind:"SUPPLIER",...supplierBody.parse(body)}):Object.freeze({kind:"BUYER",...buyerBody.parse(body)});
   return Object.freeze({...base,response});
  }catch{return Object.freeze({...base,responseIssue:"unverified" as const});}
 });
 const latest=events.filter(event=>event.version===context.version&&event.action==="RESPOND"&&event.response?.kind==="SUPPLIER"&&event.response.decision==="COUNTER"&&event.response.resolution===context.resolution),event=latest.length===1?latest[0]:undefined,response=event?.response;
 const counterProposal=context.status==="RESOLUTION_PROPOSED"&&event&&response?.kind==="SUPPLIER"?Object.freeze({id:event.id,version:event.version,createdAt:event.createdAt,resolution:response.resolution,reason:response.reason}):null;
 return Object.freeze({events:Object.freeze(events),counterProposal});
}
