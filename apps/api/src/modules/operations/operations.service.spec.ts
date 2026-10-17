import { describe, expect, it, vi } from "vitest";
import { OperationsService } from "./operations.service";
import { ForbiddenException } from "@nestjs/common";


function prismaFixture() {
  const fixture = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    organizationCapability: { findUnique: vi.fn() },
    operationAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    supplierTermsAcceptance: { findMany: vi.fn().mockResolvedValue([]) },
    promotion: { findMany: vi.fn().mockResolvedValue([]) },
    productCandidate: { findMany: vi.fn().mockResolvedValue([]) },
    complianceCheck: { findMany: vi.fn().mockResolvedValue([]) },
    integrationReconciliationEntry: { findMany: vi.fn().mockResolvedValue([]) },
    importBatch: { findMany: vi.fn().mockResolvedValue([]) },
    marketplaceAgreement: { findMany: vi.fn().mockResolvedValue([]) },
    supplierOrder: { findMany: vi.fn().mockResolvedValue([]) },
    inventoryBalance: { findMany: vi.fn().mockResolvedValue([]) },
    outboxEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    idempotencyRecord: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "idempotency-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  return Object.assign(fixture, {
    $transaction: vi.fn(async (callback: (tx: typeof fixture) => unknown) =>
      callback(fixture),
    ),
  });
}
function serviceFor(prisma: ReturnType<typeof prismaFixture>) {
  return new OperationsService(prisma as never, { assertPlatformOperator: vi.fn().mockResolvedValue(undefined) } as never, { hasAll: vi.fn().mockResolvedValue(true) } as never);
}

