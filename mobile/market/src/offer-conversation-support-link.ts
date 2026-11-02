import { z } from "zod";
import type { SupportTicketDetail } from "../../../packages/schemas/src/support-workflow";
import { acceptsOwnedConversationSupportBody } from "./conversation-support-binding";
import type { OfferConversationWindow } from "./offer-conversation-read";
import type { ReadScope } from "./read-controller";
export type OfferSupportSelection=Readonly<{offerId:string;productId:string|null;variantId:string|null;buyerOrganizationId:string;supplierOrganizationId:string;conversationId:string;conversationVersion:number;ticketId:string}>;
export type OfferSupportOrigin=Readonly<OfferSupportSelection>;
/** A verified OFFER parent pointer never grants access to another organization's ticket. */
export function createOfferConversationSupportLinks(scope:ReadScope,currentWindow:()=>OfferConversationWindow|null,supportsRead=true){
 const owner=Object.freeze({...scope});let active=true,issued=new WeakMap<OfferSupportSelection,OfferConversationWindow>(),origins=new WeakSet<OfferSupportOrigin>();
 const value=(w:OfferConversationWindow):OfferSupportSelection|null=>{if(!active||!supportsRead||currentWindow()!==w||!w.conversation||w.context.buyerOrganizationId!==owner.organizationId||w.context.supplierOrganizationId===owner.organizationId||w.conversation.buyerOrganizationId!==owner.organizationId||w.conversation.contextType!=="OFFER"||w.conversation.contextId!==w.context.offerId||w.conversation.productId!==w.context.productId||w.conversation.supplierOrganizationId!==w.context.supplierOrganizationId||!z.uuid().safeParse(w.conversation.supportTicketId).success)return null;return Object.freeze({offerId:w.context.offerId,productId:w.context.productId,variantId:w.context.variantId,buyerOrganizationId:w.context.buyerOrganizationId,supplierOrganizationId:w.context.supplierOrganizationId,conversationId:w.conversation.id,conversationVersion:w.conversation.version,ticketId:w.conversation.supportTicketId!});};
 const isOrigin=(origin:OfferSupportOrigin)=>active&&typeof origin==="object"&&origin!==null&&origins.has(origin);
 const acceptsRaw=(body:unknown,origin:OfferSupportOrigin,minimumVersion=0)=>isOrigin(origin)&&acceptsOwnedConversationSupportBody(body,owner.organizationId,origin,minimumVersion);
 return {isOrigin,acceptsRaw,
  select(w:OfferConversationWindow){const target=value(w);if(target)issued.set(target,w);return target;},
  take(target:OfferSupportSelection){if(!active)return null;const w=issued.get(target);if(!w)return null;const current=value(w);if(!current||Object.keys(current).some(key=>current[key as keyof OfferSupportSelection]!==target[key as keyof OfferSupportSelection]))return null;issued.delete(target);const origin=Object.freeze({...target});origins.add(origin);return origin;},
  accepts(ticket:SupportTicketDetail,origin:OfferSupportOrigin){return acceptsRaw(ticket,origin);},
  activate(){active=true;},close(){active=false;issued=new WeakMap();origins=new WeakSet();},
 };
}
export type OfferConversationSupportLinks=ReturnType<typeof createOfferConversationSupportLinks>;
