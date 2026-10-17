import { describe, expect, it } from "vitest";
import { operatorAuditQuerySchema, operatorAuditPageSchema } from "./operator-audit";
import { outboxDeadLetterQuerySchema, outboxReplaySchema } from "./core-api";
describe("operator audit contract", () => {
  it("bounds paging and accepts exact participant/object and real calendar ranges", () => {
    expect(operatorAuditQuerySchema.parse({})).toEqual({ offset: 0, limit: 25 });
    expect(operatorAuditQuerySchema.parse({ offset: "25", dateFrom: "2026-10-01", dateTo: "2026-10-17" })).toMatchObject({ offset: 25 });
    for (const input of [{ limit: 101 }, { offset: -1 }, { offset: "1e2" }, { actorId: "bad" }, { organizationId: "bad" }, { dateFrom: "2026-02-30" }, { dateFrom: "2026-10-18", dateTo: "2026-10-17" }, { action: "\u0000" }, { scope: "all" }]) expect(operatorAuditQuerySchema.safeParse(input).success).toBe(false);
  });
  it("does not accept raw snapshots in its explicit output", () => {
    const entry = { id: "73000000-0000-4000-8000-000000000001", action: "changed", entityType: "SupplierOrder", entityId: "test", createdAt: "2026-10-17T00:00:00Z", actor: null, organization: null, changes: [], redacted: true, href: null };
    expect(operatorAuditPageSchema.safeParse({ items: [entry], total: 1, offset: 0, limit: 25 }).success).toBe(true);
    expect(operatorAuditPageSchema.safeParse({ items: [{ ...entry, before: { password: "private" } }], total: 1, offset: 0, limit: 25 }).success).toBe(false);
  });
  it("keeps legacy replay compatible but requires a complete failure precondition pair", () => {
    const input = { idempotencyKey: "command-key", reason: "Verified handler recovery" };
    expect(outboxReplaySchema.safeParse(input).success).toBe(true);
    expect(outboxReplaySchema.safeParse({ ...input, expectedAttempts: 10 }).success).toBe(false);
    expect(outboxReplaySchema.safeParse({ ...input, expectedAttempts: 10, expectedAvailableAt: "2026-10-17T00:00:00Z" }).success).toBe(true);
    expect(outboxDeadLetterQuerySchema.parse({})).toEqual({ limit: 50, offset: 0 });
    expect(outboxDeadLetterQuerySchema.safeParse({ offset: -1 }).success).toBe(false);
    expect(outboxDeadLetterQuerySchema.safeParse({ eventId: "bad" }).success).toBe(false);
  });
});