describe("OperationsService", () => {
  it("lists only dead-letter metadata for an authorized operator", async () => {
    const prisma = prismaFixture();
    prisma.organizationCapability.findUnique.mockResolvedValue({
      organizationId: "operator",
    });
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000101",
        aggregateType: "Order",
        aggregateId: "order-1",
        eventType: "order.created",
        status: "DEAD_LETTER",
        attempts: 10,
        maxAttempts: 10,
        availableAt: new Date("2026-08-20T10:00:00.000Z"),
        lockedAt: null,
        publishedAt: null,
        lastError: "handler failed",
        createdAt: new Date("2026-08-20T09:00:00.000Z"),
      },
    ]);
    prisma.outboxEvent.count.mockResolvedValue(1);
    const result = await serviceFor(prisma).listDeadLetters(
      { limit: 50, offset: 0 },
      { actorId: "user", organizationId: "operator" },
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      status: "DEAD_LETTER",
      eventType: "order.created",
    });
    expect(result.items[0]).not.toHaveProperty("payload");
    expect(result.items[0].lastError).not.toContain("handler failed");
  });

  it("replays a dead-letter event atomically with a fresh retry budget and audit record", async () => {
    const prisma = prismaFixture();
    prisma.organizationCapability.findUnique.mockResolvedValue({
      organizationId: "operator",
    });
    prisma.outboxEvent.findUnique.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000101",
      aggregateType: "Order",
      aggregateId: "order-1",
      eventType: "order.created",
      status: "DEAD_LETTER",
      attempts: 10,
      maxAttempts: 10,
      availableAt: new Date("2026-08-20T10:00:00.000Z"),
      lockedAt: null,
      publishedAt: null,
      lastError: "handler failed",
      createdAt: new Date("2026-08-20T09:00:00.000Z"),
    });
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    const eventId = "00000000-0000-4000-8000-000000000101";
    const result = await serviceFor(prisma).replayDeadLetter(
      eventId,
      {
        idempotencyKey: "replay-key-1",
        reason: "Retry after correcting the downstream handler",
      },
      { actorId: "user", organizationId: "operator" },
    );
    expect(result).toMatchObject({ eventId, status: "PENDING", attempts: 0 });
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: eventId, status: "DEAD_LETTER" },
        data: expect.objectContaining({
          status: "PENDING",
          attempts: 0,
          lastError: null,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "outbox.dead_letter.replayed",
          entityId: eventId,
        }),
      }),
    );
    expect(prisma.idempotencyRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ responseCode: 200 }),
      }),
    );
  });

  it("returns the stored response for a repeated replay key and rejects key reuse for another event", async () => {
    const prisma = prismaFixture();
    prisma.organizationCapability.findUnique.mockResolvedValue({
      organizationId: "operator",
    });
    prisma.outboxEvent.findUnique.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000101",
      status: "DEAD_LETTER",
      attempts: 10,
      lastError: "handler failed",
    });
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    const service = serviceFor(prisma);
    const first = await service.replayDeadLetter(
      "00000000-0000-4000-8000-000000000101",
      {
        idempotencyKey: "replay-key-1",
        reason: "Retry after correcting the downstream handler",
      },
      { actorId: "user", organizationId: "operator" },
    );
    const requestHash =
      prisma.idempotencyRecord.create.mock.calls[0][0].data.requestHash;
    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash,
      responseCode: 200,
      responseBody: first,
    });
    const repeated = await service.replayDeadLetter(
      "00000000-0000-4000-8000-000000000101",
      {
        idempotencyKey: "replay-key-1",
        reason: "Retry after correcting the downstream handler",
      },
      { actorId: "user", organizationId: "operator" },
    );
    expect(repeated).toEqual(first);
    await expect(
      service.replayDeadLetter(
        "00000000-0000-4000-8000-000000000102",
        {
          idempotencyKey: "replay-key-1",
          reason: "Retry after correcting the downstream handler",
        },
        { actorId: "user", organizationId: "operator" },
      ),
    ).rejects.toThrow("already used");
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledTimes(1);
  });

  it("does not replay a non-dead-letter event", async () => {
    const prisma = prismaFixture();
    prisma.organizationCapability.findUnique.mockResolvedValue({
      organizationId: "operator",
    });
    prisma.outboxEvent.findUnique.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000101",
      status: "PUBLISHED",
    });
    await expect(
      serviceFor(prisma).replayDeadLetter(
        "00000000-0000-4000-8000-000000000101",
        {
          idempotencyKey: "replay-key-2",
          reason: "Retry after a verified handler repair",
        },
        { actorId: "user", organizationId: "operator" },
      ),
    ).rejects.toThrow("Only DEAD_LETTER");
    expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
  });
  it("requires active platform authority and the operation permission before reads/replay", async () => {
    for (const denyAuthority of [true, false]) {
      const prisma = prismaFixture(), authority = { assertPlatformOperator: vi.fn(async () => { if (denyAuthority) throw new ForbiddenException(); }) }, access = { hasAll: vi.fn().mockResolvedValue(false) };
      const service = new OperationsService(prisma as never, authority as never, access as never);
      await expect(service.listDeadLetters({ limit: 25, offset: 0 }, { actorId: "a", organizationId: "o" })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.replayDeadLetter("id", { reason: "Verified reason", idempotencyKey: "repeat-key" }, { actorId: "a", organizationId: "o" })).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.outboxEvent.findMany).not.toHaveBeenCalled(); expect(prisma.idempotencyRecord.findUnique).not.toHaveBeenCalled();
    }
  });
  it("binds replay to the original actor and the reviewed failure", async () => {
    const prisma = prismaFixture(), service = serviceFor(prisma), date = new Date("2026-10-17T00:00:00Z");
    prisma.outboxEvent.findUnique.mockResolvedValue({ id: "event", status: "DEAD_LETTER", attempts: 10, availableAt: date });
    const input = { idempotencyKey: "same-key", reason: "Verified event handler", expectedAttempts: 10, expectedAvailableAt: date.toISOString() };
    await expect(service.replayDeadLetter("event", { ...input, expectedAttempts: 9 }, { actorId: "a", organizationId: "o" })).rejects.toThrow("Failure state changed");
    expect(prisma.outboxEvent.updateMany).not.toHaveBeenCalled();
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    const result = await service.replayDeadLetter("event", input, { actorId: "a", organizationId: "o" });
    const requestHash = prisma.idempotencyRecord.create.mock.calls.at(-1)![0].data.requestHash;
    prisma.idempotencyRecord.findUnique.mockResolvedValue({ requestHash, responseCode: 200, responseBody: result });
    await expect(service.replayDeadLetter("event", input, { actorId: "other", organizationId: "o" })).rejects.toThrow("already used");
    await expect(service.replayDeadLetter("event", input, { actorId: "a", organizationId: "other" })).rejects.toThrow("already used");
  });
});
