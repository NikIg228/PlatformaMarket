import type { ClientTransport } from "../transport-contract";


export function conversationContext(transport: ClientTransport, contextType: "OFFER" | "ORDER", contextId: string) { return transport.get<import("@marketplace/schemas").ConversationLookup>(`/conversations/context?contextType=${contextType}&contextId=${encodeURIComponent(contextId)}`); }

export function uploadConversationAttachment(transport: ClientTransport, input: import("@marketplace/schemas").UploadConversationAttachmentInput) {
    return transport.post<import("@marketplace/schemas").UploadedConversationAttachment>("/conversations/attachments", input);
  }

export function downloadConversationAttachment(transport: ClientTransport, conversationId: string, messageId: string, assetId: string) {
    return transport.download(`/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(assetId)}`);
  }

export function conversations(transport: ClientTransport, query: Partial<import("@marketplace/schemas").ConversationQuery> = {}) {
    const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
    return transport.get<import("@marketplace/schemas").ConversationPage>(`/conversations?${params}`);
  }

export function conversation(transport: ClientTransport, id: string, beforeSequence?: number) { return transport.get<import("@marketplace/schemas").ConversationDetail>(`/conversations/${encodeURIComponent(id)}${beforeSequence ? `?beforeSequence=${beforeSequence}` : ""}`); }

export function startConversation(transport: ClientTransport, input: import("@marketplace/schemas").StartConversation) { return transport.post<{ conversationId: string }>("/conversations", input); }

export function sendConversationMessage(transport: ClientTransport, id: string, input: import("@marketplace/schemas").ConversationMessageInput) { return transport.post<{ conversationId: string }>(`/conversations/${encodeURIComponent(id)}/messages`, input); }

export function readConversation(transport: ClientTransport, id: string, throughSequence: number) { return transport.post<{ throughSequence: number }>(`/conversations/${encodeURIComponent(id)}/read`, { throughSequence }); }

export function resolveConversation(transport: ClientTransport, id: string, expectedVersion: number, decision?: string) { return transport.post<{ conversationId: string }>(`/conversations/${encodeURIComponent(id)}/resolve`, { expectedVersion, ...(decision ? { decision } : {}) }); }

export function escalateConversation(transport: ClientTransport, id: string, input: import("@marketplace/schemas").ConversationEscalation) { return transport.post<{ ticketId: string }>(`/conversations/${encodeURIComponent(id)}/escalate`, input); }
