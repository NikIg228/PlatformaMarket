import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import { expect } from "vitest";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import type { ConversationsService } from "./conversations.service";
import { SupportService } from "./support.service";

export async function verifyConversationReview(db: PrismaClient, chat: ConversationsService, id: string, buyer: SupplierActorContext, supplier: SupplierActorContext, operator: SupplierActorContext) {
  const support = new SupportService(db as never, { hasAll: async () => true } as never, { link: async () => [] } as never);
  const escalation = { reason: "Synthetic operator assistance", idempotencyKey: randomUUID() };
  const [first, replay] = await Promise.all([chat.escalate(id, escalation, buyer), chat.escalate(id, escalation, buyer)]);
  expect(first).toEqual(replay);
  const ticketId = first.ticketId;
  expect(await db.outboxEvent.count({ where: { aggregateId: ticketId, eventType: "SupportTicketCreated" } })).toBe(1);
  const createdPayload = (await db.outboxEvent.findFirstOrThrow({ where: { aggregateId: ticketId, eventType: "SupportTicketCreated" } })).payload as Record<string, unknown>;
  expect(Object.values(createdPayload)).toContain(operator.organizationId);
  const escalationMessage = (await db.outboxEvent.findFirstOrThrow({ where: { aggregateId: id, eventType: "ConversationMessageSaved" }, orderBy: { createdAt: "desc" } })).payload as Record<string, unknown>;
  expect(Object.values(escalationMessage)).not.toContain(operator.organizationId);
  await expect(chat.escalate(id, { ...escalation, reason: "Different reason" }, buyer)).rejects.toThrow("different command");
  let detail = await chat.get(id, buyer);
  expect(detail.conversation.supportStatus).toBe("OPEN");
  for (const actor of [buyer, supplier]) await expect(chat.resolve(id, detail.conversation.version, actor)).rejects.toThrow("оператор");
  await chat.send(id, { body: "Evidence during review", idempotencyKey: randomUUID() }, supplier);
  expect((await db.outboxEvent.findFirstOrThrow({ where: { aggregateId: id, eventType: "ConversationMessageSaved" }, orderBy: { createdAt: "desc" } })).payload).toEqual(expect.objectContaining({ support0OrganizationId: expect.any(String) }));
  await chat.send(id, { body: "Рассматриваем обращение", idempotencyKey: randomUUID() }, operator);
  expect((await chat.get(id, supplier)).conversation.supportStatus).toBe("IN_PROGRESS");
  await support.addMessage(ticketId, { body: "Private operator note", isInternal: true, attachments: [], idempotencyKey: randomUUID() }, operator);
  expect((await chat.get(id, buyer)).messages.some(message => message.body.includes("Private operator note"))).toBe(false);
  detail = await chat.get(id, buyer);
  await expect(chat.resolve(id, detail.conversation.version, operator)).rejects.toThrow("решение оператора");
  await chat.resolve(id, detail.conversation.version, operator, "Стороны согласовали замену товара.");
  expect((await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } })).status).toBe("RESOLVED");
  for (const actor of [buyer, supplier]) {
    const resolved = await chat.get(id, actor);
    expect(resolved.conversation.resolved).toBe(true);
    expect(resolved.messages.at(-1)?.body).toBe("Решение оператора: Стороны согласовали замену товара.");
  }
  // Older tickets may predate state synchronization; read the ticket authoritatively.
  await db.businessConversation.update({ where: { id }, data: { resolved: false } });
  expect((await chat.get(id, buyer)).conversation.resolved).toBe(true);
  await chat.send(id, { body: "Спасибо", idempotencyKey: randomUUID() }, buyer);
  expect((await chat.get(id, buyer)).conversation.resolved).toBe(true);
  // A delayed original escalation must not reopen a completed review.
  await chat.escalate(id, escalation, buyer);
  expect((await chat.get(id, buyer)).conversation.supportStatus).toBe("RESOLVED");
  const reopen = { reason: "Нужна повторная проверка решения", idempotencyKey: randomUUID() };
  await db.supportTicket.update({ where: { id: ticketId }, data: { priority: "URGENT" } });
  await Promise.all([chat.escalate(id, reopen, supplier), chat.escalate(id, reopen, supplier)]);
  expect((await chat.get(id, buyer)).conversation.supportStatus).toBe("OPEN");
  const ticket = await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
  expect(ticket.firstResponseAt).toBeNull();
  expect(ticket.slaDueAt!.getTime() - Date.now()).toBeGreaterThan(7_190_000);
  expect(ticket.slaDueAt!.getTime() - Date.now()).toBeLessThanOrEqual(7_200_000);
  const update = { expectedVersion: ticket.version, status: "CLOSED" as const, reason: "Private administrative rationale", idempotencyKey: randomUUID() };
  await expect(support.update(ticketId, update, operator)).rejects.toThrow("решение оператора");
  const decision = { ...update, decision: "Проверка завершена, замена подтверждена." };
  const rollback = new Proxy(db, { get(source, property) {
    if (property === "$transaction") return (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => db.$transaction(tx => callback(new Proxy(tx, { get(transaction, name) { return name === "outboxEvent" ? { create: async () => { throw new Error("Synthetic review outbox failure"); } } : Reflect.get(transaction, name); } })));
    return Reflect.get(source, property);
  } });
  const failed = new SupportService(rollback as never, { hasAll: async () => true } as never, {} as never);
  await expect(failed.update(ticketId, decision, operator)).rejects.toThrow("Synthetic review outbox failure");
  expect((await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } })).version).toBe(ticket.version);
  expect((await chat.get(id, buyer)).conversation.resolved).toBe(false);
  // Ticket close races safely with evidence: no split status and one public decision.
  await Promise.all([support.update(ticketId, decision, operator), chat.send(id, { body: "More evidence", idempotencyKey: randomUUID() }, buyer)]);
  await support.update(ticketId, decision, operator);
  expect((await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } })).firstResponseAt).not.toBeNull();
  expect(await db.conversationMessage.count({ where: { conversationId: id, body: `Решение оператора: ${decision.decision}` } })).toBe(1);
  expect((await chat.get(id, supplier)).conversation).toEqual(expect.objectContaining({ supportStatus: "CLOSED", resolved: true }));
  expect((await chat.get(id, supplier)).messages.some(message => message.body.includes(update.reason))).toBe(false);
  const closed = await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
  await support.update(ticketId, { expectedVersion: closed.version, status: "IN_PROGRESS", reason: "Дополнительная проверка обращения", idempotencyKey: randomUUID() }, operator);
  expect((await chat.get(id, buyer)).conversation).toEqual(expect.objectContaining({ supportStatus: "IN_PROGRESS", resolved: false }));
  // Administrative reopening preserves the first-response metric, but a new
  // public operator answer must still move OPEN into IN_PROGRESS in both paths.
  for (const path of ["conversation", "ticket"] as const) {
    const before = await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    await support.update(ticketId, { expectedVersion: before.version, status: "OPEN", reason: "Повторная проверка", idempotencyKey: randomUUID() }, operator);
    if (path === "conversation") await chat.send(id, { body: "Повторно рассматриваем", idempotencyKey: randomUUID() }, operator);
    else await support.addMessage(ticketId, { body: "Ответ после переоткрытия", isInternal: false, attachments: [], idempotencyKey: randomUUID() }, operator);
    const after = await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(after.status).toBe("IN_PROGRESS");
    expect(after.firstResponseAt).toEqual(before.firstResponseAt);
    expect((await chat.get(id, buyer)).conversation.supportStatus).toBe("IN_PROGRESS");
  }
}
