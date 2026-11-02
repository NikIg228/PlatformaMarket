import { conversationMessageInputSchema, type ConversationMessageInput } from "../../../../packages/schemas/src/conversations";
import type { ReadScope } from "../read-controller";
import { offerConversationPage, offerConversationScope, offerConversationThreadId, offerConversationId } from "./offer-conversation";
import { conversationReadError } from "./order-conversation";
/** Small fixed canonical append receipt/page fixture; no DB, transport, provider or device simulation. */
export function parallelConversationSource(){const saved=new Map<string,{body:string;organizationId:string;authorId:string}>(),committed:{body:string;organizationId:string;authorId:string}[]=[];return {
 commits:()=>committed.length,
 accept(owner:ReadScope,id:string,input:Readonly<ConversationMessageInput>){conversationMessageInputSchema.parse(input);if(id!==offerConversationThreadId||owner.organizationId!==offerConversationScope.organizationId||owner.environment!==offerConversationScope.environment||input.attachments!==undefined)throw conversationReadError(404);const key=[id,owner.userId,input.idempotencyKey].join(":"),prior=saved.get(key);if(prior){if(prior.body!==input.body||prior.organizationId!==owner.organizationId)throw conversationReadError(409);return {conversationId:id};}const row=Object.freeze({body:input.body,organizationId:owner.organizationId,authorId:owner.userId});saved.set(key,row);committed.push(row);return {conversationId:id};},
 page(){const raw=offerConversationPage(),base=raw.messages.at(-1)!;raw.messages=[...raw.messages,...committed.map((row,index)=>({...base,id:offerConversationId(46000+index),sequence:66+index,authorId:row.authorId,authorOrganizationId:row.organizationId,authorRole:"BUYER" as const,body:row.body,authorName:"SYNTHETIC independently returned author",readByCounterparty:false,attachments:[]}))].slice(-50);raw.conversation.version=5+committed.length;raw.conversation.latestSequence=65+committed.length;return raw;},
 };}
