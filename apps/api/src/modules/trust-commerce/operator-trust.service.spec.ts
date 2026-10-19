import { ConflictException, ForbiddenException, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OperatorTrustService } from "./operator-trust.service";
import { OperatorTrustController } from "./operator-trust.controller";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const context = { actorId: id(1), organizationId: id(2) };
function fixture() {
  const tx = {
    productGapIncident: { count: vi.fn(async () => 0), findMany: vi.fn(async () => []), findUnique: vi.fn(async () => ({ id: id(3), version: 2, status: "OPEN", actionType: "NONE" })), updateMany: vi.fn(async () => ({ count: 1 })) },
    productGapAppeal: { count: vi.fn(async () => 0) },
    supplierProfile: { count: vi.fn(async () => 101), findMany: vi.fn(async () => [{ organizationId: id(4), organization: { displayName: "Поставщик" } }]), findUnique: vi.fn(async () => ({ organizationId: id(4) })) },
    supplierTrustSnapshot: { findMany: vi.fn(async () => []) },
    supplierTrustMetricEvent: { count: vi.fn(async () => 2), findMany: vi.fn(async () => [3, 4].map(n => ({ id: id(n), metricCode: "delivery_ontime", value: { toString: () => "1" }, occurredAt: new Date(), sourceEntityType: "SupplierOrder", sourceEntityId: id(9), disputed: false, excludedAt: null }))) },
    warehouse: { count: vi.fn(async () => 10) },
    auditLog: { findMany: vi.fn(async () => [{ entityId: id(3) }]), create: vi.fn(async () => ({})) },
  };
  const prisma = { $transaction: vi.fn(async (read: (db: typeof tx) => Promise<unknown>) => read(tx)) };
  const authority = { assertPlatformOperator: vi.fn(async () => {}) };
  const access = { hasAll: vi.fn(async () => true) };
  const service = new OperatorTrustService(prisma as never, authority as never, access as never);
  return { tx, prisma, authority, access, service };
}
describe("operator trust projection", () => {
  it("rejects a missing trusted identity before checking membership", async () => {
    const f = fixture();
    await expect(f.service.overview({ incidentOffset: 0, supplierOffset: 0 }, { actorId: "", organizationId: "" })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.authority.assertPlatformOperator).not.toHaveBeenCalled(); expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("denies a foreign participant before all domain reads", async () => {
    const f = fixture(); f.authority.assertPlatformOperator.mockRejectedValue(new ForbiddenException());
    await expect(f.service.overview({ incidentOffset: 0, supplierOffset: 0 }, context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("bounds queries and preserves all-supplier totals, even without snapshots", async () => {
    const f = fixture(); const result = await f.service.overview({ incidentOffset: 25, supplierOffset: 50 }, context);
    expect(result.suppliers).toMatchObject({ status: "AVAILABLE", data: { total: 101, offset: 50, items: [{ id: id(4), snapshot: null }] } });
    expect(f.tx.supplierProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 25 }));
    expect(f.tx.productGapIncident.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 25, take: 25 }));
  });
  it("isolates unavailable sources and does not expose errors", async () => {
    const f = fixture(); f.tx.productGapIncident.count.mockRejectedValue(new Error("PRIVATE_SQL"));
    const result = await f.service.overview({ incidentOffset: 0, supplierOffset: 0 }, context);
    expect(result.incidents).toEqual({ status: "UNAVAILABLE", data: null });
    expect(result.suppliers.status).toBe("AVAILABLE"); expect(JSON.stringify(result)).not.toContain("PRIVATE_SQL");
  });
  it("does not query forbidden sources", async () => {
    const f = fixture(); f.access.hasAll.mockImplementation(async (...args: unknown[]) => (args[2] as string[])[0] === "trust.rating.view");
    const result = await f.service.overview({ incidentOffset: 0, supplierOffset: 0 }, context);
    expect(result.incidents.status).toBe("FORBIDDEN"); expect(result.warehouses.status).toBe("FORBIDDEN");
    expect(f.tx.productGapIncident.count).not.toHaveBeenCalled(); expect(f.tx.warehouse.count).not.toHaveBeenCalled();
  });
  it("never infers automatic production from caller-controlled source labels", async () => {
    const f = fixture(); const result = await f.service.events(id(4), 25, context);
    expect(result.items.map(row => row.origin)).toEqual(["MANUAL_RECORDED", "UNVERIFIED"]);
    expect(result.automaticFlow).toBe("NOT_VERIFIED");
    expect(f.tx.supplierTrustMetricEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 25, take: 25 }));
  });
  it("rejects malformed query and resolution at the boundary", () => {
    const f = fixture(), controller = new OperatorTrustController(f.service);
    expect(() => controller.overview({ incidentOffset: "wrong" }, id(1), id(2))).toThrow(BadRequestException);
    expect(() => controller.resolve(id(3), { version: 2, resolution: " " }, id(1), id(2))).toThrow(BadRequestException);
  });
});
describe("operator incident restoration", () => {
  it("checks version and pending appeals before mutation", async () => {
    const f = fixture(); await expect(f.service.resolve(id(3), { version: 1, resolution: "Исправлено" }, context)).rejects.toBeInstanceOf(ConflictException);
    f.tx.productGapAppeal.count.mockResolvedValue(1);
    await expect(f.service.resolve(id(3), { version: 2, resolution: "Исправлено" }, context)).rejects.toBeInstanceOf(ConflictException);
    expect(f.tx.productGapIncident.updateMany).not.toHaveBeenCalled();
  });
  it("uses atomic CAS and audits the actual reason in the same transaction", async () => {
    const f = fixture(); expect(await f.service.resolve(id(3), { version: 2, resolution: "Документы проверены" }, context)).toEqual({ id: id(3), version: 3, status: "RESOLVED" });
    expect(f.tx.productGapIncident.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: id(3), version: 2 } }));
    expect(f.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ after: expect.objectContaining({ resolution: "Документы проверены" }) }) }));
    f.tx.productGapIncident.updateMany.mockResolvedValue({ count: 0 }); f.tx.auditLog.create.mockClear();
    await expect(f.service.resolve(id(3), { version: 2, resolution: "Документы проверены" }, context)).rejects.toBeInstanceOf(ConflictException);
    expect(f.tx.auditLog.create).not.toHaveBeenCalled();
  });
});
