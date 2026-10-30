import type { ClientTransport } from "../transport-contract";


export function createSupportTicket(transport: ClientTransport, input: import("@marketplace/schemas").CreateSupportTicketInput) { return transport.post<import("@marketplace/schemas").SupportTicketSummary>("/support/tickets", input); }

export function supportTickets(transport: ClientTransport, status?: string, offset = 0, options: { q?: string; sort?: "queue" | "recent" } = {}) { const query = new URLSearchParams({ offset: String(offset) }); if (status) query.set("status", status); if (options.q) query.set("q", options.q); if (options.sort) query.set("sort", options.sort); return transport.get<import("@marketplace/schemas").SupportTicketSummary[]>(`/support/tickets?${query}`); }

export function supportTicket(transport: ClientTransport, id: string, beforeMessageId?: string) { return transport.get<import("@marketplace/schemas").SupportTicketDetail>(`/support/tickets/${encodeURIComponent(id)}${beforeMessageId ? `?beforeMessageId=${encodeURIComponent(beforeMessageId)}` : ""}`); }

export function updateSupportTicket(transport: ClientTransport, id: string, input: import("@marketplace/schemas").UpdateSupportTicketInput) { return transport.patch<import("@marketplace/schemas").SupportTicketSummary>(`/support/tickets/${encodeURIComponent(id)}`, input); }

export function supportTicketHistory(transport: ClientTransport, id: string) { return transport.get<import("@marketplace/schemas").OperationHistory>(`/support/tickets/${encodeURIComponent(id)}/history`); }

export function addSupportMessage(transport: ClientTransport, id: string, input: import("@marketplace/schemas").AddSupportMessageInput) { return transport.post<import("@marketplace/schemas").SupportTicketDetail["messages"][number]>(`/support/tickets/${encodeURIComponent(id)}/messages`, input); }

export function uploadSupportAttachment(transport: ClientTransport, input: import("@marketplace/schemas").UploadSupportAttachmentInput) {
    return transport.post<import("@marketplace/schemas").UploadedSupportAttachment>("/support/attachments", input);
  }

export function downloadSupportAttachment(transport: ClientTransport, ticketId: string, messageId: string, assetId: string) {
    return transport.download(`/support/tickets/${encodeURIComponent(ticketId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(assetId)}`);
  }
