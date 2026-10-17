import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, it, vi } from "vitest";
import { OperationsService } from "./operations.service";
import { OperatorAuditService } from "./operator-audit.service";

it.skipIf(!process.env.POSTGRES_TEST_DATABASE_URL)("operator control PostgreSQL: stable audit paging, atomic rollback and concurrent event replay", async () => {
  const url = new URL(process.env.DATABASE_URL!), expected = process.env.GITHUB_ACTIONS === "true" ? "marketplace" : "dentmarket_audit_20260914";
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== `/${expected}`) throw new Error("Disposable operator-control DB required");
  const db = new PrismaClient(), run = randomUUID(), keys: string[] = [], events: string[] = [], context = { actorId: randomUUID(), organizationId: randomUUID() };
  const authority = { assertPlatformOperator: vi.fn().mockResolvedValue(undefined) }, access = { hasAll: vi.fn().mockResolvedValue(true) };
  const service = new OperationsService(db as never, authority as never, access as never);
  const command = (date: Date, attempts = 10) => { const key = randomUUID(); keys.push(key); return { idempotencyKey: key, reason: "Проверен обработчик тестового события", expectedAvailableAt: date.toISOString(), expectedAttempts: attempts }; };
  try {
    const [identity] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    if (identity.name !== expected) throw new Error("Wrong test database");
    await db.auditLog.createMany({ data: Array.from({ length: 27 }, (_, index) => ({ actorId: context.actorId, organizationId: index % 2 ? context.organizationId : randomUUID(), entityType: "CONTROL_TEST", entityId: run, action: "control.test.changed", createdAt: new Date("2026-10-17T00:00:00Z"), before: { version: 1, password: "PRIVATE_AUDIT" }, after: { version: 2, credential: { token: "PRIVATE_NESTED" } } })) });
    const audit = new OperatorAuditService(db as never, authority as never, access as never), query = { entityId: run, limit: 25, offset: 0 };
    const first = await audit.list(query, context), second = await audit.list({ ...query, offset: 25 }, context);
    expect(first.total).toBe(27); expect(first.items).toHaveLength(25); expect(second.items).toHaveLength(2);
    expect(new Set([...first.items, ...second.items].map(row => row.id)).size).toBe(27);
    expect(JSON.stringify(first)).not.toContain("PRIVATE_");
    expect((await audit.list({ ...query, organizationId: context.organizationId }, context)).total).toBe(13);

    const event = await db.outboxEvent.create({ data: { aggregateType: "CONTROL_TEST", aggregateId: run, eventType: "control.test.replay", payload: { private: "PRIVATE_PAYLOAD", amount: "9007199254740993" }, status: "DEAD_LETTER", attempts: 10, lastError: "PRIVATE_TOKEN" } }); events.push(event.id);
    const failing = new Proxy(db, { get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      return (work: (tx: unknown) => unknown, options: object) => db.$transaction(tx => work(new Proxy(tx, { get(inner, member, proxy) {
        if (member === "auditLog") return { ...inner.auditLog, create: async () => { throw new Error("injected audit failure"); } };
        return Reflect.get(inner, member, proxy);
      } })) as never, options);
    } });
    const rollback = command(event.availableAt);
    await expect(new OperationsService(failing as never, authority as never, access as never).replayDeadLetter(event.id, rollback, context)).rejects.toThrow("injected audit failure");
    expect(await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).toEqual(event);
    expect(await db.idempotencyRecord.count({ where: { scope: "outbox.dead-letter.replay", key: rollback.idempotencyKey } })).toBe(0);
    const input = command(event.availableAt), results = await Promise.all(Array.from({ length: 4 }, () => service.replayDeadLetter(event.id, input, context)));
    for (const result of results) expect(result).toEqual(results[0]);
    expect(await db.auditLog.count({ where: { entityId: event.id } })).toBe(1);
    const after = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(after).toMatchObject({ status: "PENDING", attempts: 0, payload: event.payload, aggregateId: event.aggregateId, eventType: event.eventType });
    await db.outboxEvent.update({ where: { id: event.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    expect(await service.replayDeadLetter(event.id, input, context)).toEqual(results[0]);
    await expect(service.replayDeadLetter(event.id, input, { ...context, actorId: randomUUID() })).rejects.toThrow("already used");
    const other = await db.outboxEvent.create({ data: { aggregateType: "CONTROL_TEST", aggregateId: run, eventType: "control.test.replay", payload: {}, status: "DEAD_LETTER", attempts: 10 } }); events.push(other.id);
    const raced = await Promise.allSettled(Array.from({ length: 3 }, () => service.replayDeadLetter(other.id, command(other.availableAt), context)));
    expect(raced.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(raced.filter(result => result.status === "rejected").map(result => (result as PromiseRejectedResult).reason.getStatus())).toEqual([409, 409]);
    expect(await db.auditLog.count({ where: { entityId: other.id } })).toBe(1);
  } finally {
    await db.auditLog.deleteMany({ where: { entityId: { in: [run, ...events] } } });
    await db.idempotencyRecord.deleteMany({ where: { scope: "outbox.dead-letter.replay", key: { in: keys } } });
    await db.outboxEvent.deleteMany({ where: { id: { in: events } } }); await db.$disconnect();
  }
}, 60000);
