import { conversationSummarySchema } from "../../../../packages/schemas/src/conversations";
import { conversationSendAuthorization } from "./order-conversation-send";
import { conversationScope, conversationId, existingConversationId, orderConversationSummary, orderConversationPage, conversationWorkflow } from "./order-conversation";
export { conversationScope as inboxScope, conversationId as inboxId, conversationReadError, orderConversationLookup } from "./order-conversation";
export function inboxAuthorization(){return conversationSendAuthorization({permissions:["support.ticket.view"]});}
export function inboxRow(index=0,supplier=false){return conversationSummarySchema.parse({...orderConversationSummary(),id:index===0?existingConversationId:conversationId(38000+index),contextId:index===0?conversationWorkflow().orderId:conversationId(39000+index),buyerOrganizationId:supplier?conversationId(40000+index):conversationScope.organizationId,supplierOrganizationId:supplier?conversationScope.organizationId:conversationWorkflow().order.supplierOrganizationId,title:`SYNTHETIC inbox conversation ${index}`,lastMessage:`SYNTHETIC inbox last message ${index}`,counterpartyName:`SYNTHETIC inbox counterparty ${index}`,version:5,latestSequence:65});}
export function inboxPage(offset=0,mixed=false){return {items:offset===0?Array.from({length:30},(_,index)=>inboxRow(index,mixed&&index>0)):[inboxRow(offset)],hasMore:offset===0,unreadCount:99999};}
/** Existing source workflow with independently selected order identity; only owner headers are consumed here. */
export function inboxWorkflow(index=0){const raw=conversationWorkflow(),row=inboxRow(index);raw.orderId=row.contextId;raw.order.id=row.contextId;return raw;}
export function inboxDetail(index=0){const raw=orderConversationPage(),row=inboxRow(index);raw.conversation={...raw.conversation,...row};raw.messages=raw.messages.slice(-2).map(message=>({...message,conversationId:row.id}));raw.hasOlder=false;return raw;}
