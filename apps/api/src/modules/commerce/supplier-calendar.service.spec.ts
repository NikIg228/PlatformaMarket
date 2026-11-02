import { describe, expect, it, vi } from "vitest";
import { ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { defaultSupplierCalendar } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { SupplierCalendarService, supplierCalendarSnapshot } from "./supplier-calendar.service";

const context = { organizationId: "11111111-1111-4111-8111-111111111111", actorId: "22222222-2222-4222-8222-222222222222" };
const input = () => ({ ...defaultSupplierCalendar(), expectedVersion: 0, idempotencyKey: "33333333-3333-4333-8333-333333333333" });
function fixture() {
  const db: any = {
    organizationMembership: { findFirst: vi.fn().mockResolvedValue({ id: "member" }) },
    supplierProfile: { findUnique: vi.fn().mockResolvedValue({ status: "ACTIVE", workingCalendar: null, workingCalendarVersion: 0 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    idempotencyRecord: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) }, outboxEvent: { create: vi.fn().mockResolvedValue({}) }, $queryRaw: vi.fn().mockResolvedValue([]),
  };
  db.$transaction = vi.fn((work: (tx: any) => unknown) => work(db));
  return { db, service: new SupplierCalendarService(db as PrismaService) };
}
describe("supplier calendar service", () => {
  it("returns the fallback with edit capability and scopes authorization", async () => {
    const { db, service } = fixture();
    const result = await service.get(context);
    expect(result).toEqual({ organizationId: context.organizationId, version: 0, source: "DEFAULT", canEdit: true, calendar: defaultSupplierCalendar() });
    expect(db.organizationMembership.findFirst.mock.calls[0][0].where).toMatchObject({ userId: context.actorId, organizationId: context.organizationId, status: "ACTIVE", user: { status: "ACTIVE" } });
  });
  it("permits a viewer to read without claiming edit permission", async () => {
    const { db, service } = fixture();
    db.organizationMembership.findFirst.mockResolvedValueOnce({ id: "viewer" }).mockResolvedValueOnce(null);
    expect((await service.get(context)).canEdit).toBe(false);
  });
  it("denies absent identity and role before any calendar read or write", async () => {
    const { db, service } = fixture();
    await expect(service.get({ ...context, actorId: "" })).rejects.toBeInstanceOf(UnauthorizedException);
    db.organizationMembership.findFirst.mockResolvedValue(null);
    await expect(service.save(input(), context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.supplierProfile.findUnique).not.toHaveBeenCalled();
    expect(db.supplierProfile.updateMany).not.toHaveBeenCalled();
  });
  it("rechecks permission within the write transaction", async () => {
    const { db, service } = fixture();
    db.organizationMembership.findFirst.mockResolvedValueOnce({ id: "member" }).mockResolvedValueOnce(null);
    await expect(service.save(input(), context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.supplierProfile.updateMany).not.toHaveBeenCalled();
  });
  it("writes one scoped version, audit, outbox and replay response", async () => {
    const { db, service } = fixture(); const request = input();
    const result = await service.save(request, context);
    expect(result.version).toBe(1); expect(result.source).toBe("SUPPLIER");
    expect(db.supplierProfile.updateMany).toHaveBeenCalledWith({ where: { organizationId: context.organizationId, status: "ACTIVE", workingCalendarVersion: 0 }, data: { workingCalendar: defaultSupplierCalendar(), workingCalendarVersion: { increment: 1 } } });
    expect(db.auditLog.create).toHaveBeenCalledTimes(1); expect(db.outboxEvent.create).toHaveBeenCalledTimes(1);
    const record = db.idempotencyRecord.create.mock.calls[0][0].data;
    expect(record.scope).toBe(`supplier-calendar:${context.organizationId}`);
    expect(record.responseBody).toEqual(result);
    db.idempotencyRecord.findUnique.mockResolvedValue(record);
    expect(await service.save(request, context)).toEqual(result);
    expect(db.supplierProfile.updateMany).toHaveBeenCalledTimes(1);
    await expect(service.save({ ...request, timezone: "UTC" }, context)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.save(request, { ...context, actorId: "44444444-4444-4444-8444-444444444444" })).rejects.toBeInstanceOf(ConflictException);
  });
  it("rejects a stale save without emitting events", async () => {
    const { db, service } = fixture(); db.supplierProfile.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.save(input(), context)).rejects.toBeInstanceOf(ConflictException);
    expect(db.auditLog.create).not.toHaveBeenCalled(); expect(db.outboxEvent.create).not.toHaveBeenCalled();
  });
  it("does not silently replace corrupt persisted settings with the fallback", async () => {
    const { db } = fixture(); db.supplierProfile.findUnique.mockResolvedValue({ status: "ACTIVE", workingCalendar: {}, workingCalendarVersion: 1 });
    await expect(supplierCalendarSnapshot(db, context.organizationId)).rejects.toBeInstanceOf(ConflictException);
  });
});
