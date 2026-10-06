import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { SupportService } from "./support.service";
import { SupportAttachmentsService } from "./support-attachments.service";

it.skipIf(!process.env.POSTGRES_TEST_DATABASE_URL)("support PostgreSQL: tenant, public/internal replies, concurrent replay, reopening and outbox rollback", async () => {
  const target = new URL(process.env.POSTGRES_TEST_DATABASE_URL!);
  expect(["localhost", "127.0.0.1"]).toContain(target.hostname);
  expect(target.pathname).toBe("/dentmarket_audit_20260914");
  expect(process.env.DATABASE_URL).toBe(process.env.POSTGRES_TEST_DATABASE_URL);
  const db = new PrismaClient();
  const customerOrg = randomUUID(), operatorOrg = randomUUID(), otherOrg = randomUUID();
  const customer = { organizationId: customerOrg, actorId: randomUUID() }, operator = { organizationId: operatorOrg, actorId: randomUUID() };
  const attachments = new SupportAttachmentsService(db as unknown as PrismaService, {} as never, {} as never);
  const service = new SupportService(db as unknown as PrismaService, { hasAll: async () => false } as never, attachments);
  const created: string[] = [];
  try {
    expect((await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`)[0].name).toBe("dentmarket_audit_20260914");
    await db.organization.createMany({ data: [customerOrg, operatorOrg, otherOrg].map((id, index) => ({ id, legalName: "Support synthetic fixture", displayName: "Support synthetic fixture", bin: `${Date.now()}`.slice(-11) + index })) });
    await db.organizationCapability.create({ data: { organizationId: operatorOrg, capability: "MARKETPLACE_OPERATOR" } });
    const input = { idempotencyKey: randomUUID(), subject: "Support fixture", description: "Synthetic support description", category: "GENERAL", priority: "NORMAL" as const, links: [] };
    const ticket = await service.create(input, customer); created.push(ticket.id);
    expect((await service.create(input, customer)).id).toBe(ticket.id);
    expect(await db.supportMessage.count({ where: { ticketId: ticket.id } })).toBe(1);
    await expect(service.get(ticket.id, { ...customer, organizationId: otherOrg })).rejects.toThrow("not found");
    const reply = { idempotencyKey: randomUUID(), body: "Synthetic reply", attachments: [], isInternal: false };
    const replies = await Promise.all([service.addMessage(ticket.id, reply, operator), service.addMessage(ticket.id, reply, operator)]);
    expect(replies[0].id).toBe(replies[1].id);
    expect(await db.supportMessage.count({ where: { ticketId: ticket.id } })).toBe(2);
    expect(await db.outboxEvent.count({ where: { aggregateId: ticket.id, eventType: "SupportTicketUpdated" } })).toBe(1);
    const event = await db.outboxEvent.findFirstOrThrow({ where: { aggregateId: ticket.id, eventType: "SupportTicketUpdated" } });
    expect(event.payload).toEqual(expect.objectContaining({ organizationId: customerOrg, action: "MESSAGE" }));
    expect(event.payload).not.toHaveProperty("body");
    await service.addMessage(ticket.id, { ...reply, idempotencyKey: randomUUID(), body: "Private note", isInternal: true }, operator);
    expect((await service.get(ticket.id, customer)).messages.map(message => message.body)).not.toContain("Private note");
    expect((await service.get(ticket.id, customer)).messages[1].authorLabel).toBe("Поддержка");
    expect(await db.outboxEvent.count({ where: { aggregateId: ticket.id, eventType: "SupportTicketUpdated" } })).toBe(1);
    await db.supportTicket.update({ where: { id: ticket.id }, data: { status: "CLOSED", closedAt: new Date(), resolvedAt: new Date() } });
    const reopen = { ...reply, idempotencyKey: randomUUID(), reopen: true, body: "Still needs assistance" };
    await expect(service.addMessage(ticket.id, reopen, operator)).rejects.toThrow("право управления");
    await expect(service.addMessage(ticket.id, { ...reply, idempotencyKey: randomUUID() }, customer)).rejects.toThrow("Откройте его повторно");
    await Promise.all([service.addMessage(ticket.id, reopen, customer), service.addMessage(ticket.id, reopen, customer)]);
    expect(await db.supportTicket.findUnique({ where: { id: ticket.id } })).toEqual(expect.objectContaining({ status: "IN_PROGRESS", closedAt: null, resolvedAt: null }));
    expect(await db.auditLog.count({ where: { entityId: ticket.id, action: "support.ticket.reopened" } })).toBe(1);
    const before = await db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    const rollback = new Proxy(db, { get(source, property) {
      if (property === "$transaction") return (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => db.$transaction(tx => callback(new Proxy(tx, { get(transaction, name) { return name === "outboxEvent" ? { create: async () => { throw new Error("Synthetic outbox failure"); } } : Reflect.get(transaction, name); } })));
      return Reflect.get(source, property);
    } });
    const rollbackService = new SupportService(rollback as unknown as PrismaService, {} as never, attachments);
    await expect(rollbackService.addMessage(ticket.id, { ...reply, idempotencyKey: randomUUID(), body: "Must roll back" }, customer)).rejects.toThrow("Synthetic outbox failure");
    expect(await db.supportMessage.count({ where: { ticketId: ticket.id, body: "Must roll back" } })).toBe(0);
    expect((await db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })).version).toBe(before.version);
    expect((await service.list(customer, "IN_PROGRESS", 0, { q: "support fixture", sort: "recent" })).map(row => row.id)).toEqual([ticket.id]);
    expect(await service.list({ ...customer, organizationId: otherOrg }, undefined, 0, { q: "support fixture" })).toEqual([]);
  } finally {
    await db.supportMessage.deleteMany({ where: { ticketId: { in: created } } });
    await db.supportLink.deleteMany({ where: { ticketId: { in: created } } });
    await db.outboxEvent.deleteMany({ where: { aggregateId: { in: created } } });
    await db.auditLog.deleteMany({ where: { organizationId: { in: [customerOrg, operatorOrg] } } });
    await db.idempotencyRecord.deleteMany({ where: { OR: [{ scope: { contains: customer.actorId } }, { scope: { contains: operator.actorId } }] } });
    await db.supportTicket.deleteMany({ where: { id: { in: created } } });
    await db.organization.deleteMany({ where: { id: { in: [customerOrg, operatorOrg, otherOrg] } } });
    await db.$disconnect();
  }
}, 30_000);
