import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const { DataFreshnessService } = require("../../apps/api/dist/src/modules/inventory/data-freshness.service.js");
const { SupplierAccessService } = require("../../apps/api/dist/src/modules/suppliers/supplier-access.service.js");
const { AccessControlService } = require("../../apps/api/dist/src/modules/access-control/access-control.service.js");

export async function verifyStockQuantities({ prisma, offer, supplierId, createBuyer, request, runId, assert }) {
  const actor = await createBuyer(7), outsider = await createBuyer(8);
  const role = await prisma.role.create({ data: { organizationId: supplierId, code: `${runId}-stock`, name: "Stock test",
    permissions: { create: [{ permission: { connect: { code: "inventory.adjust" } } }] } } });
  await prisma.organizationMembership.create({ data: { userId: actor.userId, organizationId: supplierId, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
  const context = { actorId: actor.userId, organizationId: supplierId };
  const original = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: offer.balanceId } });
  const peer = new PrismaClient({ datasourceUrl: process.env.POSTGRES_TEST_DATABASE_URL });
  const input = { target: "INVENTORY", inventoryBalanceId: offer.balanceId, mode: "PERMANENT", value: { quantityOnHand: 10 }, reason: `Stock regression ${runId}` };
  const balance = () => prisma.inventoryBalance.findUniqueOrThrow({ where: { id: offer.balanceId } });
  const makeService = db => new DataFreshnessService(db, new SupplierAccessService(prisma), new AccessControlService(prisma));
  const service = makeService(prisma);
  const expectRejected = async (operation, status) => {
    try { await operation(); } catch (error) { assert(error.getStatus?.() === status, `Expected ${status}, got ${error.message}`); return; }
    throw new Error(`Expected rejection ${status}`);
  };
  try {
    await peer.$connect();
    await prisma.inventoryBalance.update({ where: { id: offer.balanceId }, data: { quantityOnHand: 10, quantityReserved: 2, safetyStock: 1, quantityAvailable: 7 } });
    // Commit a reservation on another connection between any old outer read and transaction entry.
    const interleaved = new Proxy(prisma, { get(target, key) {
      if (key === "$transaction") return async (callback, options) => {
        await peer.inventoryBalance.update({ where: { id: offer.balanceId }, data: { quantityReserved: { increment: 3 }, quantityAvailable: { decrement: 3 }, version: { increment: 1 } } });
        return target.$transaction(callback, options);
      };
      const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } });
    await makeService(interleaved).createOverride(supplierId, input, context);
    const raced = await balance();
    assert(raced.quantityReserved.eq(5) && raced.quantityAvailable.eq(4), "Manual override lost the concurrent reservation");
    const beforeInvalid = await prisma.dataOverride.count({ where: { supplierOrganizationId: supplierId } });
    await expectRejected(() => service.createOverride(supplierId, { ...input, value: { quantityOnHand: 4 } }, context), 400);
    assert((await balance()).quantityOnHand.eq(10), "Invalid override changed inventory");
    assert(await prisma.dataOverride.count({ where: { supplierOrganizationId: supplierId } }) === beforeInvalid, "Invalid override created history");
    await expectRejected(() => service.createOverride(supplierId, input, { actorId: outsider.userId, organizationId: outsider.organizationId }), 403);
    await expectRejected(() => service.createOverride(supplierId, { ...input, inventoryBalanceId: outsider.organizationId }, context), 404);
    const denied = await request(`/suppliers/${supplierId}/inventory/overrides`, { method: "POST", identity: outsider, body: input });
    assert(denied.status === 403, `Foreign HTTP override returned ${denied.status}`);
    const rollbackDb = new Proxy(prisma, { get(target, key) {
      if (key === "$transaction") return (callback, options) => target.$transaction(tx => callback(new Proxy(tx, { get(client, prop) {
        if (prop === "outboxEvent") return { create: async () => { throw new Error("STOCK_TEST_OUTBOX_FAILURE"); } };
        return Reflect.get(client, prop);
      } })), options);
      const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
    } });
    try { await makeService(rollbackDb).createOverride(supplierId, { ...input, value: { quantityOnHand: 20 } }, context); throw new Error("Expected rollback"); }
    catch (error) { assert(error.message === "STOCK_TEST_OUTBOX_FAILURE", error.message); }
    assert((await balance()).quantityOnHand.eq(10), "Failed outbox did not roll back inventory");
    assert(await prisma.dataOverride.count({ where: { supplierOrganizationId: supplierId } }) === beforeInvalid, "Failed outbox did not roll back override history");
    await prisma.inventoryBalance.update({ where: { id: offer.balanceId }, data: { quantityOnHand: 1, quantityReserved: "0.1", safetyStock: "0.1", quantityAvailable: "0.8" } });
    const saved = await request(`/suppliers/${supplierId}/inventory/overrides`, { method: "POST", identity: { userId: actor.userId, organizationId: supplierId }, body: { ...input, value: { quantityOnHand: 0.3 } } });
    assert(saved.status === 201, `Valid fractional HTTP override returned ${saved.status}`);
    assert((await balance()).quantityAvailable.eq("0.1"), "Fractional inventory was rounded incorrectly");
    console.log("Stock quantities PASS: two-connection reservation, current invariant, tenant denial, rollback, fractional HTTP write");
  } finally {
    await peer.$disconnect();
    const ids = (await prisma.dataOverride.findMany({ where: { supplierOrganizationId: supplierId, reason: input.reason }, select: { id: true } })).map(row => row.id);
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
    await prisma.dataOverride.updateMany({ where: { id: { in: ids } }, data: { previousOverrideId: null } });
    await prisma.dataOverride.deleteMany({ where: { id: { in: ids } } });
    const { id, ...data } = original;
    await prisma.inventoryBalance.update({ where: { id }, data });
    await prisma.organizationMembership.deleteMany({ where: { userId: actor.userId, organizationId: supplierId } });
    await prisma.role.delete({ where: { id: role.id } });
  }
}
