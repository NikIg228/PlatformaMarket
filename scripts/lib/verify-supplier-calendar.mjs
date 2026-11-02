import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { Prisma } from "@prisma/client";
import { defaultSupplierCalendar } from "@marketplace/schemas";
import { commerce } from "./verify-checkout-snapshot.mjs";

const require = createRequire(import.meta.url);

export async function verifySupplierCalendarUpgrade(prisma, assert) {
  const schema = `calendar_upgrade_${process.pid}`;
  const migration = await readFile(new URL("../../apps/api/prisma/migrations/20261102000000_supplier_working_calendar/migration.sql", import.meta.url), "utf8");
  const rollback = new Error("ROLLBACK_CALENDAR_UPGRADE");
  try { await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe('CREATE TABLE "SupplierProfile" ("organizationId" UUID PRIMARY KEY, "regulatoryDetails" JSONB)');
    await tx.$executeRawUnsafe('CREATE TABLE "SupplierOrder" (id UUID PRIMARY KEY, "orderNumber" TEXT)');
    await tx.$executeRawUnsafe(`INSERT INTO "SupplierProfile" VALUES ('10000000-0000-4000-8000-000000000001', '{"preserved":true}')`);
    await tx.$executeRawUnsafe(`INSERT INTO "SupplierOrder" VALUES ('10000000-0000-4000-8000-000000000002', 'legacy-order')`);
    for (const statement of migration.split(";").filter(value => value.trim())) await tx.$executeRawUnsafe(statement);
    const [profile] = await tx.$queryRawUnsafe(`SELECT "regulatoryDetails", "workingCalendarVersion", "workingCalendar" FROM "${schema}"."SupplierProfile"`);
    const [order] = await tx.$queryRawUnsafe(`SELECT "orderNumber", "responseCalendar", "responseStartedAt", "responseDeadlineAt" FROM "${schema}"."SupplierOrder"`);
    assert(profile.regulatoryDetails.preserved && profile.workingCalendarVersion === 0 && profile.workingCalendar === null, "Calendar migration changed existing supplier data");
    assert(order.orderNumber === "legacy-order" && order.responseCalendar === null && order.responseStartedAt === null && order.responseDeadlineAt === null, "Migration assigned a deadline to a legacy order");
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; }
  console.log("Calendar additive upgrade preserves legacy suppliers/orders PASS");
}

