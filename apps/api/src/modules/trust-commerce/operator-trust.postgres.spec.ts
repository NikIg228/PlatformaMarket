import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, it } from "vitest";
import { OperatorTrustService } from "./operator-trust.service";

it.skipIf(!process.env.POSTGRES_TEST_DATABASE_URL)("operator trust PostgreSQL: stable pages, redaction, atomic rollback and concurrent restoration", async () => {
  const url = new URL(process.env.DATABASE_URL!);
  const expected = process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_ENVIRONMENT === "github-hosted" ? "marketplace" : "dentmarket_audit_20260914";
  if (process.env.DATABASE_URL !== process.env.POSTGRES_TEST_DATABASE_URL || !["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== `/${expected}`) throw new Error("Disposable trust test DB required");
  const db = new PrismaClient(), run = randomUUID();
  const ids: string[] = Array.from({ length: 27 }, () => randomUUID());
  const context = { actorId: randomUUID(), organizationId: randomUUID() };
  const authority = { assertPlatformOperator: async () => {} }, access = { hasAll: async () => true };
  const service = (prisma: object) => new OperatorTrustService(prisma as never, authority as never, access as never);
  try {
    expect((await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`)[0].name).toBe(expected);
    await db.productGapIncident.createMany({ data: ids.map(id => ({ id, subjectType: "TRUST_TEST", subjectId: run, type: "OTHER", severity: "MEDIUM", status: "OPEN", reasonCode: "test", explanation: "Проверка операторской сводки", remediation: "Проверить данные", restorationCondition: "Проверка завершена", idempotencyKey: `${run}:${id}`, createdAt: new Date("2090-01-01T00:00:00Z") })) });
    const appeal = await db.productGapAppeal.create({ data: { incidentId: ids[0], appellantOrganizationId: context.organizationId, appellantUserId: context.actorId, reason: "Оспариваем факт нарушения", evidence: { token: "PRIVATE_EVIDENCE", nested: { secret: "PRIVATE_NESTED" } }, idempotencyKey: run } });
    const first = await service(db).overview({ incidentOffset: 0, supplierOffset: 0 }, context);
    const second = await service(db).overview({ incidentOffset: 25, supplierOffset: 0 }, context);
    expect(first.incidents.status).toBe("AVAILABLE"); expect(second.incidents.status).toBe("AVAILABLE");
    if (first.incidents.status !== "AVAILABLE" || second.incidents.status !== "AVAILABLE") throw Error("Source failure");
    const rows = [...first.incidents.data.items, ...second.incidents.data.items];
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
    expect(rows.filter(row => ids.includes(row.id))).toHaveLength(27);
    expect(first.incidents.data.total).toBeGreaterThanOrEqual(27);
    expect(JSON.stringify(first)).not.toContain("PRIVATE_");
    expect(rows.find(row => row.id === ids[0])?.appeals[0]).toMatchObject({ id: appeal.id, hasEvidence: true });
    await expect(service(db).resolve(ids[0], { version: 1, resolution: "Проверено оператором" }, context)).rejects.toThrow("appeal");
    const original = await db.productGapIncident.findUniqueOrThrow({ where: { id: ids[1] } });
    const failing = new Proxy(db, { get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      return (work: (tx: unknown) => unknown, options: object) => db.$transaction(tx => work(new Proxy(tx, { get(inner, member, proxy) {
        if (member === "auditLog") return { ...inner.auditLog, create: async () => { throw new Error("injected audit failure"); } };
        return Reflect.get(inner, member, proxy);
      } })) as never, options);
    } });
    await expect(service(failing).resolve(ids[1], { version: 1, resolution: "Проверено оператором" }, context)).rejects.toThrow("injected audit failure");
    expect(await db.productGapIncident.findUniqueOrThrow({ where: { id: ids[1] } })).toEqual(original);
    const results = await Promise.allSettled(Array.from({ length: 3 }, () => service(db).resolve(ids[1], { version: 1, resolution: "Проверено оператором" }, context)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected").map(result => (result as PromiseRejectedResult).reason.getStatus())).toEqual([409, 409]);
    expect(await db.auditLog.count({ where: { entityId: ids[1] } })).toBe(1);
    expect(await db.productGapIncident.findUniqueOrThrow({ where: { id: ids[1] } })).toMatchObject({ status: "RESOLVED", actionType: "NONE", version: 2 });
  } finally {
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.productGapIncident.deleteMany({ where: { id: { in: ids } } }); await db.$disconnect();
  }
}, 60000);
