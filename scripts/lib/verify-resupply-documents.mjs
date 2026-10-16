import { createHash, randomUUID } from "node:crypto";

export async function verifyResupplyDocumentsBeforeReceipt({ prisma, call, request, assert, identity, supplierRoleId, buyer, otherSupplier, order, otherOrder, discrepancyId, replacement, sourceDocument }) {
  const endpoint = `/supplier-orders/${order.id}/discrepancies/${discrepancyId}/documents`;
  const state = await call(endpoint, undefined, 200);
  const input = { kind: "TRANSFER", expectedOrderVersion: state.orderVersion, expectedShipmentVersion: state.shipmentVersion,
    expectedExceptionVersion: state.exceptionVersion, expectedResupplyVersion: state.resupplyVersion, idempotencyKey: randomUUID() };
  assert(state.canPrepare && !state.canPrepareSettlement, "Premature settlement was offered");
  await call(`${endpoint}/prepare`, { ...input, kind: "SETTLEMENT" }, 409);
  await call(`${endpoint}/prepare`, { ...input, quantity: "999" }, 400);
  await call(`${endpoint}/prepare`, { ...input, expectedResupplyVersion: 999 }, 409);
  await call(`${endpoint}/prepare`, input, 403, buyer);
  await call(`${endpoint}/prepare`, input, 404, otherSupplier);
  await call(`/supplier-orders/${otherOrder.id}/discrepancies/${discrepancyId}/documents/prepare`, input, 404, otherSupplier);
  // Other scenarios create roles in this organization; revoke the actor's exact fixture grant.
  const role = await prisma.role.findUniqueOrThrow({ where: { id: supplierRoleId } });
  assert(role.organizationId === identity.organizationId, "Permission fixture role belongs to another organization");
  const permission = await prisma.permission.findUniqueOrThrow({ where: { code: "document.issue" } });
  await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: permission.id } });
  try { await call(`${endpoint}/prepare`, input, 403); }
  finally { await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } }); }
  const trigger = `rd_reject_${process.pid}`;
  try {
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."eventType" = 'ResupplyDocumentDraftPrepared' AND NEW.payload->>'orderId' = '${order.id}' THEN RAISE EXCEPTION 'synthetic draft rollback'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    await call(`${endpoint}/prepare`, input, 500);
    assert(await prisma.document.count({ where: { supplierOrderId: order.id, externalId: { startsWith: "RESUPPLY_DOCUMENT_PREVIEW:" } } }) === 0, "Rollback left a draft");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "OutboxEvent"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  }
  const race = await Promise.all([1, 2].map(() => request(`${endpoint}/prepare`, { identity, method: "POST", body: input })));
  assert(race.every(r => r.status === 201) && race[0].body.documentId === race[1].body.documentId, "Concurrent draft replay created different versions");
  const transfer = race[0].body;
  await call(`${endpoint}/prepare`, { ...input, kind: "SETTLEMENT" }, 409);
  const saved = await prisma.document.findUniqueOrThrow({ where: { id: transfer.documentId } });
  const pdf = await call(`${endpoint}/${transfer.documentId}/download`, undefined, 200, buyer);
  const checksum = createHash("sha256").update(Buffer.from(pdf.contentBase64, "base64")).digest("hex");
  assert(checksum === transfer.checksum && Buffer.from(pdf.contentBase64, "base64").subarray(0, 4).toString() === "%PDF", "Draft PDF is not preserved");
  await call(`${endpoint}/${sourceDocument.id}/download`, undefined, 404, buyer);
  await call(`${endpoint}/${transfer.documentId}/download`, undefined, 404, otherSupplier);
  const signatureCount = await prisma.documentSignature.count({ where: { documentId: transfer.documentId } });
  // The common service guard is covered by unit tests; the public route also must not sign a DRAFT.
  const sign = await request(`/documents/${transfer.documentId}/signature-sessions`, { identity, method: "POST", body: { method: "MOCK", expiresInMinutes: 60 } });
  assert([403, 409].includes(sign.status), "Public document route allowed a draft signature");
  assert(await prisma.documentSignature.count({ where: { documentId: transfer.documentId } }) === signatureCount, "Draft acquired a signature");
  return async () => {
    const now = await call(endpoint, undefined, 200, buyer);
    assert(now.documents.find(d => d.documentId === transfer.documentId)?.status === "STALE", "Pre-receipt draft was not historical");
    const supplierState = await call(endpoint, undefined, 200);
    assert(supplierState.canPrepareSettlement, "Full receipt did not enable settlement draft");
    const stockBefore = JSON.stringify(await prisma.inventoryReservation.findMany({ where: { referenceType: "ORDER_RESUPPLY", referenceId: replacement.id } }));
    const orderBefore = JSON.stringify(await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id } }));
    const settlementInput = { ...input, kind: "SETTLEMENT", expectedOrderVersion: supplierState.orderVersion, expectedShipmentVersion: supplierState.shipmentVersion,
      expectedExceptionVersion: supplierState.exceptionVersion, expectedResupplyVersion: supplierState.resupplyVersion, idempotencyKey: randomUUID() };
    const settled = await call(`${endpoint}/prepare`, settlementInput);
    assert(settled.snapshot.lines[0].originalQuantity === "10" && settled.snapshot.lines[0].originalReceivedQuantity === "8" && settled.snapshot.lines[0].receivedQuantity === "2", "Settlement lost 10/8/2");
    assert(JSON.stringify(await prisma.document.findUniqueOrThrow({ where: { id: transfer.documentId } })) === JSON.stringify(saved), "History was rewritten");
    assert((await call(`${endpoint}/prepare`, input)).documentId === transfer.documentId, "Replay after receipt did not return saved draft");
    const refreshed = await call(`${endpoint}/prepare`, { ...settlementInput, kind: "TRANSFER", idempotencyKey: randomUUID() });
    assert(refreshed.version === 2, "New draft version not linked");
    assert((await prisma.document.findUniqueOrThrow({ where: { id: refreshed.documentId } })).previousVersionId === transfer.documentId, "Previous version link absent");
    assert(JSON.stringify(await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id } })) === orderBefore, "Draft changed order or money");
    assert(JSON.stringify(await prisma.inventoryReservation.findMany({ where: { referenceType: "ORDER_RESUPPLY", referenceId: replacement.id } })) === stockBefore, "Draft re-consumed stock");
    assert((await prisma.orderDiscrepancy.findUniqueOrThrow({ where: { id: discrepancyId } })).status === "AGREED", "Draft closed discrepancy");
    const buyerView = await call(endpoint, undefined, 200, buyer);
    assert(!buyerView.canPrepare && buyerView.documents.length === 3, "Buyer visibility or write capability incorrect");
    console.log("Resupply documents PostgreSQL/API PASS: permissions/tenant, invalid/stale, premature settlement, outbox rollback, concurrent replay, PDF/checksum, versions, buyer read, unchanged money-stock/AGREED");
  };
}
