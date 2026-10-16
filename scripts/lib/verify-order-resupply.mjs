import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { verifyResupplyDocumentsBeforeReceipt } from "./verify-resupply-documents.mjs";

export async function verifyOrderResupply({ prisma, call, request, assert, identity, buyer, outsider, otherSupplier, order, otherOrder, storageRoot }) {
  const migration = await readFile(new URL("../../apps/api/prisma/migrations/20261016010000_order_resupply/migration.sql", import.meta.url), "utf8");
  const rollback = new Error("ROLLBACK_RESUPPLY_UPGRADE");
  try { await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "resupply_upgrade_${process.pid}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "resupply_upgrade_${process.pid}"`);
    for (const table of ["Shipment", "OrderDiscrepancy", "InventoryReservation"])
      await tx.$executeRawUnsafe(`CREATE TABLE "${table}" (id UUID PRIMARY KEY)`);
    await tx.$executeRawUnsafe('CREATE TABLE "ShipmentItem" (id UUID PRIMARY KEY, quantity NUMERIC(18,6), "deliveredQuantity" NUMERIC(18,6))');
    await tx.$executeRawUnsafe(`INSERT INTO "ShipmentItem" VALUES ('${randomUUID()}', 10, 8)`);
    for (const sql of migration.split(";").map(s => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(sql);
    const [row] = await tx.$queryRawUnsafe('SELECT quantity::text, "deliveredQuantity"::text, "resupplyQuantity"::text FROM "ShipmentItem"');
    assert(Number(row.quantity) === 10 && Number(row.deliveredQuantity) === 8 && Number(row.resupplyQuantity) === 0, "Upgrade rewrote original quantities");
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; }

  const endpoint = `/supplier-orders/${order.id}/discrepancies`, workflow = `/supplier-orders/${order.id}/workflow`;
  const trigger = `resupply_reject_${process.pid}`;
  let originalReservation, sourceDocument, stockBalanceId, originalBalance, primaryError;
  const lotIds = [], originalLots = [];
  try {
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId: buyer.organizationId } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: (await prisma.permission.findUniqueOrThrow({ where: { code: "order.approve" } })).id } });
    const item = await prisma.supplierOrderItem.findFirstOrThrow({ where: { supplierOrderId: order.id } });
    const balance = await prisma.inventoryBalance.findFirstOrThrow({ where: { offerId: item.offerId, warehouseId: item.warehouseId } });
    stockBalanceId = balance.id;
    originalBalance = balance;
    originalLots.push(...await prisma.inventoryLot.findMany({ where: { inventoryBalanceId: balance.id }, select: { id: true, status: true } }));
    await prisma.inventoryLot.updateMany({ where: { inventoryBalanceId: balance.id }, data: { status: "BLOCKED" } });
    await prisma.inventoryBalance.update({ where: { id: balance.id }, data: { quantityOnHand: "90", quantityAvailable: "82", quantityReserved: "5", safetyStock: "3", freshnessStatus: "FRESH", freshnessExpiresAt: new Date(Date.now() + 3600000) } });
    await prisma.supplierOrderItem.update({ where: { id: item.id }, data: { quantity: "10", acceptedQuantity: "10", totalPriceMinor: "58000" } });
    await prisma.supplierOrder.update({ where: { id: order.id }, data: { status: "SHIPPED", paymentStatus: "PAID", subtotalAmountMinor: "58000" } });
    originalReservation = await prisma.inventoryReservation.create({ data: { inventoryBalanceId: balance.id, supplierOrganizationId: identity.organizationId,
      warehouseId: item.warehouseId, productVariantId: item.productVariantId, supplierOrderItemId: item.id, quantity: "10", status: "CONSUMED", expiresAt: new Date(), idempotencyKey: randomUUID() } });
    const lotData = { inventoryBalanceId: balance.id, supplierOrganizationId: identity.organizationId, warehouseId: item.warehouseId,
      productVariantId: item.productVariantId, quantityOnHand: "10", quantityAvailable: "10", status: "ACTIVE" };
    const expiredLot = await prisma.inventoryLot.create({ data: { ...lotData, lotNumber: randomUUID(), expirationDate: new Date("2020-01-01") } });
    lotIds.push(expiredLot.id);
    const shipment = await prisma.shipment.create({ data: { supplierOrderId: order.id, warehouseId: item.warehouseId, shipmentNumber: `RESUPPLY-${randomUUID()}`,
      method: "CARRIER", status: "DISPATCHED", recipientName: "Synthetic recipient", items: { create: { supplierOrderItemId: item.id, quantity: "10" } },
      fulfillmentSteps: { create: { type: "DELIVERY", sequence: 1 } } }, include: { items: true } });
    const storageKey = `resupply-fixture/${randomUUID()}.pdf`;
    const file = await new Promise((resolve, reject) => {
      const pdf = new PDFDocument(), chunks = [];
      pdf.on("data", chunk => chunks.push(chunk)); pdf.on("error", reject);
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.text("Synthetic test waybill: dispatched quantity 10; total 58000 minor units."); pdf.end();
    });
    await mkdir(path.join(storageRoot, "resupply-fixture"), { recursive: true });
    await writeFile(path.join(storageRoot, storageKey), file);
    const checksum = createHash("sha256").update(file).digest("hex");
    sourceDocument = await prisma.document.create({ data: { ownerOrganizationId: identity.organizationId, supplierOrderId: order.id,
      shipmentId: shipment.id, kind: "WAYBILL", source: "UPLOADED", format: "PDF", status: "AWAITING_SIGNATURE", title: "Synthetic original waybill",
      documentNumber: randomUUID(), immutableAt: new Date(), storageKey, fileName: "synthetic-waybill.pdf", contentType: "application/pdf", byteSize: file.length,
      checksumSha256: checksum, dataSnapshot: { synthetic: true, sentQuantity: "10", totalMinor: "58000" },
      participants: { create: { organizationId: buyer.organizationId, role: "RECIPIENT" } } } });
    const receive = async (target, quantity, expected = 201, who = buyer) => {
      const current = await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id } });
      return call(workflow, { action: "RECEIVE_SHIPMENT", expectedVersion: current.version, idempotencyKey: randomUUID(), shipmentId: target.id,
        items: [{ shipmentItemId: target.items[0].id, deliveredQuantity: quantity }] }, expected, who);
    };
    await receive(shipment, "8");
    const current = await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id } });
    const ship = await prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
    const draft = await call(endpoint, { action: "CREATE", shipmentId: shipment.id, sourceDocumentId: sourceDocument.id, sourceDocumentVersion: sourceDocument.version,
      sourceDocumentChecksum: sourceDocument.checksumSha256, sourceReceiptEventId: null, previousDiscrepancyId: null,
      expectedOrderVersion: current.version, expectedShipmentVersion: ship.version, idempotencyKey: randomUUID(),
      statement: { kind: "SHORTAGE", reason: "Отправлено десять, получено восемь", requestedResolution: "RESUPPLY", attachmentIds: [],
        lines: [{ shipmentItemId: shipment.items[0].id, actualQuantity: "8", damagedQuantity: "0" }] } }, 201, buyer);
    const command = (action, version, extra = {}) => ({ action, discrepancyId: draft.discrepancyId, expectedOrderVersion: current.version,
      expectedShipmentVersion: ship.version, expectedExceptionVersion: version, idempotencyKey: randomUUID(), ...extra });
    await call(endpoint, command("SUBMIT", 1), 201, buyer);
    await call(endpoint, command("RESPOND", 2, { decision: "AGREE", resolution: "RESUPPLY", reason: "Отправим недостающие две единицы" }));
    let dispatch = command("DISPATCH_RESUPPLY", 3, { acknowledged: true, carrierName: "Synthetic carrier", trackingNumber: "RS-NEW" });
    const before = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: balance.id } });
    const originalClaim = await prisma.orderDiscrepancy.findUniqueOrThrow({ where: { id: draft.discrepancyId } });
    const docsBefore = JSON.stringify(await prisma.document.findMany({ where: { supplierOrderId: order.id } }));
    await call(endpoint, dispatch, 403, buyer); await call(endpoint, dispatch, 404, outsider);
    await call(`/supplier-orders/${otherOrder.id}/discrepancies`, dispatch, 404, identity);
    await call(`/supplier-orders/${otherOrder.id}/discrepancies`, dispatch, 404, otherSupplier);
    await call(endpoint, { ...dispatch, acknowledged: false }, 400);
    await call(endpoint, { ...dispatch, items: [{ quantity: "999" }] }, 400);
    await call(endpoint, { ...dispatch, expectedShipmentVersion: 999 }, 409);
    await prisma.inventoryBalance.update({ where: { id: balance.id }, data: { quantityAvailable: "1" } });
    await call(endpoint, dispatch, 409);
    assert(await prisma.shipment.count({ where: { resupplyDiscrepancyId: draft.discrepancyId } }) === 0, "Stock failure created replacement");
    await prisma.inventoryBalance.update({ where: { id: balance.id }, data: { quantityAvailable: before.quantityAvailable } });
    assert(await prisma.inventoryLot.count({ where: { inventoryBalanceId: balance.id, status: "ACTIVE",
      OR: [{ expirationDate: null }, { expirationDate: { gt: new Date() } }] } }) === 0, "Expired-lot fixture contains usable stock");
    await call(endpoint, dispatch, 409);
    const usableLot = await prisma.inventoryLot.create({ data: { ...lotData, lotNumber: randomUUID(), expirationDate: new Date("2090-01-01") } });
    lotIds.push(usableLot.id);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."aggregateId" = '${order.id}' AND NEW."eventType" = 'OrderDiscrepancyChanged' THEN RAISE EXCEPTION 'synthetic resupply rollback'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    await call(endpoint, dispatch, 500);
    assert(await prisma.shipment.count({ where: { resupplyDiscrepancyId: draft.discrepancyId } }) === 0, "Rollback left replacement");
    assert((await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: balance.id } })).quantityOnHand.eq(before.quantityOnHand), "Rollback consumed stock");
    assert((await prisma.shipmentItem.findUniqueOrThrow({ where: { id: shipment.items[0].id } })).resupplyQuantity.eq(0), "Rollback froze original receipt");
    assert((await prisma.orderDiscrepancy.findUniqueOrThrow({ where: { id: draft.discrepancyId } })).version === 3, "Rollback changed claim version");
    assert(await prisma.inventoryReservation.count({ where: { referenceType: "ORDER_RESUPPLY", referenceId: { not: null }, supplierOrganizationId: identity.organizationId } }) === 0, "Rollback left resupply reservation");
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "OutboxEvent"`); await prisma.$executeRawUnsafe(`DROP FUNCTION "${trigger}"()`);
    const competing = [dispatch, dispatch, { ...dispatch, idempotencyKey: randomUUID() }];
    const race = await Promise.all(competing.map(body => request(endpoint, { identity, method: "POST", body })));
    const winner = race.findIndex(result => result.status === 201);
    assert(winner >= 0 && race.every(result => [201, 409].includes(result.status)) && race.some(result => result.status === 409), "Different dispatch keys did not conflict");
    const first = race[winner].body; dispatch = competing[winner];
    assert(race.filter(result => result.status === 201).every(result => result.body.eventId === first.eventId), "Concurrent replay created two executions");
    assert((await call(endpoint, dispatch)).eventId === first.eventId, "Dispatch replay changed result");
    await call(endpoint, { ...dispatch, idempotencyKey: randomUUID() }, 409);
    const replacement = await prisma.shipment.findUniqueOrThrow({ where: { resupplyDiscrepancyId: draft.discrepancyId }, include: { items: true } });
    await call(`/supplier-orders/${order.id}/document-pack`, { shipmentId: replacement.id }, 409);
    assert(replacement.resupplySourceShipmentId === shipment.id && replacement.items[0].quantity.eq(2), "Replacement lost source or quantity");
    const after = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: balance.id } });
    assert(after.quantityOnHand.eq(before.quantityOnHand.minus(2)) && after.quantityAvailable.eq(before.quantityAvailable.minus(2)) && after.quantityReserved.eq(before.quantityReserved), "Additional stock consumed incorrectly");
    assert((await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: originalReservation.id } })).quantity.eq(10), "Original paid reservation changed");
    const extra = await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: replacement.items[0].resupplyReservationId } });
    assert(extra.inventoryLotId === usableLot.id && extra.quantity.eq(2) && extra.supplierOrderItemId === null, "Additional goods lost distinct usable lot trace");
    assert((await prisma.inventoryLot.findUniqueOrThrow({ where: { id: expiredLot.id } })).quantityOnHand.eq(10), "Expired lot was consumed");
    await receive(shipment, "10", 409); await receive(replacement, "3", 409); await receive(replacement, "2", 403, identity);
    const verifyDocumentsAfterReceipt = await verifyResupplyDocumentsBeforeReceipt({ prisma, call, request, assert, identity, buyer, otherSupplier, order, otherOrder, discrepancyId: draft.discrepancyId, replacement, sourceDocument });
    await receive(replacement, "2");
    const completed = await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    assert(completed.status === "DELIVERED" && completed.subtotalAmountMinor.eq(58000) && completed.items[0].acceptedQuantity.eq(10), "Goods fulfillment changed sale or failed to complete");
    const sourceItem = await prisma.shipmentItem.findUniqueOrThrow({ where: { id: shipment.items[0].id } });
    assert(sourceItem.quantity.eq(10) && sourceItem.deliveredQuantity.eq(8) && sourceItem.resupplyQuantity.eq(2), "Original receipt rewritten");
    const finalClaim = await prisma.orderDiscrepancy.findUniqueOrThrow({ where: { id: draft.discrepancyId } });
    assert(finalClaim.status === "AGREED" && JSON.stringify(finalClaim.source) === JSON.stringify(originalClaim.source) && JSON.stringify(finalClaim.statement) === JSON.stringify(originalClaim.statement), "Execution rewrote claim or claimed legal closure");
    const view = (await call(endpoint, undefined, 200, buyer)).discrepancies.find(value => value.id === draft.discrepancyId);
    assert(view.resupply.documentStatus === "INCOMPLETE" && view.resupply.lines[0].deliveredQuantity === "2", "Buyer lacks truthful execution status");
    assert(JSON.stringify(await prisma.document.findMany({ where: { supplierOrderId: order.id, OR: [{ externalId: null }, { NOT: { externalId: { startsWith: "RESUPPLY_DOCUMENT_PREVIEW:" } } }] } })) === docsBefore, "Resupply rewrote original documents");
    assert(createHash("sha256").update(await readFile(path.join(storageRoot, storageKey))).digest("hex") === checksum, "Resupply rewrote original file");
    assert((await call(endpoint, dispatch)).eventId === first.eventId, "Replay after receipt failed");
    await verifyDocumentsAfterReceipt();
    console.log("Resupply PostgreSQL/API PASS: additive upgrade, 10/8/2, tenant/party, invalid/stale input, insufficient stock, outbox rollback, concurrent replay, exact additional consumption, late original receipt denied, fulfillment and documentary incompleteness");
  } catch (error) {
    primaryError = error;
    console.error("Resupply verification failed before cleanup:", error);
  } finally {
    try {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "OutboxEvent"`); await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
    const shipments = await prisma.shipment.findMany({ where: { supplierOrderId: order.id }, select: { id: true } });
    const ids = shipments.map(value => value.id);
    const draftDocuments = await prisma.document.findMany({ where: { supplierOrderId: order.id, externalId: { startsWith: "RESUPPLY_DOCUMENT_PREVIEW:" } }, select: { id: true } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: draftDocuments.map(d => d.id) } } });
    await prisma.document.deleteMany({ where: { id: { in: draftDocuments.map(d => d.id) } } });
    if (sourceDocument) await prisma.document.delete({ where: { id: sourceDocument.id } });
    await prisma.fulfillmentStep.deleteMany({ where: { shipmentId: { in: ids } } });
    await prisma.shipmentItem.deleteMany({ where: { shipmentId: { in: ids } } });
    await prisma.shipment.deleteMany({ where: { supplierOrderId: order.id, resupplyDiscrepancyId: { not: null } } });
    await prisma.orderDiscrepancyEvent.deleteMany({ where: { supplierOrderId: order.id } });
    await prisma.orderDiscrepancy.deleteMany({ where: { supplierOrderId: order.id } });
    await prisma.shipment.deleteMany({ where: { supplierOrderId: order.id } });
    await prisma.inventoryReservation.deleteMany({ where: { OR: [{ referenceType: "ORDER_RESUPPLY", referenceId: { in: ids } }, ...(originalReservation ? [{ id: originalReservation.id }] : [])] } });
    await prisma.inventoryLot.deleteMany({ where: { id: { in: lotIds } } });
    for (const lot of originalLots) await prisma.inventoryLot.update({ where: { id: lot.id }, data: { status: lot.status } });
    if (originalBalance) {
      const { quantityOnHand, quantityAvailable, quantityReserved, safetyStock, freshnessStatus, freshnessExpiresAt, availabilityStatus, version } = originalBalance;
      await prisma.inventoryBalance.update({ where: { id: originalBalance.id }, data: {
        quantityOnHand, quantityAvailable, quantityReserved, safetyStock, freshnessStatus, freshnessExpiresAt, availabilityStatus, version,
      } });
      const restored = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: originalBalance.id } });
      assert(restored.quantityAvailable.eq(originalBalance.quantityAvailable) && restored.quantityOnHand.eq(originalBalance.quantityOnHand), "Resupply fixture polluted shared stock");
      assert(await prisma.inventoryLot.count({ where: { OR: originalLots.map(lot => ({ id: lot.id, status: lot.status })) } }) === originalLots.length, "Resupply fixture polluted shared lots");
    }
    await prisma.commerceMetricEvent.deleteMany({ where: { supplierOrderId: order.id } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
    if (stockBalanceId) await prisma.outboxEvent.deleteMany({ where: { aggregateId: stockBalanceId } });
    } catch (error) {
      console.error("Resupply fixture cleanup failed:", error);
      primaryError ??= error;
    }
  }
  if (primaryError) throw primaryError;
}