export async function verifySupplierCalendar({ prisma, fixture, request, runId, assert, createBuyer, createCartWithItem, offerId }) {
  const supplierId = fixture.supplierId, route = "/suppliers/current/working-calendar";
  const original = await prisma.supplierProfile.findUniqueOrThrow({ where: { organizationId: supplierId } });
  const users = await Promise.all(["editor", "reader"].map(label => prisma.user.create({ data: { email: `${runId}-calendar-${label}@example.invalid`, displayName: `Calendar ${label}`, emailVerifiedAt: new Date() } })));
  fixture.userIds.push(...users.map(user => user.id));
  for (let index = 0; index < users.length; index++) {
    const role = await prisma.role.create({ data: { organizationId: supplierId, code: `${runId}-calendar-${index}`, name: "Calendar fixture",
      permissions: { create: (index === 0 ? ["organization.view", "supplier.profile.manage"] : ["organization.view"]).map(code => ({ permission: { connect: { code } } })) } } });
    await prisma.organizationMembership.create({ data: { organizationId: supplierId, userId: users[index].id, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
  }
  const identity = { userId: users[0].id, organizationId: supplierId }, reader = { userId: users[1].id, organizationId: supplierId };
  const trigger = `calendar_fail_${process.pid}`;
  const body = (version, calendar = defaultSupplierCalendar()) => ({ ...calendar, expectedVersion: version, idempotencyKey: randomUUID() });
  const check = async (options, status) => {
    const response = await request(route, options);
    assert(response.status === status, `Calendar ${options?.method ?? "GET"}: expected${status}, got${response.status}: ${JSON.stringify(response.body)}`);
    return response.body;
  };
  try {
    await check({}, 401);
    await check({ identity: { ...identity, organizationId: fixture.buyerIds[0] } }, 403);
    await check({ method: "POST", identity: reader, body: body(0) }, 403);
    const fallback = await check({ identity }, 200);
    assert(fallback.source === "DEFAULT" && fallback.canEdit && fallback.calendar.timezone === "Asia/Almaty", "Fallback calendar or edit permission missing");
    assert(!(await check({ identity: reader }, 200)).canEdit, "Reader can edit calendar");
    for (const invalid of [
      { ...body(0), timezone: "Invalid/Zone" },
      { ...body(0), organizationId: fixture.buyerIds[0] },
      { ...body(0), exceptions: [{ date: "2027-02-29", intervals: [] }] },
      { ...body(0), exceptions: [{ date: "2026-11-03", intervals: [{ fromMinute: 10, toMinute: 30 }, { fromMinute: 20, toMinute: 40 }] }] },
    ]) await check({ method: "POST", identity, body: invalid }, 400);

    const buyer = await createBuyer(88), service = commerce(prisma);
    const cart = await createCartWithItem(buyer, offerId, 1);
    const checkoutInput = { idempotencyKey: `${runId}-calendar-checkout` };
    const orderContext = { actorId: buyer.userId, organizationId: buyer.organizationId };
    const checkout = await service.checkout(cart.id, checkoutInput, orderContext);
    const order = await prisma.supplierOrder.findFirstOrThrow({ where: { checkoutId: checkout.id } });
    const { supplierResponseDeadline } = require("../../apps/api/dist/src/modules/commerce/supplier-calendar-rules.js");
    assert(order.responseCalendar.source === "DEFAULT" && order.responseCalendar.version === 0, "Checkout did not capture fallback version");
    assert(order.responseDeadlineAt.getTime() === supplierResponseDeadline(order.responseStartedAt, order.responseCalendar.calendar).getTime(), "Checkout deadline does not follow its snapshot");

    const custom = defaultSupplierCalendar(); custom.week[0].intervals = [{ fromMinute: 0, toMinute: 120 }, { fromMinute: 1320, toMinute: 1440 }];
    custom.exceptions = [{ date: "2026-11-03", intervals: [] }];
    const save = body(0, custom);
    const concurrentReplay = await Promise.all([check({ method: "POST", identity, body: save }, 201), check({ method: "POST", identity, body: save }, 201)]);
    assert(concurrentReplay.every(result => result.version === 1), "Concurrent same-key save did not converge");
    await check({ method: "POST", identity, body: { ...save, timezone: "UTC" } }, 409);
    await check({ method: "POST", identity, body: body(0) }, 409);
    const race = await Promise.all([body(1), body(1, custom)].map(value => request(route, { method: "POST", identity, body: value })));
    assert(race.map(value => value.status).sort().join(",") === "201,409", "Calendar CAS needs one winner");
    const again = await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id } });
    assert(again.responseDeadlineAt.getTime() === order.responseDeadlineAt.getTime() && JSON.stringify(again.responseCalendar) === JSON.stringify(order.responseCalendar), "Editing calendar moved an existing deadline");
    const replayCheckout = await service.checkout(cart.id, checkoutInput, orderContext);
    assert(replayCheckout.id === checkout.id, "Calendar change broke checkout replay");
    const cart2 = await createCartWithItem(buyer, offerId, 1);
    const checkout2 = await service.checkout(cart2.id, { idempotencyKey: `${runId}-calendar-next` }, orderContext);
    const next = await prisma.supplierOrder.findFirstOrThrow({ where: { checkoutId: checkout2.id } });
    assert(next.responseCalendar.source === "SUPPLIER" && next.responseCalendar.version === 2, "New checkout did not capture changed calendar");
    const visible = await request(`/supplier-orders/${order.id}/workflow`, { identity: buyer });
    assert(visible.status === 200 && visible.body.order.responseDeadlineAt === order.responseDeadlineAt.toISOString(), "Buyer order response lost calendar deadline");

    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'supplier.calendar.updated' AND NEW."entityId" = '${supplierId}' THEN RAISE EXCEPTION 'synthetic calendar audit failure'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    const failed = body(2);
    await check({ method: "POST", identity, body: failed }, 500);
    assert((await check({ identity }, 200)).version === 2, "Audit failure did not roll back calendar");
    assert(await prisma.idempotencyRecord.count({ where: { scope: `supplier-calendar:${supplierId}`, key: failed.idempotencyKey } }) === 0, "Failed write retained replay record");
    assert(await prisma.outboxEvent.count({ where: { aggregateId: supplierId, eventType: "SupplierCalendarUpdated" } }) === 2, "Replay/conflict/failure duplicated an outbox event");
    console.log("Calendar HTTP validation/roles/tenant/CAS/replay/rollback and immutable checkout deadlines PASS");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
    await prisma.supplierProfile.update({ where: { organizationId: supplierId }, data: { workingCalendar: original.workingCalendar ?? Prisma.DbNull, workingCalendarVersion: original.workingCalendarVersion } });
    await prisma.idempotencyRecord.deleteMany({ where: { scope: `supplier-calendar:${supplierId}` } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: supplierId, eventType: "SupplierCalendarUpdated" } });
  }
}
