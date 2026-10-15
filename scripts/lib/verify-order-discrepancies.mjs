import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

export async function verifyOrderDiscrepancies({ prisma, call, request, assert, identity, buyer, outsider, order, otherOrder }) {
  const migration = await readFile(new URL("../../apps/api/prisma/migrations/20261015170000_order_discrepancies/migration.sql", import.meta.url), "utf8");
  const rollback = new Error("ROLLBACK_DISCREPANCY_UPGRADE");
  try { await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "discrepancy_upgrade_${process.pid}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "discrepancy_upgrade_${process.pid}"`);
    await tx.$executeRawUnsafe('CREATE TABLE "SupplierOrder" (id UUID PRIMARY KEY, amount NUMERIC(20,0))');
    await tx.$executeRawUnsafe('CREATE TABLE "Shipment" (id UUID PRIMARY KEY, quantity NUMERIC(18,6))');
    await tx.$executeRawUnsafe(`INSERT INTO "SupplierOrder" VALUES ('${order.id}', 9007199254740993)`);
    for (const sql of migration.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(sql);
    const [row] = await tx.$queryRawUnsafe('SELECT amount::text AS amount FROM "SupplierOrder"');
    const [empty] = await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "OrderDiscrepancy"');
    assert(row.amount === "9007199254740993" && empty.count === 0, "Discrepancy upgrade changed legacy data");
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; }

  const shipments = [], trigger = `discrepancy_reject_${process.pid}`, endpoint = `/supplier-orders/${order.id}/discrepancies`;
  const post = (body, expected = 201, who = buyer) => call(endpoint, body, expected, who);
  try {
    const buyerWriteRole = await prisma.role.findFirstOrThrow({ where: { organizationId: buyer.organizationId } });
    await prisma.rolePermission.create({ data: { roleId: buyerWriteRole.id, permissionId: (await prisma.permission.findUniqueOrThrow({ where: { code: "order.approve" } })).id } });
    const item = await prisma.supplierOrderItem.findFirstOrThrow({ where: { supplierOrderId: order.id } });
    for (const quantity of ["1.5", "0.5"]) {
      shipments.push(await prisma.shipment.create({ data: { supplierOrderId: order.id, warehouseId: item.warehouseId,
        shipmentNumber: `DISC-${randomUUID()}`, method: "CARRIER", status: "DISPATCHED", recipientName: "Synthetic recipient",
        items: { create: { supplierOrderItemId: item.id, quantity } } }, include: { items: true } }));
    }
    const [shipment, second] = shipments;
    const original = JSON.stringify(await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, shipments: { include: { items: true } } } }));
    const balances = JSON.stringify(await prisma.inventoryBalance.findMany({ where: { offerId: item.offerId }, orderBy: { id: "asc" } }));
    const statement = { kind: "SHORTAGE", reason: "Получена одна единица вместо полутора", requestedResolution: "RESUPPLY", attachmentIds: [],
      lines: [{ shipmentItemId: shipment.items[0].id, actualQuantity: "1", damagedQuantity: "0" }] };
    const create = { action: "CREATE", shipmentId: shipment.id, sourceDocumentId: null, sourceDocumentVersion: null, sourceDocumentChecksum: null,
      sourceReceiptEventId: null, previousDiscrepancyId: null, expectedOrderVersion: 1, expectedShipmentVersion: 1, idempotencyKey: randomUUID(), statement };
    await call(endpoint, undefined, 404, outsider); await post(create, 403, identity);
    await call(`/supplier-orders/${otherOrder.id}/discrepancies`, create, 404, buyer);
    await post({ ...create, expectedOrderVersion: 999 }, 409);
    await post({ ...create, statement: { ...statement, reason: "" } }, 400);
    await post({ ...create, statement: { ...statement, lines: [{ ...statement.lines[0], shipmentItemId: second.items[0].id }] } }, 409);
    const asset = await call(endpoint + "/attachments", { fileName: "photo.png", contentBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=" }, 201, buyer);
    const payload = { ...create, statement: { ...statement, attachmentIds: [asset.id] } };
    const [draft, replay] = await Promise.all([post(payload), post(payload)]);
    assert(draft.discrepancyId === replay.discrepancyId && draft.eventId === replay.eventId, "Concurrent create replay duplicated a claim");
    await post({ ...payload, statement: { ...payload.statement, reason: "Другой текст" } }, 409);
    assert((await call(endpoint)).discrepancies.length === 0, "Supplier sees a draft");
    const filePath = `${endpoint}/${draft.discrepancyId}/attachments/${asset.id}`;
    await call(filePath, undefined, 404, identity); await call(filePath, undefined, 404, outsider);
    await call(filePath, undefined, 200, buyer);
    const command = (version, action, extra = {}) => ({ discrepancyId: draft.discrepancyId, expectedOrderVersion: 1, expectedShipmentVersion: 1,
      expectedExceptionVersion: version, idempotencyKey: randomUUID(), action, ...extra });
    const submit = command(1, "SUBMIT");
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."eventType" = 'OrderDiscrepancyChanged' THEN RAISE EXCEPTION 'synthetic discrepancy rollback'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    await post(submit, 500);
    assert((await prisma.orderDiscrepancy.findUniqueOrThrow({ where: { id: draft.discrepancyId } })).version === 1, "Outbox failure committed discrepancy state");
    assert(await prisma.orderDiscrepancyEvent.count({ where: { discrepancyId: draft.discrepancyId } }) === 1, "Rollback left an event");
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "OutboxEvent"`); await prisma.$executeRawUnsafe(`DROP FUNCTION "${trigger}"()`);
    const sent = await post(submit); assert((await post(submit)).eventId === sent.eventId, "Submit replay duplicated event");
    const supplierView = await call(endpoint);
    assert(supplierView.discrepancies[0].events.length === 1 && supplierView.discrepancies[0].events[0].action === "SUBMIT", "Supplier sees private draft history");
    await call(filePath, undefined, 200, identity);
    await post(command(2, "SAVE", { statement }), 409);
    await post(command(2, "RESPOND", { decision: "AGREE", resolution: "RESUPPLY", reason: "Согласны" }), 403);
    const counter = command(2, "RESPOND", { decision: "COUNTER", resolution: "REDUCTION", reason: "Предлагаем уменьшение обязательства" });
    const race = await Promise.all([counter, { ...counter, idempotencyKey: randomUUID(), decision: "REJECT", reason: "Отклонено" }].map(body => request(endpoint, { identity, method: "POST", body })));
    assert(race.map(r => r.status).sort().join() === "201,409", "Concurrent replies were both accepted");
    const after = (await call(endpoint, undefined, 200, buyer)).discrepancies[0];
    if (after.status === "RESOLUTION_PROPOSED") {
      await post(command(3, "DECIDE", { accepted: true, reason: "Согласны с предложением" }), 403, identity);
      await post(command(3, "DECIDE", { accepted: true, reason: "Согласны с предложением" }));
    } else {
      await post({ ...create, idempotencyKey: randomUUID(), previousDiscrepancyId: draft.discrepancyId });
    }
    const zero = await post({ ...create, idempotencyKey: randomUUID(), shipmentId: second.id,
      statement: { ...statement, kind: "NOT_RECEIVED", lines: [{ shipmentItemId: second.items[0].id, actualQuantity: "0", damagedQuantity: "0" }] } });
    await post({ ...command(1, "SUBMIT"), discrepancyId: zero.discrepancyId });
    await post({ ...command(2, "RESPOND", { decision: "AGREE", resolution: "RESUPPLY", reason: "Согласовано" }), discrepancyId: zero.discrepancyId }, 201, identity);
    assert(JSON.stringify(await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id }, include: { items: true, shipments: { include: { items: true } } } })) === original, "Discrepancy changed order money or received/sent quantities");
    assert(JSON.stringify(await prisma.inventoryBalance.findMany({ where: { offerId: item.offerId }, orderBy: { id: "asc" } })) === balances, "Discrepancy changed stock");
    const buyerRole = await prisma.role.findFirstOrThrow({ where: { organizationId: buyer.organizationId } });
    const permission = await prisma.permission.findUniqueOrThrow({ where: { code: "order.approve" } });
    await prisma.rolePermission.deleteMany({ where: { roleId: buyerRole.id, permissionId: permission.id } });
    await post({ ...create, idempotencyKey: randomUUID() }, 403);
    await prisma.rolePermission.create({ data: { roleId: buyerRole.id, permissionId: permission.id } });
    console.log("Discrepancy PostgreSQL/API PASS: additive upgrade, two batches, decimals/zero, tenant/party/role, scanned evidence visibility, replay/race, outbox rollback, immutable submitted statement, unchanged money/stock/receipt");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "OutboxEvent"`); await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
    await prisma.orderDiscrepancyEvent.deleteMany({ where: { supplierOrderId: order.id } });
    await prisma.orderDiscrepancy.updateMany({ where: { supplierOrderId: order.id }, data: { previousDiscrepancyId: null } });
    await prisma.orderDiscrepancy.deleteMany({ where: { supplierOrderId: order.id } });
    await prisma.uploadAsset.deleteMany({ where: { purpose: "ORDER_DISCREPANCY", metadata: { path: ["orderId"], equals: order.id } } });
    await prisma.shipmentItem.deleteMany({ where: { shipmentId: { in: shipments.map(s => s.id) } } });
    await prisma.shipment.deleteMany({ where: { id: { in: shipments.map(s => s.id) } } });
  }
}
