import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, it } from "vitest";
import { notificationInboxQuerySchema } from "@marketplace/schemas";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { NotificationInboxReader } from "./notification-inbox";

it.skipIf(!process.env.POSTGRES_TEST_DATABASE_URL)("inbox PostgreSQL isolates tenant, recipient, event scope and snapshot with idempotent bulk read", async () => {
  const target = new URL(process.env.POSTGRES_TEST_DATABASE_URL!);
  expect(["localhost", "127.0.0.1"]).toContain(target.hostname);
  expect(target.pathname).toBe("/dentmarket_audit_20260914");
  expect(process.env.DATABASE_URL).toBe(process.env.POSTGRES_TEST_DATABASE_URL);
  const db = new PrismaClient();
  const first = randomUUID(), second = randomUUID(), actor = randomUUID(), other = randomUUID();
  try {
    expect((await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`)[0].name).toBe("dentmarket_audit_20260914");
    await db.organization.createMany({ data: [first, second].map((id, index) => ({ id, legalName: "Inbox synthetic fixture", displayName: "Inbox synthetic fixture", bin: `${Date.now()}`.slice(-11) + index })) });
    const before = new Date(Date.now() - 10_000), old = new Date(before.getTime() - 10_000);
    const rows = [
      { id: randomUUID(), recipientOrganizationId: first },
      { id: randomUUID(), recipientOrganizationId: first, recipientUserId: actor },
      { id: randomUUID(), recipientOrganizationId: first, recipientUserId: other },
      { id: randomUUID(), recipientOrganizationId: second },
      { id: randomUUID(), recipientOrganizationId: first, eventType: "CompliancePassed" },
      { id: randomUUID(), recipientOrganizationId: first, createdAt: new Date() },
    ];
    await db.notification.createMany({ data: rows.map(row => ({ eventType: "SupportTicketUpdated", channel: "IN_APP", subject: "Synthetic", body: "Synthetic", createdAt: old, ...row, idempotencyKey: row.id })) });
    const reader = new NotificationInboxReader(db as unknown as PrismaService), context = { actorId: actor, organizationId: first };
    const page = await reader.read(context, notificationInboxQuerySchema.parse({ limit: 1 }));
    expect(page.items).toHaveLength(1); expect(page.unreadCount).toBe(3); expect(page.nextCursor).toBeTruthy();
    const next = await reader.read(context, notificationInboxQuerySchema.parse({ limit: 1, cursor: page.nextCursor }));
    expect(next.items[0].id).not.toBe(page.items[0].id);
    expect(await reader.readAll(context, before.toISOString())).toEqual({ count: 2 });
    expect(await reader.readAll(context, before.toISOString())).toEqual({ count: 0 });
    const untouched = await db.notification.findMany({ where: { id: { in: rows.slice(2).map(row => row.id) } } });
    expect(untouched.every(row => row.readAt === null)).toBe(true);
    expect((await reader.read(context, notificationInboxQuerySchema.parse({ unreadOnly: "true" }))).items.map(row => row.id)).toEqual([rows[5].id]);
    const cancelled = randomUUID(), transfer = randomUUID();
    await db.notification.createMany({ data: [{ id: cancelled, action: "CANCEL" }, { id: transfer, action: "REPORT_TRANSFER" }].map(row => ({ id: row.id, idempotencyKey: row.id, recipientOrganizationId: first, eventType: "OrderWorkflowChanged", channel: "IN_APP", subject: "Synthetic", body: "Synthetic", payload: { action: row.action } })) });
    expect((await reader.read(context, notificationInboxQuerySchema.parse({ category: "orders" }))).items.map(row => row.id)).toEqual([cancelled]);
    expect((await reader.read(context, notificationInboxQuerySchema.parse({ category: "payments" }))).items.map(row => row.id)).toEqual([transfer]);
  } finally {
    await db.organization.deleteMany({ where: { id: { in: [first, second] } } });
    await db.$disconnect();
  }
}, 30_000);
