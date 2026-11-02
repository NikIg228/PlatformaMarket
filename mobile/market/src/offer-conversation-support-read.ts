import { supportMessageQuerySchema } from "../../../packages/schemas/src/support-workflow";
import { createMobileReadQueries, type MobileReadClient } from "../../../contracts/mobile-read/read-queries";
import type { MobileReadState, ReadScope } from "../../../contracts/mobile-read/read-adapter";
import type { OfferConversationSupportLinks, OfferSupportOrigin } from "./offer-conversation-support-link";
export type OfferConversationSupportQuery=Readonly<{kind:"offer-conversation-support-ticket";origin:OfferSupportOrigin;beforeMessageId?:string}>;
/** Reuse the protected public-ticket decoder after raw source relation headers, never before. */
export function createOfferConversationSupportRead(scope:ReadScope,client:MobileReadClient,links:OfferConversationSupportLinks){
 const owner=Object.freeze({...scope}),minimums=new Map<string,number>();let state:MobileReadState={phase:"idle"},pending:object|null=null,last:OfferConversationSupportQuery|null=null,inner:ReturnType<typeof createMobileReadQueries>|null=null;
 const load=async(query:OfferConversationSupportQuery)=>{const token={};pending=token;inner?.reset(owner,client);const cursor=supportMessageQuerySchema.safeParse({beforeMessageId:query.beforeMessageId});if(!links.isOrigin(query.origin)||!cursor.success){last=null;pending=null;state={phase:"contract-error"};return "applied" as const;}last=Object.freeze({...query});const origin=query.origin,ticketId=origin.ticketId,before=cursor.data.beforeMessageId;state={phase:"loading",target:{kind:"support-ticket",ticketId,...(before===undefined?{}:{beforeMessageId:before})}};
  const wrapped:MobileReadClient={...client,supportTicket:async(id,beforeMessageId)=>{if(!client.supportTicket)return {};const raw=await client.supportTicket(id,beforeMessageId);if(pending!==token)return {};return links.acceptsRaw(raw,origin,minimums.get(ticketId)??0)?raw:{};}};
  const reader=createMobileReadQueries(owner,wrapped);inner=reader;await reader.load({kind:"support-ticket",ticketId,...(before===undefined?{}:{beforeMessageId:before})});if(pending!==token)return "discarded" as const;pending=null;state=reader.getState();if("read"in state&&state.read.kind==="support-ticket")minimums.set(ticketId,Math.max(minimums.get(ticketId)??0,state.read.value.version));return "applied" as const;
 };
 return {getState:()=>state,load,failAccess(phase:"authentication-required"|"denied"){pending=null;inner?.reset(owner,client);inner=null;state={phase};},refresh:()=>last?load(last):Promise.resolve("no-query" as const),reset(){pending=null;last=null;inner?.reset(owner,client);inner=null;state={phase:"idle"};},close(){pending=null;last=null;inner?.reset(owner,client);inner=null;minimums.clear();state={phase:"idle"};}};
}
