import { randomInt, randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { OperatorDocumentExceptionsService } from "./operator-document-exceptions.service";

it.skipIf(!process.env.POSTGRES_TEST_DATABASE_URL)("document recommendation PostgreSQL: atomic rollback, concurrent replay and preserved domain state", async () => {
  const target = new URL(process.env.POSTGRES_TEST_DATABASE_URL!);
  expect(["localhost", "127.0.0.1"]).toContain(target.hostname);
  expect(target.pathname).toBe("/dentmarket_audit_20260914");
  expect(process.env.DATABASE_URL).toBe(process.env.POSTGRES_TEST_DATABASE_URL);
  const db = new PrismaClient(), buyerId = randomUUID(), cartId = randomUUID(), checkoutId = randomUUID(), orderId = randomUUID(), claimId = randomUUID();
  const actor = { organizationId: buyerId, actorId: randomUUID() };
  const authority = { assertPlatformOperator: async () => {} }, access = { hasAll: async () => true };
  const service = (prisma: object) => new OperatorDocumentExceptionsService(prisma as PrismaService, authority as never, access as never);
  try {
    expect((await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`)[0].name).toBe("dentmarket_audit_20260914");
    const warehouse = await db.warehouse.findFirstOrThrow({ where: { status: "ACTIVE" } });
    await db.organization.create({ data: { id: buyerId, bin: String(randomInt(100_000_000_000, 999_999_999_999)), legalName: "Recommendation transaction fixture", displayName: "Recommendation transaction fixture" } });
    await db.cart.create({ data: { id: cartId, buyerOrganizationId: buyerId, status: "CHECKED_OUT" } });
    await db.checkout.create({ data: { id: checkoutId, cartId, buyerOrganizationId: buyerId, totalAmountMinor: "1000", currency: "KZT", idempotencyKey: randomUUID(), pricingSnapshot: {} } });
    const order = await db.supplierOrder.create({ data: { id: orderId, checkoutId, supplierOrganizationId: warehouse.supplierOrganizationId, buyerOrganizationId: buyerId, orderNumber: `review-${orderId}`, status: "PARTIALLY_FULFILLED", paymentStatus: "PAID", subtotalAmountMinor: "1000", currency: "KZT" } });
    const shipment = await db.shipment.create({ data: { supplierOrderId: orderId, warehouseId: warehouse.id, shipmentNumber: `review-${orderId}`, method: "PICKUP", pickup: true, recipientName: "Тестовая клиника", status: "PARTIALLY_DELIVERED" } });
    const claim = await db.orderDiscrepancy.create({ data: { id: claimId, supplierOrderId: orderId, shipmentId: shipment.id, status: "SUBMITTED", statement: {}, source: {} } });
    const input = { expectedOrderVersion: order.version, expectedShipmentVersion: shipment.version, expectedExceptionVersion: claim.version, idempotencyKey: randomUUID(), reason: "Проверено расхождение по документам", nextStep: "Сторонам согласовать способ исправления" };
    for (const failAt of ["auditLog", "outboxEvent"]) {
      const failing = new Proxy(db, { get(source, property) {
        if (property === "$transaction") return (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => db.$transaction(tx => callback(new Proxy(tx, { get(transaction, name) {
          return name === failAt ? { create: async () => { throw new Error(`Synthetic ${failAt} failure`); } } : Reflect.get(transaction, name);
        } })));
        return Reflect.get(source, property);
      } });
      await expect(service(failing).publish(claimId, input, actor)).rejects.toThrow(`Synthetic ${failAt} failure`);
      expect(await db.orderDiscrepancy.findUniqueOrThrow({ where: { id: claimId } })).toEqual(claim);
      expect(await db.orderDiscrepancyEvent.count({ where: { discrepancyId: claimId } })).toBe(0);
      expect(await db.auditLog.count({ where: { entityId: claimId } })).toBe(0);
      expect(await db.outboxEvent.count({ where: { aggregateId: orderId } })).toBe(0);
    }
    const results = await Promise.all(Array.from({ length: 4 }, () => service(db).publish(claimId, input, actor)));
    expect(new Set(results.map(row => row.eventId)).size).toBe(1);
    expect(await db.orderDiscrepancyEvent.count({ where: { discrepancyId: claimId } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: claimId } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { aggregateId: orderId } })).toBe(1);
    expect(await db.supplierOrder.findUniqueOrThrow({ where: { id: orderId } })).toEqual(order);
    expect(await db.shipment.findUniqueOrThrow({ where: { id: shipment.id } })).toEqual(shipment);
    expect(await db.orderDiscrepancy.findUniqueOrThrow({ where: { id: claimId } })).toMatchObject({ status: "SUBMITTED", resolution: null, statement: {}, source: {}, version: 2 });
  } finally {
    await db.orderDiscrepancyEvent.deleteMany({ where: { discrepancyId: claimId } });
    await db.orderDiscrepancy.deleteMany({ where: { id: claimId } });
    await db.auditLog.deleteMany({ where: { entityId: claimId } }); await db.outboxEvent.deleteMany({ where: { aggregateId: orderId } });
    await db.shipment.deleteMany({ where: { supplierOrderId: orderId } }); await db.supplierOrder.deleteMany({ where: { id: orderId } });
    await db.checkout.deleteMany({ where: { id: checkoutId } }); await db.cart.deleteMany({ where: { id: cartId } });
    await db.organization.deleteMany({ where: { id: buyerId } }); await db.$disconnect();
  }
}, 30_000);
