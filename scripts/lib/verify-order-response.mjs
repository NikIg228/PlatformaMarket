import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Prisma } from "@prisma/client";
import { defaultSupplierCalendar } from "@marketplace/schemas";
import { commerce } from "./verify-checkout-snapshot.mjs";
const require = createRequire(import.meta.url);

export async function verifyOrderResponseUpgrade(prisma, assert) {
  const schema = `response_upgrade_${process.pid}`;
  const sql = await readFile(new URL("../../apps/api/prisma/migrations/20261103000000_order_response_sla/migration.sql", import.meta.url), "utf8");
  const rollback = new Error("ROLLBACK_RESPONSE_UPGRADE");
  try { await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe('CREATE TABLE "SupportTicket" (id UUID PRIMARY KEY)');
    await tx.$executeRawUnsafe('CREATE TABLE "SupplierOrder" (id UUID PRIMARY KEY, status TEXT, "responseStartedAt" TIMESTAMP(3), "orderNumber" TEXT)');
    await tx.$executeRawUnsafe(`INSERT INTO "SupplierOrder" VALUES ('10000000-0000-4000-8000-000000000002', 'AWAITING_CONFIRMATION', NULL, 'legacy')`);
    for (const statement of sql.split(";").filter(value => value.trim())) await tx.$executeRawUnsafe(statement);
    const [order] = await tx.$queryRawUnsafe(`SELECT * FROM "${schema}"."SupplierOrder"`);
    assert(order.orderNumber === "legacy" && ["responseReceivedAt", "responseRemindedAt", "responseOverdueAt", "responseEscalatedAt", "responseSupportTicketId"].every(key => order[key] === null), "Upgrade invented response events");
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; }
  console.log("Response additive upgrade preserves legacy records PASS");
}

