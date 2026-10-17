import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OperatorTechnicalService } from "./operator-technical.service";
const context = { actorId: "a", organizationId: "o" };
function fixture() {
  const db = { product: { count: vi.fn().mockResolvedValueOnce(12).mockResolvedValue(2) }, productSearchDocument: { count: vi.fn().mockResolvedValue(10), aggregate: vi.fn().mockResolvedValue({ _max: { updatedAt: new Date("2026-10-17T00:00:00Z") } }) },
    outboxEvent: { groupBy: vi.fn().mockResolvedValue([{ status: "DEAD_LETTER", _count: { _all: 3 } }]) }, notification: { groupBy: vi.fn().mockResolvedValue([{ status: "SENT", _count: { _all: 5 } }]) } };
  const prisma = { ...db, $transaction: vi.fn(async (run: (client: typeof db) => unknown) => run(db)) };
  const authority = { assertPlatformOperator: vi.fn().mockResolvedValue(undefined) }, access = { hasAll: vi.fn().mockResolvedValue(true) }, queue = { health: vi.fn().mockResolvedValue({ status: "ok", configured: true, producer: "ready", consumer: "not_required", counts: { waiting: 2, active: 0, failed: 1, delayed: 0 }, secret: "PRIVATE" }) };
  return { prisma, authority, access, queue, service: new OperatorTechnicalService(prisma as never, authority as never, access as never, queue as never) };
}
describe("technical read projection", () => {
  it("reads actual aggregate counts and limits queue claims to the current process", async () => {
    const f = fixture(), result = await f.service.get(context);
    expect(result).toMatchObject({ canReplay: true, search: { status: "AVAILABLE", data: { products: 12, indexed: 10, missing: 2 } }, outbox: { data: { pending: 0, deadLetter: 3 } }, notifications: { data: { sent: 5 } }, background: { data: { scope: "CURRENT_PROCESS", consumer: "not_required" } } });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("distinguishes failed sources from zero without hiding other sources", async () => {
    const f = fixture(); f.prisma.product.count.mockRejectedValue(new Error("PRIVATE_DATABASE")); f.queue.health.mockRejectedValue(new Error("PRIVATE_REDIS"));
    const result = await f.service.get(context);
    expect(result.search).toEqual({ status: "UNAVAILABLE", data: null, reason: "SOURCE_UNAVAILABLE" }); expect(result.background.status).toBe("UNAVAILABLE"); expect(result.outbox.status).toBe("AVAILABLE");
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("does not read forbidden sources or grant replay from view permission", async () => {
    const f = fixture(); f.access.hasAll.mockImplementation(async (_a, _o, rights: string[]) => rights[0] === "operations.outbox.view");
    const result = await f.service.get(context); expect(result.canReplay).toBe(false); expect(result.search.status).toBe("FORBIDDEN"); expect(result.notifications.status).toBe("FORBIDDEN");
    expect(f.prisma.product.count).not.toHaveBeenCalled(); expect(f.prisma.notification.groupBy).not.toHaveBeenCalled();
  });
  it("denies platform/view before sources and propagates authorization failure", async () => {
    const f = fixture(); f.authority.assertPlatformOperator.mockRejectedValue(new ForbiddenException());
    await expect(f.service.get(context)).rejects.toBeInstanceOf(ForbiddenException); expect(f.prisma.outboxEvent.groupBy).not.toHaveBeenCalled();
    f.authority.assertPlatformOperator.mockResolvedValue(undefined); f.access.hasAll.mockResolvedValue(false);
    await expect(f.service.get(context)).rejects.toBeInstanceOf(ForbiddenException); expect(f.queue.health).not.toHaveBeenCalled();
    f.access.hasAll.mockResolvedValue(true); f.prisma.outboxEvent.groupBy.mockRejectedValue(new ForbiddenException());
    await expect(f.service.get(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
