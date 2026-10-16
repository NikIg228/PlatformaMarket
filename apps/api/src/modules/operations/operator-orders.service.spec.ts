import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { OperatorOrdersService } from "./operator-orders.service";

const id = (n: number) => `61000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const time = new Date("2026-10-16T00:00:00Z");
const context = { actorId: id(1), organizationId: id(2) };
function fixture() {
  const party = { id: id(3), displayName: "Clinic", legalName: "Clinic LLC", bin: "123456789012" };
  const row = { id: id(5), orderNumber: "ORD-151", buyer: party, supplier: { ...party, id: id(4) }, status: "PARTIALLY_FULFILLED", paymentStatus: "PAID", subtotalAmountMinor: new Prisma.Decimal("90071992547409931234"), currency: "KZT", version: 3, createdAt: time, updatedAt: time };
  const order = { ...row, checkoutId: id(6), buyerOrganizationId: id(3), supplierOrganizationId: id(4), transactionMode: "MANUAL", items: [], shipments: [] };
  const workflow = { get: vi.fn().mockResolvedValue({ orderId: id(5), order, version: 3, status: order.status, paymentStatus: "PAID", invoiceDocumentId: null, claims: [], events: [], returns: [] }) };
  const tx = { supplierOrder: { count: vi.fn().mockResolvedValue(151), findMany: vi.fn().mockResolvedValue([row]) },
    orderDiscrepancy: { findMany: vi.fn().mockResolvedValue([]) }, shipment: { findMany: vi.fn().mockResolvedValue([]) },
    supportLink: { findMany: vi.fn().mockResolvedValue([{ ticketId: id(7) }]) },
    supportTicket: { findMany: vi.fn().mockResolvedValue([{ id: id(7), number: "T-1", subject: "Missing goods", status: "OPEN", createdAt: time, updatedAt: time }]) } };
  const prisma = { $transaction: vi.fn(async (run: (db: typeof tx) => unknown) => run(tx)) };
  const authority = { assertPlatformOperator: vi.fn().mockResolvedValue(undefined) }, access = { hasAll: vi.fn().mockResolvedValue(true) };
  return { tx, prisma, authority, access, workflow, service: new OperatorOrdersService(prisma as never, authority as never, access as never, workflow as never) };
}
describe("operator order projection", () => {
  it("uses the same snapshot/filter for total and stable pages with exact money and local date boundaries", async () => {
    const f = fixture();
    const result = await f.service.list({ q: "ORD", buyer: "Clinic", supplier: "Supply", status: "PARTIALLY_FULFILLED", paymentStatus: "PAID", dateFrom: "2026-10-15", dateTo: "2026-10-16", offset: 125, limit: 25 }, context);
    expect(result).toMatchObject({ total: 151, offset: 125, items: [{ subtotalAmountMinor: "90071992547409931234" }] });
    const where = f.tx.supplierOrder.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: "PARTIALLY_FULFILLED", paymentStatus: "PAID", createdAt: { gte: new Date("2026-10-14T19:00:00Z"), lt: new Date("2026-10-16T19:00:00Z") } });
    expect(where.buyer.is.OR).toContainEqual({ bin: { contains: "Clinic" } });
    expect(f.tx.supplierOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 125, take: 25, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }));
    expect(f.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
    expect(f.authority.assertPlatformOperator.mock.invocationCallOrder[0]).toBeLessThan(f.prisma.$transaction.mock.invocationCallOrder[0]);
  });
  it("denies list/detail before any global read when platform authority or order permission is absent", async () => {
    for (const denial of ["authority", "permission"]) {
      const f = fixture();
      if (denial === "authority") f.authority.assertPlatformOperator.mockRejectedValue(new ForbiddenException()); else f.access.hasAll.mockResolvedValue(false);
      await expect(f.service.list({ offset: 0, limit: 25 }, context)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(f.service.detail(id(5), context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(f.prisma.$transaction).not.toHaveBeenCalled(); expect(f.workflow.get).not.toHaveBeenCalled();
    }
  });
  it("reuses workflow and links only the selected order, excludes unpublished discrepancy drafts", async () => {
    const f = fixture(), result = await f.service.detail(id(5), context);
    expect(result).toMatchObject({ canWrite: false, canViewDocuments: true, workflow: { order: { subtotalAmountMinor: "90071992547409931234" } }, tickets: [{ id: id(7) }] });
    expect(f.tx.orderDiscrepancy.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { supplierOrderId: id(5), status: { not: "DRAFT" } } }));
    expect(f.tx.supportLink.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { entityType: "SupplierOrder", entityId: id(5) } }));
    expect(f.tx.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [id(7)] } } }));
    expect(result).not.toHaveProperty("complete");
  });
  it("does not query support or grant document visibility through the order permission", async () => {
    const f = fixture(); f.access.hasAll.mockImplementation(async (_actor, _org, permissions: string[]) => permissions[0] === "order.confirm");
    expect(await f.service.detail(id(5), context)).toMatchObject({ canViewDocuments: false, canViewSupport: false, tickets: [] });
    expect(f.tx.supportLink.findMany).not.toHaveBeenCalled(); expect(f.tx.supportTicket.findMany).not.toHaveBeenCalled();
  });
  it("does not read related objects after missing order or hide backend failure as empty success", async () => {
    const f = fixture(); f.workflow.get.mockRejectedValue(new NotFoundException());
    await expect(f.service.detail(id(9), context)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
    f.tx.supplierOrder.count.mockRejectedValue(new Error("database unavailable"));
    await expect(f.service.list({ offset: 0, limit: 25 }, context)).rejects.toThrow("database unavailable");
  });
});
