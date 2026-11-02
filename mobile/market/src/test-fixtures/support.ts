import { supportMessageResponseSchema, supportTicketSummarySchema, supportTicketDetailSchema, type SupportTicketSummary, type SupportTicketDetail } from "../../../../packages/schemas/src/support-workflow";
export const supportId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const supportOrganization = supportId(4), supportUser = supportId(20);
const date = "2026-10-29T01:02:03.000Z";
export function supportSummary(overrides: Partial<SupportTicketSummary> = {}): SupportTicketSummary {
  return supportTicketSummarySchema.parse({ id: supportId(60), version: 3, number: "SYNTHETIC-SUP-001", organizationId: supportOrganization, requesterId: supportUser, assigneeId: null, subject: "SYNTHETIC user subject", description: "SYNTHETIC user description", status: "OPEN", priority: "NORMAL", category: "GENERAL", slaDueAt: null, firstResponseAt: null, resolvedAt: null, closedAt: null, tags: [], createdAt: date, updatedAt: date, ...overrides });
}
export function supportDetail(overrides: Partial<SupportTicketDetail> = {}): SupportTicketDetail {
  const ticket = supportSummary(overrides);
  const message = (n: number, authorId: string, attachments: unknown) => supportMessageResponseSchema.parse({ id: supportId(n), ticketId: ticket.id, authorId, authorLabel: "SYNTHETIC server Russian role", body: `SYNTHETIC user body ${n}`, isInternal: false, attachments, createdAt: date });
  return supportTicketDetailSchema.parse({ ...ticket, messages: [message(61, supportUser, null), message(62, supportId(22), []), message(63, supportId(22), [{ assetId: supportId(64), name: "SYNTHETIC attachment.pdf", contentType: "application/pdf", sizeBytes: 123 }])], hasOlder: true, links: [{ id: supportId(65), ticketId: ticket.id, entityType: "SYNTHETIC_UNTRUSTED_TARGET", entityId: "https://private.example.invalid/secret", label: "SYNTHETIC private linked label", createdAt: date }], ...overrides });
}
