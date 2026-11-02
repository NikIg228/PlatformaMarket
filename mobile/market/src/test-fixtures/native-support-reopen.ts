import type { SupportTicketDetail } from "../../../../packages/schemas/src/support-workflow";
import { addSupportMessageSchema } from "../../../../packages/schemas/src/commercial";
import { api,current,user,workspace,server,response,type Reply } from "./market-session";
import { listDraftPayload,listDraftScope } from "./list-draft";
import { supportDetail,supportSummary,supportId } from "./support";
import { postedSupportMessage,commandEnvelope } from "./support-commands";
export const reopenScope=Object.freeze({...listDraftScope,environment:api});
export const reopenText="  SYNTHETIC повторное открытие\nЕкінші жол  ";
export function terminalSupportTicket(status:"CLOSED"|"RESOLVED"="CLOSED"){return supportDetail({status,closedAt:status==="CLOSED"?"2026-10-30T12:00:00.000Z":null,resolvedAt:"2026-10-30T11:00:00.000Z",messages:[],hasOlder:false,links:[]});}
export function supportReopenBackend(options:{status?:"CLOSED"|"RESOLVED";initialTicket?:SupportTicketDetail;firstFailure?:number;invalidFirstResult?:boolean;override?:(path:string,init:RequestInit)=>Reply|Promise<Reply>|undefined}={}){
 let ticket=options.initialTicket??terminalSupportTicket(options.status),effects=0;
 const writes:{path:string;body:string;init:RequestInit}[]=[],receipts=new Map<string,{bytes:string;value:ReturnType<typeof postedSupportMessage>}>();
 const fetcher=server((path,init)=>{
  const custom=options.override?.(path,init);if(custom)return custom;
  if(path==="/auth/current?workspace=BUYER")return response(current({user:{...user,id:reopenScope.userId},activeOrganizationId:reopenScope.organizationId,organizationIds:[reopenScope.organizationId],workspaces:[workspace(reopenScope.organizationId)]}));
  if(path.startsWith("/marketplace/search"))return response(listDraftPayload("catalog-empty"));
  if(path.startsWith("/support/tickets?")&&init.method==="GET")return response([supportSummary(ticket)]);
  if(path.split("?")[0]===`/support/tickets/${ticket.id}`&&init.method==="GET")return response(ticket);
  if(path===`/support/tickets/${ticket.id}/messages`&&init.method==="POST"){
   writes.push({path,body:String(init.body),init});const input=addSupportMessageSchema.strict().parse(JSON.parse(String(init.body))),bytes=JSON.stringify(input),prior=receipts.get(input.idempotencyKey);
   if(prior&&prior.bytes!==bytes)return response(commandEnvelope(409).payload,409);
   if(writes.length===1&&[400,401,403,404,409].includes(options.firstFailure??0))return response(commandEnvelope(options.firstFailure!).payload,options.firstFailure);
   if(!prior){if(["RESOLVED","CLOSED"].includes(ticket.status)&&input.reopen!==true)return response(commandEnvelope(409).payload,409);const value={...postedSupportMessage(ticket.id,input),id:supportId(260000+effects),authorId:reopenScope.userId};receipts.set(input.idempotencyKey,{bytes,value});effects++;ticket={...ticket,status:input.reopen?"IN_PROGRESS":ticket.status,version:ticket.version+1,resolvedAt:input.reopen?null:ticket.resolvedAt,closedAt:input.reopen?null:ticket.closedAt,messages:[...ticket.messages,value]};}
   if(writes.length===1&&options.firstFailure)return response(commandEnvelope(options.firstFailure).payload,options.firstFailure);
   const value=receipts.get(input.idempotencyKey)!.value;return response(options.invalidFirstResult&&writes.length===1?{...value,ticketId:supportId(999),body:"SYNTHETIC foreign reply text"}:value,201);
  }
  return undefined;
 });
 return {fetcher,writes,effects:()=>effects,ticket:()=>ticket,replace:(value:ReturnType<typeof terminalSupportTicket>)=>{ticket=value;}};
}
