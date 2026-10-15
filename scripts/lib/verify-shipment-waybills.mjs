import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Called only by the isolated PostgreSQL harness; all rows belong to its disposable fixtures.
export async function verifyShipmentWaybills({ prisma, call, request, assert, identity, buyer, outsider, order, otherOrder, role, storageRoot }) {
  const shipments = [], trigger = `waybill_reject_${process.pid}`;
  try {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { code: "shipment.manage" } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: (await prisma.permission.findUniqueOrThrow({ where: { code: "document.sign" } })).id } });
    await prisma.supplierOrder.update({ where: { id: order.id }, data: { status: "ASSEMBLING", paymentStatus: "PAID" } });
    const item = await prisma.supplierOrderItem.findFirstOrThrow({ where: { supplierOrderId: order.id } });
    await prisma.warehouse.update({ where: { id: item.warehouseId }, data: { addressLine: "Synthetic warehouse address" } });
    const shipment = await prisma.shipment.create({ data: { supplierOrderId: order.id, warehouseId: item.warehouseId,
      shipmentNumber: `WAYBILL-${randomUUID()}`, method: "CARRIER", status: "PACKING", recipientName: "Synthetic recipient",
      destinationAddress: { line1: "Synthetic address" }, items: { create: { supplierOrderItemId: item.id, quantity: "1" } } } });
    shipments.push(shipment.id);
    const endpoint = `/supplier-orders/${order.id}/shipments/${shipment.id}/waybills`;
    const current = await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id } });
    const input = { expectedOrderVersion: current.version, expectedShipmentVersion: shipment.version, idempotencyKey: randomUUID() };
    await call(endpoint, undefined, 403, buyer); await call(endpoint, undefined, 403, outsider);
    await call(`/supplier-orders/${otherOrder.id}/shipments/${shipment.id}/waybills`, undefined, 404);
    await call(endpoint + "/prepare", { ...input, expectedShipmentVersion: 999 }, 409);
    await call(endpoint + "/prepare", { ...input, amountMinor: "1" }, 400);
    const prepared = await Promise.all([call(endpoint + "/prepare", input), call(endpoint + "/prepare", input)]);
    assert(prepared[0].documentId === prepared[1].documentId, "Concurrent replay created two waybills");
    const first = prepared[0];
    assert(first.snapshot.totalMinor === "5800" && first.snapshot.vatMinor === "800" && first.status === "PREVIEW", "Partial batch amount or VAT is incorrect");
    const stored = await prisma.document.findUniqueOrThrow({ where: { id: first.documentId } });
    assert(stored.shipmentId === shipment.id && stored.status === "DRAFT" && !stored.immutableAt, "Preview was treated as a signed document");
    const body = await readFile(path.join(storageRoot, stored.storageKey));
    assert(createHash("sha256").update(body).digest("hex") === first.checksum, "Preview bytes do not match checksum");
    await call(`/documents/${first.documentId}`, undefined, 404, buyer);
    await call(`/documents/${first.documentId}/signature-sessions`, { method: "EDS" }, 409);
    const listed = await call(endpoint); assert(listed.waybills.length === 1 && listed.canPrepare, "Prepared draft missing");
    const delivery = await prisma.document.create({ data: { ownerOrganizationId: identity.organizationId, supplierOrderId: order.id,
      shipmentId: shipment.id, checkoutId: order.checkoutId, kind: "ACCOMPANYING_DOCUMENT", source: "UPLOADED", format: "PDF", status: "GENERATED", title: "Synthetic carrier document", documentNumber: randomUUID() } });
    assert((await call(endpoint)).deliveryDocuments.some(row => row.id === delivery.id), "Delivery document is not linked to its shipment");
    await prisma.shipment.update({ where: { id: shipment.id }, data: { version: { increment: 1 }, status: "READY" } });
    await call(endpoint + "/prepare", input, 409);
    assert((await call(endpoint)).waybills[0].status === "STALE", "Changed shipment did not invalidate preview");
    const replacement = await call(endpoint + "/prepare", { ...input, expectedShipmentVersion: 2, idempotencyKey: randomUUID() });
    assert(replacement.version === 2 && replacement.documentId !== first.documentId, "Replacement overwrote original");
    // A failed audit insert must roll back the reserved document and its participants.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'shipment.waybill.prepared' THEN RAISE EXCEPTION 'synthetic waybill rollback'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    const before = await prisma.document.count({ where: { shipmentId: shipment.id, kind: "WAYBILL" } });
    await call(endpoint + "/prepare", { ...input, expectedShipmentVersion: 2, idempotencyKey: randomUUID() }, 500);
    assert(await prisma.document.count({ where: { shipmentId: shipment.id, kind: "WAYBILL" } }) === before, "Failed audit left a waybill behind");
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "AuditLog"`); await prisma.$executeRawUnsafe(`DROP FUNCTION "${trigger}"()`);
    // Hold the same lock as logistics; preparation must see the committed transition and reject stale inputs.
    let release, locked;
    const ready = new Promise(resolve => { locked = resolve; }); const gate = new Promise(resolve => { release = resolve; });
    const transition = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "SupplierOrder" WHERE id = ${order.id}::uuid FOR UPDATE`;
      locked(); await gate;
      await tx.shipment.update({ where: { id: shipment.id }, data: { status: "DISPATCHED", version: { increment: 1 } } });
    });
    await ready;
    const pending = request(endpoint + "/prepare", { identity, method: "POST", body: { ...input, expectedShipmentVersion: 2, idempotencyKey: randomUUID() } });
    release(); await transition;
    assert((await pending).status === 409, "Preparation accepted a dispatched/stale batch");
    await call(`/supplier-orders/${order.id}/document-pack`, { shipmentId: shipment.id }, 409);
    console.log("Waybill PostgreSQL/API PASS: partial VAT, role/tenant, stale, replay/concurrency, audit rollback, delivery links and unsigned preview");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
    // Documents belong to the enclosing invoice fixture; detach only the shipments created here.
    await prisma.document.updateMany({ where: { shipmentId: { in: shipments } }, data: { shipmentId: null } });
    await prisma.shipmentItem.deleteMany({ where: { shipmentId: { in: shipments } } });
    await prisma.shipment.deleteMany({ where: { id: { in: shipments } } });
  }
}
