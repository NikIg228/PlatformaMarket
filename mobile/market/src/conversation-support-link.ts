import { acceptsOwnedConversationSupportBody } from "./conversation-support-binding";
import { z } from "zod";
import type { SupportTicketDetail } from "../../../packages/schemas/src/support-workflow";
import type { OrderConversationWindow } from "./order-conversation-read";
import type { ReadScope } from "./read-controller";
export type ConversationSupportSelection=Readonly<{orderId:string;orderVersion:number;conversationId:string;conversationVersion:number;ticketId:string}>;
export type ConversationSupportOrigin=Readonly<ConversationSupportSelection>;
/** Parent pointer selects only an existing protected GET. It never grants access to a ticket. */
export function createConversationSupportLinks(scope:ReadScope,currentWindow:()=>OrderConversationWindow|null,supportsRead=true){
 const owner=Object.freeze({...scope});let active=true,issued=new WeakMap<ConversationSupportSelection,OrderConversationWindow>(),origins=new WeakSet<ConversationSupportOrigin>();
 const value=(window:OrderConversationWindow):ConversationSupportSelection|null=>{if(!active||!supportsRead||currentWindow()!==window||!window.conversation||window.context.buyerOrganizationId!==owner.organizationId||window.conversation.buyerOrganizationId!==owner.organizationId||window.conversation.contextType!=="ORDER"||window.conversation.contextId!==window.context.orderId||window.conversation.supplierOrganizationId!==window.context.supplierOrganizationId||!z.uuid().safeParse(window.conversation.supportTicketId).success)return null;return Object.freeze({orderId:window.context.orderId,orderVersion:window.context.orderVersion,conversationId:window.conversation.id,conversationVersion:window.conversation.version,ticketId:window.conversation.supportTicketId!});};
 const isOrigin=(origin:ConversationSupportOrigin)=>active&&typeof origin==="object"&&origin!==null&&origins.has(origin);
 const acceptsRaw=(body:unknown,origin:ConversationSupportOrigin,minimumVersion=0)=>isOrigin(origin)&&acceptsOwnedConversationSupportBody(body,owner.organizationId,origin,minimumVersion);
 return {isOrigin,acceptsRaw,
  select(window:OrderConversationWindow){const target=value(window);if(target)issued.set(target,window);return target;},
  take(target:ConversationSupportSelection){if(!active)return null;const window=issued.get(target);if(!window)return null;const current=value(window);if(!current||Object.keys(current).some(key=>current[key as keyof ConversationSupportSelection]!==target[key as keyof ConversationSupportSelection]))return null;issued.delete(target);const origin=Object.freeze({...target});origins.add(origin);return origin;},
  accepts(ticket:SupportTicketDetail,origin:ConversationSupportOrigin){return acceptsRaw(ticket,origin);},
  activate(){active=true;},close(){active=false;issued=new WeakMap();origins=new WeakSet();},
 };
}
export type ConversationSupportLinks=ReturnType<typeof createConversationSupportLinks>;
