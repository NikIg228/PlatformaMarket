import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { OperatorDocumentExceptionsService } from "./operator-document-exceptions.service";
import { OperatorDocumentExceptionsController } from "./operator-document-exceptions.controller";

const id = (n: number) => `72000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = new Date("2026-10-17T00:00:00Z"), context = { actorId: id(1), organizationId: id(2) };
function fixture() {
  const claim = { id: id(3), version: 4, status: "AGREED", resolution: "RESUPPLY",
    statement: { kind: "SHORTAGE", reason: "Получено 8 из 10", requestedResolution: "RESUPPLY", attachmentIds: [id(8)], lines: [{ shipmentItemId: id(7), actualQuantity: "8", damagedQuantity: "0" }] },
    source: { orderVersion: 2, shipmentVersion: 1, shipmentNumber: "SHP-1", documentId: id(9), documentVersion: 1,
      documentChecksum: "PRIVATE_CHECKSUM", documentSnapshot: { privateValue: "PRIVATE_SNAPSHOT" }, sourceReceiptEventId: null,
      lines: [{ shipmentItemId: id(7), orderItemId: id(10), name: "Материал", uom: "шт", sentQuantity: "10", recordedReceivedQuantity: "8", unitPriceMinor: "100", taxSnapshot: { secret: "PRIVATE_TAX" }, isGift: false }] },
    supplierOrder: { id: id(4), orderNumber: "ORD-1", version: 3, buyer: { id: id(5), displayName: "Клиника" }, supplier: { id: id(6), displayName: "Поставщик" } },
    shipment: { id: id(11), shipmentNumber: "SHP-1", version: 2, status: "PARTIALLY_DELIVERED", items: [{ id: id(7), deliveredQuantity: new Prisma.Decimal("8") }] },
    events: [{ id: id(12), version: 3, action: "SUBMIT", createdAt: at, details: { source: "PRIVATE_EVENT_SOURCE", statement: "PRIVATE_EVENT_STATEMENT" } },
      { id: id(13), version: 4, action: "RESPOND", createdAt: at, details: { reason: "Довезём недостачу", decision: "AGREE", secret: "PRIVATE_EVENT_SECRET" } }],
  };
  const tx = { orderDiscrepancy: { findFirst: vi.fn().mockResolvedValue(claim) },
    supportLink: { findMany: vi.fn().mockResolvedValue([{ ticketId: id(14) }, { ticketId: id(14) }]) },
    supportTicket: { findMany: vi.fn().mockResolvedValue([{ id: id(14), number: "T-1", subject: "Недостача", status: "OPEN" }]) } };
  const prisma = { $transaction: vi.fn(async (run: (db: typeof tx) => unknown) => run(tx)) };
  const authority = { assertPlatformOperator: vi.fn().mockResolvedValue(undefined) };
  const access = { hasAll: vi.fn().mockResolvedValue(true) };
  return { claim, tx, prisma, access, authority, service: new OperatorDocumentExceptionsService(prisma as never, authority as never, access as never) };
}
describe("operator document exception read projection", () => {
  it("projects exact published object, quantities, safe history and linked support", async () => {
    const f = fixture(), result = await f.service.get(id(3), context);
    expect(result).toMatchObject({ id: id(3), order: { id: id(4), version: 3 }, shipment: { id: id(11), version: 2 },
      lines: [{ sentQuantity: "10", reportedQuantity: "8", receivedQuantity: "8" }], sourceDocument: { id: id(9), version: 1 },
      events: [{ reason: null }, { reason: "Довезём недостачу", decision: "AGREE" }], tickets: [{ id: id(14) }] });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(result).not.toHaveProperty("attachments");
    expect(f.tx.orderDiscrepancy.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: id(3), status: { not: "DRAFT" } } }));
    expect(f.tx.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [id(14)] } } }));
  });
  it("does not read before platform and order permission checks", async () => {
    for (const denied of ["platform", "permission"]) {
      const f = fixture();
      if (denied === "platform") f.authority.assertPlatformOperator.mockRejectedValue(new ForbiddenException()); else f.access.hasAll.mockResolvedValue(false);
      await expect(f.service.get(id(3), context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(f.prisma.$transaction).not.toHaveBeenCalled();
    }
  });
  it("does not leak inaccessible document/support or grant publication with read rights", async () => {
    const f = fixture(); f.access.hasAll.mockImplementation(async (_a, _o, rights: string[]) => rights[0] === "order.confirm");
    const result = await f.service.get(id(3), context);
    expect(result).toMatchObject({ canPublish: false, canViewDocuments: false, canViewSupport: false, sourceDocument: null, tickets: [] });
    expect(f.tx.supportLink.findMany).not.toHaveBeenCalled(); expect(f.tx.supportTicket.findMany).not.toHaveBeenCalled();
  });
  it("returns not found for missing/private draft, and does not hide database failure", async () => {
    const f = fixture(); f.tx.orderDiscrepancy.findFirst.mockResolvedValue(null);
    await expect(f.service.get(id(3), context)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.tx.supportLink.findMany).not.toHaveBeenCalled();
    f.tx.orderDiscrepancy.findFirst.mockRejectedValue(new Error("database unavailable"));
    await expect(f.service.get(id(3), context)).rejects.toThrow("database unavailable");
  });
});

const command = { expectedOrderVersion: 3, expectedShipmentVersion: 2, expectedExceptionVersion: 4, idempotencyKey: id(30),
  reason: "Проверены исходные количества и согласованный довоз", nextStep: "Сторонам завершить документальное оформление" };
function writeFixture() {
  const f = fixture();
  const claim = { ...f.claim, supplierOrderId: id(4), supplierOrder: { version: 3, buyerOrganizationId: id(5), supplierOrganizationId: id(6) }, events: [{ action: "RESPOND" }] };
  const tx = { ...f.tx, $queryRaw: vi.fn().mockResolvedValue([]),
    orderDiscrepancy: { findFirst: vi.fn().mockResolvedValue(claim), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    orderDiscrepancyEvent: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) }, outboxEvent: { create: vi.fn().mockResolvedValue({}) } };
  const prisma = { $transaction: vi.fn(async (run: (db: typeof tx) => unknown) => run(tx)) };
  return { ...f, claim, tx, prisma, service: new OperatorDocumentExceptionsService(prisma as never, f.authority as never, f.access as never) };
}
describe("operator public recommendation", () => {
  it("records a public review and next step atomically without changing domain state", async () => {
    const f = writeFixture(), result = await f.service.publish(id(3), command, context);
    expect(result).toMatchObject({ discrepancyId: id(3), version: 5, status: "AGREED", reviewStatus: "REVIEWED" });
    expect(f.tx.orderDiscrepancy.updateMany).toHaveBeenCalledWith({ where: { id: id(3), version: 4 }, data: { version: { increment: 1 } } });
    expect(f.tx.orderDiscrepancyEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "OPERATOR_REVIEW", version: 5,
      details: { reason: command.reason, nextStep: command.nextStep, reviewedExceptionVersion: 4 } }) });
    expect(f.tx.auditLog.create).toHaveBeenCalledOnce(); expect(f.tx.outboxEvent.create).toHaveBeenCalledOnce();
    expect(f.tx.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ payload: expect.objectContaining({ buyerOrganizationId: id(5), supplierOrganizationId: id(6) }) }) });
  });
  it("replays an identical command and rejects changed payload/actor", async () => {
    const f = writeFixture(), first = await f.service.publish(id(3), command, context);
    f.tx.orderDiscrepancyEvent.findUnique.mockResolvedValue(f.tx.orderDiscrepancyEvent.create.mock.calls[0][0].data);
    expect(await f.service.publish(id(3), command, context)).toEqual(first);
    await expect(f.service.publish(id(3), { ...command, nextStep: "Другое действие" }, context)).rejects.toBeInstanceOf(ConflictException);
    await expect(f.service.publish(id(3), command, { ...context, actorId: id(99) })).rejects.toBeInstanceOf(ConflictException);
    expect(f.tx.auditLog.create).toHaveBeenCalledOnce(); expect(f.tx.orderDiscrepancy.updateMany).toHaveBeenCalledOnce();
  });
  it.each(["order", "shipment", "exception", "reviewed", "race"])("rejects %s conflicts before publishing", async kind => {
    const f = writeFixture();
    if (kind === "order") f.claim.supplierOrder.version++;
    if (kind === "shipment") f.claim.shipment.version++;
    if (kind === "exception") f.claim.version++;
    if (kind === "reviewed") f.claim.events = [{ action: "OPERATOR_REVIEW" }];
    if (kind === "race") f.tx.orderDiscrepancy.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.service.publish(id(3), command, context)).rejects.toBeInstanceOf(ConflictException);
    expect(f.tx.orderDiscrepancyEvent.create).not.toHaveBeenCalled(); expect(f.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it("requires write permission before reading and never publishes a private draft", async () => {
    const f = writeFixture(); f.access.hasAll.mockImplementation(async (_a, _o, permissions: string[]) => !permissions.includes("support.ticket.manage"));
    await expect(f.service.publish(id(3), command, context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
    f.access.hasAll.mockResolvedValue(true); f.tx.orderDiscrepancy.findFirst.mockResolvedValue(null);
    await expect(f.service.publish(id(3), command, context)).rejects.toBeInstanceOf(NotFoundException);
    expect(f.tx.orderDiscrepancyEvent.create).not.toHaveBeenCalled();
  });
  it("propagates transaction failure and validates input before the service", async () => {
    const f = writeFixture(); f.tx.auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    await expect(f.service.publish(id(3), command, context)).rejects.toThrow("audit unavailable");
    expect(f.tx.outboxEvent.create).not.toHaveBeenCalled();
    const publish = vi.fn(), controller = new OperatorDocumentExceptionsController({ publish } as never);
    for (const body of [{ ...command, reason: " " }, { ...command, expectedExceptionVersion: 0 }, { ...command, status: "RESOLVED" }]) {
      expect(() => controller.publish(id(3), body, context.actorId, context.organizationId)).toThrow();
    }
    expect(() => controller.publish("invalid", command, context.actorId, context.organizationId)).toThrow();
    expect(publish).not.toHaveBeenCalled();
  });
});