export async function verifyOrderResponse({ prisma, fixture, request, runId, assert, createBuyer, createCartWithItem, offerId }) {
  const { OrderResponseService } = require("../../apps/api/dist/src/modules/commerce/order-response.service.js");
  const service = () => new OrderResponseService(prisma, { register() {}, async enqueue() { return false; } });
  const buyer = await createBuyer(89), outsider = await createBuyer(94);
  const supplierId = fixture.supplierId;
  const role = await prisma.role.create({ data: { organizationId: supplierId, code: `${runId}-response`, name: "Response fixture",
    permissions: { create: [{ permission: { connect: { code: "order.confirm" } } }] } } });
  await prisma.organizationMembership.create({ data: { userId: buyer.userId, organizationId: supplierId, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
  const supplier = { organizationId: supplierId, userId: buyer.userId };
  const supplierContext = { organizationId: supplierId, actorId: buyer.userId };
  const calendar = defaultSupplierCalendar(), start = new Date("2026-11-02T04:00:00Z");
  const at = minutes => new Date(start.getTime() + minutes * 60000);
  const orders = [];
  const create = async () => {
    const cart = await createCartWithItem(buyer, offerId, 1);
    const checkout = await commerce(prisma).checkout(cart.id, { idempotencyKey: randomUUID() }, { actorId: buyer.userId, organizationId: buyer.organizationId });
    const order = checkout.supplierOrders[0]; orders.push(order.id);
    return prisma.supplierOrder.update({ where: { id: order.id }, data: {
      responseCalendar: { source: "DEFAULT", version: 0, calendar }, responseStartedAt: start, responseDeadlineAt: at(60),
    }, include: { items: true } });
  };
  const count = id => prisma.notification.count({ where: { aggregateId: id, eventType: { in: ["SupplierResponseReminder", "SupplierResponseOverdue", "SupplierResponseEscalated"] } } });
  const trigger = `response_fail_${process.pid}`;
  try {
    const order = await create();
    await service().processOrder(order.id, at(44.999)); assert(await count(order.id) === 0, "Early reminder");
    await Promise.all([service().processOrder(order.id, at(45)), service().processOrder(order.id, at(45))]);
    assert(await count(order.id) === 1, "Concurrent reminder duplicated");
    await service().processOrder(order.id, at(60)); assert(await count(order.id) === 3, "Overdue must notify both sides exactly once");
    await Promise.all([service().processOrder(order.id, at(120)), service().processOrder(order.id, at(120))]);
    await service().processOrder(order.id, at(240));
    const final = await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id } });
    assert(await count(order.id) === 5 && final.responseSupportTicketId && final.responseEscalatedAt, "Missing or duplicate escalation");
    assert(await prisma.supportTicket.count({ where: { number: `RESPONSE-${order.id}` } }) === 1, "Duplicate operator case");
    assert(await prisma.supportLink.count({ where: { ticketId: final.responseSupportTicketId, entityId: order.id } }) === 1, "Missing operator order link");
    assert(final.version === order.version && final.responseDeadlineAt.getTime() === order.responseDeadlineAt.getTime(), "Timer changed commercial version or deadline");
    for (const identity of [buyer, supplier]) {
      const response = await request(`/supplier-orders/${order.id}/workflow`, { identity });
      assert(response.status === 200 && response.body.order.responseEscalatedAt && response.body.order.responseOverdueAt, "Participant response state missing");
    }
    const foreign = await request(`/supplier-orders/${order.id}/workflow`, { identity: outsider });
    assert([403, 404].includes(foreign.status), "Foreign tenant saw response state");
    const anonymous = await request(`/supplier-orders/${order.id}/workflow`);
    assert(anonymous.status === 403, `Development identity guard should deny missing actor: ${anonymous.status}`);

    const rollbackOrder = await create();
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'order.response.escalated' AND NEW."entityId" = '${rollbackOrder.id}' THEN RAISE EXCEPTION 'synthetic response failure'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    let failed = false; try { await service().processOrder(rollbackOrder.id, at(120)); } catch { failed = true; }
    assert(failed && await count(rollbackOrder.id) === 0, "Audit failure retained notifications");
    assert(await prisma.supportTicket.count({ where: { number: `RESPONSE-${rollbackOrder.id}` } }) === 0, "Audit failure retained operator case");
    assert(!(await prisma.supplierOrder.findUniqueOrThrow({ where: { id: rollbackOrder.id } })).responseRemindedAt, "Audit failure retained stage marker");
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "AuditLog"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${trigger}"()`);
    await service().processOrder(rollbackOrder.id, at(120)); assert(await count(rollbackOrder.id) === 5, "Rollback recovery lost effects");

    const answered = await create();
    const confirm = () => commerce(prisma).confirmSupplierOrder(answered.id, { decisions: answered.items.map(item => ({ itemId: item.id, acceptedQuantity: 1 })) }, supplierContext);
    await Promise.all([confirm(), service().processOrder(answered.id, at(60))]);
    const received = await prisma.supplierOrder.findUniqueOrThrow({ where: { id: answered.id } });
    assert(received.status === "CONFIRMED" && received.responseReceivedAt, "Substantive response did not stop timer");
    const before = await count(answered.id); await service().processOrder(answered.id, at(120)); await confirm();
    assert(await count(answered.id) === before && !(await prisma.supplierOrder.findUniqueOrThrow({ where: { id: answered.id } })).responseSupportTicketId, "Response replay/restart generated a later effect");
    assert((await prisma.supplierOrder.findUniqueOrThrow({ where: { id: answered.id } })).responseReceivedAt.getTime() === received.responseReceivedAt.getTime(), "Response replay changed receipt time");

    const legacy = await create();
    await prisma.supplierOrder.update({ where: { id: legacy.id }, data: { responseCalendar: Prisma.DbNull, responseStartedAt: null, responseDeadlineAt: null } });
    await service().processOrder(legacy.id, at(240)); assert(await count(legacy.id) === 0, "Legacy order got invented events");
    const stopped = await create();
    await prisma.supplierOrder.update({ where: { id: stopped.id }, data: { status: "CANCELLED" } });
    await service().processOrder(stopped.id, at(240)); assert(await count(stopped.id) === 0, "Cancelled order got a response reminder");
    console.log("Response PG boundaries/restart/concurrency/rollback/confirmation race/tenant/legacy PASS");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
    const tickets = await prisma.supportTicket.findMany({ where: { number: { in: orders.map(id => `RESPONSE-${id}`) } }, select: { id: true } });
    const ids = tickets.map(ticket => ticket.id);
    await prisma.supplierOrder.updateMany({ where: { id: { in: orders } }, data: { responseSupportTicketId: null, responseEscalatedAt: null } });
    await prisma.supportLink.deleteMany({ where: { ticketId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
    await prisma.supportTicket.deleteMany({ where: { id: { in: ids } } });
  }
}
