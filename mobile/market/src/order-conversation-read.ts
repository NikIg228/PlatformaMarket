import { z } from "zod";
import { errorResponseSchema, supplierOrderResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { conversationContextSchema, conversationLookupSchema, conversationSummarySchema, conversationMessageSchema, conversationMessageQuerySchema } from "../../../packages/schemas/src/conversations";
import type { ReadScope } from "./read-controller";
const parentIds=orderWorkflowResponseSchema.pick({orderId:true,version:true}).strip().extend({order:supplierOrderResponseSchema.pick({id:true,version:true,buyerOrganizationId:true,supplierOrganizationId:true}).strip()});
const parentLabel=supplierOrderResponseSchema.pick({orderNumber:true}).strip();
export type OrderConversationContext=Readonly<{orderId:string;orderVersion:number;orderNumber:string;buyerOrganizationId:string;supplierOrganizationId:string}>;
export type OrderConversationSelection=Readonly<{orderId:string;orderVersion:number;selection:number;beforeSequence?:number}>;
const threadIds=conversationSummarySchema.pick({id:true,contextType:true,contextId:true,buyerOrganizationId:true,supplierOrganizationId:true,version:true,latestSequence:true,supportTicketId:true}).strip();
const threadHeader=conversationSummarySchema.pick({title:true,counterpartyName:true,resolved:true,updatedAt:true,unread:true,supportStatus:true}).strip();
const messageIds=conversationMessageSchema.pick({id:true,sequence:true,authorId:true,authorOrganizationId:true,authorRole:true}).strip().extend({conversationId:z.uuid()}).array().max(50);
const messageContent=conversationMessageSchema.pick({body:true,authorName:true,createdAt:true,readByCounterparty:true,attachments:true}).strip();
export type OrderConversationAttachment=NonNullable<z.output<typeof messageContent>["attachments"]>[number];
export type OrderConversationMessage=Readonly<z.output<typeof messageIds>[number]&Omit<z.output<typeof messageContent>,"attachments">&{attachments?:readonly Readonly<OrderConversationAttachment>[]}>;
export type OrderConversationThread=Readonly<z.output<typeof threadIds>&z.output<typeof threadHeader>>;
export type OrderConversationWindow=Readonly<{context:OrderConversationContext;target:OrderConversationSelection;conversation:OrderConversationThread|null;messages:readonly OrderConversationMessage[];hasOlder:boolean;beforeSequence?:number}>;
export type OrderConversationFixtureClient={orderConversationLookupFixture?:(scope:ReadScope,input:Readonly<{contextType:"ORDER";contextId:string}>)=>Promise<unknown>;orderConversationDetailFixture?:(scope:ReadScope,id:string,beforeSequence?:number)=>Promise<unknown>};
type Failure="authentication-required"|"denied"|"unavailable"|"retry-limited"|"contract-error"|"error";
export type OrderConversationReadState={phase:"idle"}|{phase:"loading";target:{kind:"order-conversation"}}|{phase:"ready"|"empty";read:{kind:"order-conversation";value:OrderConversationWindow}}|{phase:Failure};
type RecordContext={context:OrderConversationContext;conversationId:string|null|undefined;version:number;latest:number};
export type KnownOrderConversation=Readonly<{id:string;contextId:string;buyerOrganizationId:string;supplierOrganizationId:string;version:number;latestSequence:number}>;
const knownThread=conversationSummarySchema.pick({id:true,contextId:true,buyerOrganizationId:true,supplierOrganizationId:true,version:true,latestSequence:true}).strip();
function parent(body:unknown,owner:ReadScope,expected?:KnownOrderConversation):OrderConversationContext|null{const ids=parentIds.safeParse(body);if(!ids.success)return null;const p=ids.data;if(p.orderId!==p.order.id||p.version<=0||p.version!==p.order.version||p.order.buyerOrganizationId!==owner.organizationId||p.order.buyerOrganizationId===p.order.supplierOrganizationId||expected&&(p.orderId!==expected.contextId||p.order.buyerOrganizationId!==expected.buyerOrganizationId||p.order.supplierOrganizationId!==expected.supplierOrganizationId))return null;const label=parentLabel.safeParse((body as {order:unknown}).order);return label.success?Object.freeze({orderId:p.orderId,orderVersion:p.version,orderNumber:label.data.orderNumber,buyerOrganizationId:p.order.buyerOrganizationId,supplierOrganizationId:p.order.supplierOrganizationId}):null;}
function classify(error:unknown):Failure{if(typeof error!=="object"||error===null||!("status"in error)||!("payload"in error))return "error";const parsed=errorResponseSchema.safeParse(error.payload);if(!parsed.success||parsed.data.statusCode!==error.status)return "contract-error";return error.status===401?"authentication-required":error.status===403?"denied":error.status===404?"unavailable":error.status===429?"retry-limited":"error";}
/** Own ORDER participant source-fixture subset. Viewing does not mark read or grant any command. */
export function createOrderConversationRead(scope:ReadScope,client:OrderConversationFixtureClient){
 const owner=Object.freeze({...scope});let issued=new WeakMap<OrderConversationSelection,RecordContext>(),sequence=0,pending:object|null=null,last:OrderConversationSelection|null=null,state:OrderConversationReadState={phase:"idle"};
 const supports=()=>typeof client.orderConversationLookupFixture==="function"&&typeof client.orderConversationDetailFixture==="function";
 const load=async(target:OrderConversationSelection):Promise<"applied"|"discarded">=>{
  const request={};pending=request;const record=typeof target==="object"&&target!==null?issued.get(target):undefined;
  if(!record){pending=null;last=null;state={phase:"contract-error"};return "applied";}last=target;state={phase:"loading",target:{kind:"order-conversation"}};
  try{
   if(!supports()){if(pending===request){pending=null;state={phase:"unavailable"};}return "applied";}
   if(target.beforeSequence!==undefined&&(!conversationMessageQuerySchema.safeParse({beforeSequence:target.beforeSequence}).success||!record.conversationId)){pending=null;state={phase:"contract-error"};return "applied";}
   if(record.conversationId===undefined||record.conversationId===null){
    const input=Object.freeze({contextType:"ORDER" as const,contextId:record.context.orderId});conversationContextSchema.parse(input);
    const raw=await client.orderConversationLookupFixture!(owner,input);if(pending!==request)return "discarded";
    // Lookup context/title/image metadata has no party binding. Never read it.
    const found=conversationLookupSchema.pick({conversationId:true}).strip().safeParse(raw);if(!found.success){pending=null;state={phase:"contract-error"};return "applied";}record.conversationId=found.data.conversationId;
   }
   if(record.conversationId===null){pending=null;state={phase:"empty",read:{kind:"order-conversation",value:Object.freeze({context:record.context,target,conversation:null,messages:Object.freeze([]),hasOlder:false})}};return "applied";}
   const raw=await client.orderConversationDetailFixture!(owner,record.conversationId,target.beforeSequence);if(pending!==request)return "discarded";
   const root=z.object({conversation:threadIds}).safeParse(raw),context=record.context;
   if(!root.success||root.data.conversation.id!==record.conversationId||root.data.conversation.contextType!=="ORDER"||root.data.conversation.contextId!==context.orderId||root.data.conversation.buyerOrganizationId!==owner.organizationId||root.data.conversation.supplierOrganizationId!==context.supplierOrganizationId||root.data.conversation.version<=0||root.data.conversation.latestSequence<0||root.data.conversation.version<record.version||root.data.conversation.latestSequence<record.latest){pending=null;state={phase:"contract-error"};return "applied";}
   const payload=raw as {conversation:unknown;messages:unknown;hasOlder:unknown},bound=messageIds.safeParse(payload.messages),older=z.boolean().safeParse(payload.hasOlder),thread=root.data.conversation;
   if(!bound.success||!older.success||older.data&&bound.data.length!==50||new Set(bound.data.map(row=>row.id)).size!==bound.data.length||new Set(bound.data.map(row=>row.sequence)).size!==bound.data.length||bound.data.some((row,index)=>row.conversationId!==thread.id||row.sequence<=0||row.sequence>thread.latestSequence||index>0&&row.sequence<=bound.data[index-1]!.sequence||target.beforeSequence!==undefined&&row.sequence>=target.beforeSequence||row.authorRole==="BUYER"&&row.authorOrganizationId!==context.buyerOrganizationId||row.authorRole==="SUPPLIER"&&row.authorOrganizationId!==context.supplierOrganizationId||row.authorRole==="OPERATOR"&&(!thread.supportTicketId||[context.buyerOrganizationId,context.supplierOrganizationId].includes(row.authorOrganizationId)))){pending=null;state={phase:"contract-error"};return "applied";}
   const header=threadHeader.safeParse(payload.conversation),content=messageContent.array().safeParse(payload.messages);if(!header.success||!content.success){pending=null;state={phase:"contract-error"};return "applied";}
   const conversation=Object.freeze({...thread,...header.data}),messages=Object.freeze(bound.data.map((row,index)=>Object.freeze({...row,...content.data[index]!,attachments:content.data[index]!.attachments===undefined?undefined:Object.freeze(content.data[index]!.attachments!.map(file=>Object.freeze({...file})))})));
   record.version=conversation.version;record.latest=conversation.latestSequence;pending=null;state={phase:messages.length?"ready":"empty",read:{kind:"order-conversation",value:Object.freeze({context,target,conversation,messages,hasOlder:older.data,...(target.beforeSequence===undefined?{}:{beforeSequence:target.beforeSequence})})}};
  }catch(error){if(pending!==request)return "discarded";pending=null;state={phase:classify(error)};}
  return "applied";
 };
 return {supportsRead:supports,getState:()=>state,
  select(workflow:unknown){const context=parent(workflow,owner);if(!context)return null;const target=Object.freeze({orderId:context.orderId,orderVersion:context.orderVersion,selection:++sequence});issued.set(target,{context,conversationId:undefined,version:0,latest:0});return target;},
  selectKnown(workflow:unknown,expected:KnownOrderConversation){const ids=knownThread.safeParse(expected);if(!ids.success||ids.data.version<=0||ids.data.latestSequence<0)return null;const context=parent(workflow,owner,ids.data);if(!context)return null;const target=Object.freeze({orderId:context.orderId,orderVersion:context.orderVersion,selection:++sequence});issued.set(target,{context,conversationId:ids.data.id,version:ids.data.version,latest:ids.data.latestSequence});return target;},
  older(window:OrderConversationWindow){if(!("read"in state)||state.read.value!==window||!window.hasOlder||!window.conversation||!window.messages[0])return null;const record=issued.get(window.target),beforeSequence=window.messages[0].sequence;if(!record||record.conversationId!==window.conversation.id||!conversationMessageQuerySchema.safeParse({beforeSequence}).success)return null;const target=Object.freeze({orderId:window.context.orderId,orderVersion:window.context.orderVersion,selection:++sequence,beforeSequence});issued.set(target,record);return target;},
  hasCurrentOrderContext(orderId:string,buyerOrganizationId:string,supplierOrganizationId:string){const record=last?issued.get(last):undefined;return record?.context.orderId===orderId&&record.context.buyerOrganizationId===buyerOrganizationId&&record.context.supplierOrganizationId===supplierOrganizationId;},
  hasCurrentContext(orderId:string,conversationId:string){const record=last?issued.get(last):undefined;return record?.context.orderId===orderId&&record.conversationId===conversationId;},
  pause(){pending=null;state={phase:"idle"};},
  failAccess(phase:"authentication-required"|"denied"|"unavailable"){pending=null;state={phase};},
  load,refresh:()=>last?load(last):Promise.resolve("no-query" as const),reset(){pending=null;last=null;issued=new WeakMap();state={phase:"idle"};},
 };
}
