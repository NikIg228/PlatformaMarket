import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OperatorAuditService } from "./operator-audit.service";
import { OperatorAuditController } from "./operator-audit.controller";
import { auditChanges, auditObjectHref } from "./operator-audit.projection";
const id = (n: number) => `73000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const context = { actorId: id(1), organizationId: id(2) };
function fixture() {
  const row = { id: id(3), actorId: id(4), organizationId: id(5), action: "order.confirmed", entityType: "SupplierOrder", entityId: id(6), createdAt: new Date("2026-10-17T00:00:00Z"),
    before: { status: "AWAITING_CONFIRMATION", version: 1, password: "PRIVATE_OLD" }, after: { status: "CONFIRMED", version: 2, nested: { token: "PRIVATE_NEW" }, email: "PRIVATE_CONTACT" } };
  const tx = { auditLog: { count: vi.fn().mockResolvedValue(30), findMany: vi.fn().mockResolvedValue([row]) },
    user: { findMany: vi.fn().mockResolvedValue([{ id: id(4), displayName: "Сотрудник" }]) }, organization: { findMany: vi.fn().mockResolvedValue([{ id: id(5), displayName: "Клиника" }]) } };
  const prisma = { $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)) };
  const authority = { assertPlatformOperator: vi.fn().mockResolvedValue(undefined) }, access = { hasAll: vi.fn().mockResolvedValue(true) };
  return { tx, row, prisma, authority, access, service: new OperatorAuditService(prisma as never, authority as never, access as never) };
}
describe("platform audit projection", () => {
  it("returns bounded safe changes and real identities with permission-aware source links", async () => {
    const f = fixture(), result = await f.service.list({ offset: 25, limit: 25 }, context);
    expect(result).toMatchObject({ total: 30, offset: 25, items: [{ actor: { id: id(4), name: "Сотрудник" }, organization: { id: id(5), name: "Клиника" }, redacted: true,
      changes: [{ field: "status", before: "AWAITING_CONFIRMATION", after: "CONFIRMED" }, { field: "version", before: "1", after: "2" }], href: `/admin?section=orders&orderId=${id(6)}` }] });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(f.tx.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 25, take: 25, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect(f.tx.user.findMany).toHaveBeenCalledWith({ where: { id: { in: [id(4)] } }, select: { id: true, displayName: true } });
  });
  it("applies every filter to count/list, with inclusive Kazakhstan dates and no implicit operator tenant filter", async () => {
    const f = fixture(); await f.service.list({ offset: 0, limit: 25, organizationId: id(5), actorId: id(4), entityType: "SupplierOrder", entityId: id(6), action: "confirmed", dateFrom: "2026-10-16", dateTo: "2026-10-17" }, context);
    const where = f.tx.auditLog.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ organizationId: id(5), actorId: id(4), entityType: "SupplierOrder", entityId: id(6), action: { contains: "confirmed", mode: "insensitive" }, createdAt: { gte: new Date("2026-10-15T19:00:00Z"), lt: new Date("2026-10-17T19:00:00Z") } });
    expect(f.tx.auditLog.findMany.mock.calls[0][0].where).toEqual(where);
  });
  it("denies platform and audit rights before any data reads", async () => {
    for (const permission of [false, true]) {
      const f = fixture(); if (permission) f.access.hasAll.mockResolvedValue(false); else f.authority.assertPlatformOperator.mockRejectedValue(new ForbiddenException());
      await expect(f.service.list({ offset: 0, limit: 25 }, context)).rejects.toBeInstanceOf(ForbiddenException); expect(f.prisma.$transaction).not.toHaveBeenCalled();
    }
  });
  it("preserves deleted/system identities and prevents links without target permission", async () => {
    const f = fixture(); f.access.hasAll.mockImplementation(async (_a, _o, permissions: string[]) => permissions[0] === "audit.view");
    f.tx.user.findMany.mockResolvedValue([]); f.tx.organization.findMany.mockResolvedValue([]);
    const result = await f.service.list({ offset: 0, limit: 25 }, context);
    expect(result.items[0]).toMatchObject({ actor: { id: id(4), name: null }, organization: { id: id(5), name: null }, href: null });
  });
  it("returns empty and propagates source failure rather than inventing a successful empty journal", async () => {
    const f = fixture(); f.tx.auditLog.findMany.mockResolvedValue([]); f.tx.auditLog.count.mockResolvedValue(0);
    expect(await f.service.list({ offset: 0, limit: 25 }, context)).toEqual({ items: [], total: 0, offset: 0, limit: 25 });
    expect(f.tx.user.findMany).not.toHaveBeenCalled(); f.tx.auditLog.count.mockRejectedValue(new Error("source failed"));
    await expect(f.service.list({ offset: 0, limit: 25 }, context)).rejects.toThrow("source failed");
  });
  it("validates filters at HTTP boundary", () => {
    const f = fixture(), controller = new OperatorAuditController(f.service);
    expect(() => controller.list({ offset: "invalid" }, id(1), id(2))).toThrow(BadRequestException);
  });
});
describe("audit redaction allowlist", () => {
  it("never leaks nested/array/free text or malformed values even under a known field", () => {
    const result = auditChanges({ reason: "PRIVATE", passwordHash: "PRIVATE", before: { token: "PRIVATE" }, status: "PRIVATE_TOKEN", quantity: { secret: "PRIVATE" }, actor: ["PRIVATE"], constructor: "PRIVATE" }, { status: "ACTIVE", version: 3, accessToken: "PRIVATE", amountMinor: "10000000000000000001", availableAt: "2026-10-17T00:00:00Z" });
    expect(JSON.stringify(result)).not.toContain("PRIVATE"); expect(result.redacted).toBe(true);
    expect(result.changes.map(row => row.field)).toEqual(["version", "amountMinor", "availableAt"]);
    expect(auditChanges(["PRIVATE"], "PRIVATE")).toEqual({ changes: [], redacted: true });
  });
  it("exposes only changed allowed facts and validates link targets", () => {
    expect(auditChanges({ version: 1, status: "ACTIVE" }, { version: 1, status: "ACTIVE" })).toEqual({ changes: [], redacted: false });
    expect(auditObjectHref("SupplierOrder", "https://evil.invalid", new Set(["order.confirm"]))).toBeNull();
    expect(auditObjectHref("Unknown", id(1), new Set(["order.confirm"]))).toBeNull();
    expect(auditObjectHref("ImportBatch", id(1), new Set(["import.manage"]))).toContain(`object=${id(1)}`);
  });
});
