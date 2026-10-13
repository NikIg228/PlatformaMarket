import { expect, it, vi } from "vitest";
import { NotificationsService } from "../notifications/notifications.service";

it("delivers a review message to the other party and support, excluding its author organization", async () => {
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({}) }, notificationPreference: { findMany: vi.fn().mockResolvedValue([]) }, notification: { createMany } };
  const service = new NotificationsService(prisma as never, {} as never, {} as never, {} as never);
  await service.projectOutboxEvent({ id: "event", aggregateType: "BusinessConversation", aggregateId: "chat", eventType: "ConversationMessageSaved", payload: { conversationId: "chat", authorOrganization: "buyer", buyerOrganizationId: "buyer", supplierOrganizationId: "supplier", support0OrganizationId: "operator" } });
  expect(createMany.mock.calls.map(call => call[0].data.recipientOrganizationId)).toEqual(["supplier", "operator"]);
  expect(createMany.mock.calls.every(call => call[0].skipDuplicates)).toBe(true);
});

it.each([
  ["MESSAGE", "В обращении появилось новое сообщение. Откройте переписку."],
  ["REOPEN", "Обращение снова открыто. Посмотрите уточнение в переписке."],
])("projects a %s support event to its audience without message content", async (action, body) => {
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({}) }, notificationPreference: { findMany: vi.fn().mockResolvedValue([]) }, notification: { createMany } };
  const service = new NotificationsService(prisma as never, {} as never, {} as never, {} as never);
  const event = { id: "event", aggregateType: "SupportTicket", aggregateId: "ticket", eventType: "SupportTicketUpdated", payload: { ticketId: "ticket", action, support0OrganizationId: "operator-org" } };
  await service.projectOutboxEvent(event);
  expect(createMany).toHaveBeenCalledTimes(1);
  expect(createMany.mock.calls[0][0]).toEqual(expect.objectContaining({ skipDuplicates: true, data: expect.objectContaining({ recipientOrganizationId: "operator-org", body, aggregateType: "SupportTicket", aggregateId: "ticket", idempotencyKey: "outbox:event:operator-org:org:IN_APP" }) }));
});
