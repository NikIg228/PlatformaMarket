import { offerConversationScope as scope, offerConversationThreadId as threadId, offerConversationId as uuid, offerConversationPage } from "./offer-conversation";
import { conversationSupportTicket } from "./conversation-support";
export const offerSupportTicketId=uuid(50000);
export function offerWithSupport(){const raw=offerConversationPage();raw.messages=raw.messages.slice(-2);raw.hasOlder=false;raw.conversation.supportTicketId=offerSupportTicketId;raw.conversation.supportStatus="OPEN";return raw;}
export function offerSupportTicket(before?:string){const raw=conversationSupportTicket(before);raw.id=offerSupportTicketId;raw.organizationId=scope.organizationId;raw.requesterId=scope.userId;raw.subject="SYNTHETIC offer support subject";raw.description="SYNTHETIC offer support description";raw.links=raw.links.map(row=>({...row,ticketId:offerSupportTicketId,entityId:threadId}));raw.messages=raw.messages.map(row=>({...row,ticketId:offerSupportTicketId}));return raw;}
