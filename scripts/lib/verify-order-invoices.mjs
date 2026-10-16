import { verifyOrderDiscrepancies } from "./verify-order-discrepancies.mjs";
import { verifyOrderResupply } from "./verify-order-resupply.mjs";
import { verifyShipmentWaybills } from "./verify-shipment-waybills.mjs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { calculateVatLine } from "@marketplace/schemas";
import { completeFixtureOrganization } from "./organization-profile-fixture.mjs";
import { verifyOrderInvoiceUpgrade } from "./verify-order-invoice-upgrade.mjs";

export async function verifyOrderInvoices({ prisma, createBuyer, createCartWithItem, request, runId, assert, supplierId, offers, storageRoot, waybills = false, discrepancies = false, resupply = false }) {
  if (!discrepancies && !resupply) await verifyOrderInvoiceUpgrade(prisma, assert);
  const [buyer, person, outsider, supplier2] = await Promise.all([21, 22, 23, 24].map(index => createBuyer(index)));
  const identity = { userId: person.userId, organizationId: supplierId }, orderIds = [];
  let secondOffer, warehouse, primaryError; const trigger = `invoice_reject_${process.pid}`;
  const call = async (path, body, expected = body === undefined ? 200 : 201, who = identity, method = body === undefined ? "GET" : "POST") => {
    const result = await request(path, { identity: who, method, body });
    assert(result.status === expected, `Invoice ${path}: expected ${expected}, got ${result.status} ${JSON.stringify(result.body)}`);
    return result.body;
  };
  const permissions = ["order.confirm", "document.issue", "document.view", "organization.view", "organization.members.manage"];
  const ownRequisites = async who => {
    const route = "/organizations/current/requisites", before = await call(route, undefined, 200, who), bankId = randomUUID();
    await call(route, { expectedVersion: before.version, expectedOrganizationVersion: before.source.organizationVersion, idempotencyKey: randomUUID(), fields: {
      legalForm: "LEGAL_ENTITY", bankAccounts: [{ id: bankId, bankName: "Synthetic Bank", iban: "KZ86125KZT5004100100", bic: "FAKEKZXX", kbe: "17", currency: "KZT" }],
      defaultBankAccountId: bankId, taxPeriods: [{ id: randomUUID(), status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null, reference: null }],
    } }, 201, who);
    const current = await call(route, undefined, 200, who);
    await call(route + "/confirm", { expectedVersion: current.version, expectedOrganizationVersion: current.source.organizationVersion, idempotencyKey: randomUUID(), acknowledged: true }, 201, who);
    return (await call(route, undefined, 200, who)).current;
  };
  try {
    const role = await prisma.role.create({ data: { organizationId: supplierId, code: `${runId}-invoice`, name: "Invoice fixture", permissions: { create: permissions.map(code => ({ permission: { connect: { code } } })) } } });
    await prisma.organizationMembership.create({ data: { organizationId: supplierId, userId: person.userId, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
    await prisma.organizationCapability.create({ data: { organizationId: supplier2.organizationId, capability: "SUPPLIER" } });
    await prisma.supplierProfile.create({ data: { organizationId: supplier2.organizationId } });
    const secondRole = await prisma.role.findFirstOrThrow({ where: { organizationId: supplier2.organizationId } });
    for (const code of ["order.confirm", "document.issue", "document.view"]) await prisma.rolePermission.create({ data: { roleId: secondRole.id, permissionId: (await prisma.permission.findUniqueOrThrow({ where: { code } })).id } });
    const buyerRole = await prisma.role.findFirstOrThrow({ where: { organizationId: buyer.organizationId } });
    await prisma.rolePermission.create({ data: { roleId: buyerRole.id, permissionId: (await prisma.permission.findUniqueOrThrow({ where: { code: "document.view" } })).id } });
    await completeFixtureOrganization(prisma, supplierId); await completeFixtureOrganization(prisma, supplier2.organizationId);
    await prisma.organizationProfile.update({ where: { organizationId: supplier2.organizationId }, data: { additionalContacts: [1, 2].map(n => ({ contactName: `Reserve ${n}`, phone: "+77000000000", email: `reserve${n}@example.invalid` })) } });
    const supplierRequisites = await ownRequisites(identity), secondRequisites = await ownRequisites(supplier2);
    const originalOffer = await prisma.supplierOffer.findUniqueOrThrow({ where: { id: offers[0].offerId } });
    warehouse = await prisma.warehouse.create({ data: { supplierOrganizationId: supplier2.organizationId, code: runId, name: "Invoice fixture warehouse" } });
    secondOffer = await prisma.supplierOffer.create({ data: { supplierOrganizationId: supplier2.organizationId, productVariantId: originalOffer.productVariantId, status: "ACTIVE" } });
    const originalWarehouse = await prisma.warehouse.findFirstOrThrow({ where: { supplierOrganizationId: supplierId } });
    const makeOrder = async (who, offer, warehouseId, requisites, index) => {
      const cart = await createCartWithItem(buyer, offers[0].offerId, 1);
      const cartItem = await prisma.cartItem.findFirstOrThrow({ where: { cartId: cart.id } });
      if (cartItem.offerId !== offer.id) await prisma.cartItem.update({ where: { id: cartItem.id }, data: { offerId: offer.id } });
      const checkout = await prisma.checkout.create({ data: { cartId: cart.id, buyerOrganizationId: buyer.organizationId, totalAmountMinor: "11600", currency: "KZT", status: "COMPLETED", idempotencyKey: `${runId}-invoice-${index}`, pricingSnapshot: {} } });
      const tax = calculateVatLine("11600", { selection: { mode: "TAXABLE", rate: "16", basis: null }, ruleId: "KZ_STANDARD_2026_V1", source: "EXPLICIT", defaultVersion: null,
        declaredAt: new Date().toISOString(), declaredById: who.userId, profile: { revisionId: requisites.id, version: requisites.version, organizationVersion: requisites.source.organizationVersion,
          taxPeriodId: requisites.fields.taxPeriods[0].id, status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null } });
      const order = await prisma.supplierOrder.create({ data: { checkoutId: checkout.id, supplierOrganizationId: who.organizationId, buyerOrganizationId: buyer.organizationId,
        orderNumber: `${runId}-invoice-${index}`, status: "CONFIRMED", commerceDataset: "TEST", subtotalAmountMinor: "11600", currency: "KZT",
        items: { create: { cartItemId: cartItem.id, offerId: offer.id, productVariantId: offer.productVariantId, warehouseId, quantity: 2, acceptedQuantity: 2, unitPriceMinor: "5800", totalPriceMinor: "11600", currency: "KZT", status: "CONFIRMED", offerSnapshot: { pricing: { tax } }, inventorySnapshot: {} } } } });
      await prisma.cart.update({ where: { id: cart.id }, data: { status: "CHECKED_OUT" } });
      orderIds.push(order.id); return order;
    };
    const order = await makeOrder(identity, originalOffer, originalWarehouse.id, supplierRequisites, 1);
    const otherOrder = await makeOrder(supplier2, secondOffer, warehouse.id, secondRequisites, 2);
    if (resupply) { await verifyOrderResupply({ prisma, call, request, assert, identity, buyer, outsider, otherSupplier: supplier2, order, otherOrder, storageRoot }); }
    else if (discrepancies) { await verifyOrderDiscrepancies({ prisma, call, request, assert, identity, buyer, outsider, order, otherOrder }); } else {
    const endpoint = id => `/supplier-orders/${id}/invoices`, prepare = (id, expectedVersion = 1, key = randomUUID(), who = identity) => call(endpoint(id) + "/prepare", { expectedVersion, idempotencyKey: key }, 201, who);
    await call(endpoint(order.id) + "/prepare", { expectedVersion: 1, idempotencyKey: randomUUID() }, 409);
    assert(await prisma.orderInvoicePreparation.count({ where: { supplierOrderId: order.id } }) === 0, "Incomplete requisites reserved an invoice");
    await ownRequisites(buyer);
    await call(endpoint(order.id), undefined, 404, outsider);
    await call(endpoint(order.id) + "/prepare", { expectedVersion: 1, idempotencyKey: randomUUID(), totalMinor: "1" }, 400);
    await call(endpoint(order.id) + "/prepare", { expectedVersion: 1, idempotencyKey: randomUUID() }, 403, buyer);
    const key = randomUUID();
    const [draft, replay, second] = await Promise.all([prepare(order.id, 1, key), prepare(order.id, 1, key), prepare(otherOrder.id, 1, randomUUID(), supplier2)]);
    assert(draft.documentId === replay.documentId && draft.number !== second.number, "Parallel replay/number uniqueness failed");
    assert(draft.snapshot.totalMinor === "11600" && draft.snapshot.baseMinor === "10000" && draft.snapshot.vatMinor === "1600", "Invoice added VAT twice");
    assert(draft.snapshot.supplier.source.legalName !== second.snapshot.supplier.source.legalName, "Supplier requisites mixed");
    assert((await call(endpoint(order.id), undefined, 200, buyer)).invoices.length === 0, "Buyer sees a draft");
    await call(`/documents/${draft.documentId}`, undefined, 404, buyer);
    const buyerArchive = await call(`/documents?supplierOrderId=${order.id}`, undefined, 200, buyer);
    assert(!JSON.stringify(buyerArchive).includes(draft.documentId), "Draft leaked through generic document list");
    await call(endpoint(order.id) + "/prepare", { expectedVersion: 2, idempotencyKey: key }, 409);
    const confirm = (value, version, idempotencyKey = randomUUID()) => ({ action: "ISSUE_INVOICE", documentId: value.documentId, expectedVersion: version, idempotencyKey, previewChecksum: value.checksum });
    const workflow = `/supplier-orders/${order.id}/workflow`;
    await call(workflow, confirm(draft, 1), 403, buyer);
    await prisma.organization.update({ where: { id: supplierId }, data: { version: { increment: 1 } } });
    await call(workflow, confirm(draft, 1), 409);
    await ownRequisites(identity);
    await call(workflow, confirm(draft, 1), 409);
    const fresh = await prepare(order.id);
    assert(fresh.number === draft.number && fresh.version === 2, "New preview lost version chain");
    const command = confirm(fresh, 1);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger AS $$ BEGIN IF NEW."aggregateId" = '${order.id}' AND NEW."eventType" = 'OrderWorkflowChanged' THEN RAISE EXCEPTION 'synthetic invoice rollback'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "OutboxEvent" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    await call(workflow, command, 500);
    assert((await prisma.orderInvoicePreparation.findUniqueOrThrow({ where: { documentId: fresh.documentId } })).confirmedAt === null, "Rollback left invoice confirmed");
    assert((await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id } })).manualInvoiceDocumentId === null, "Rollback linked an invoice");
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "OutboxEvent"`); await prisma.$executeRawUnsafe(`DROP FUNCTION "${trigger}"()`);
    const committed = await call(workflow, command);
    assert((await call(workflow, command)).eventId === committed.eventId, "Confirm replay duplicated event");
    const visible = await call(endpoint(order.id), undefined, 200, buyer);
    assert(visible.currentDocumentId === fresh.documentId && visible.invoices.length === 1 && visible.invoices[0].status === "CONFIRMED", "Buyer cannot find confirmed invoice");
    const stored = await prisma.document.findUniqueOrThrow({ where: { id: fresh.documentId } });
    assert(stored.immutableAt && stored.checksumSha256 !== fresh.checksum, "Final PDF not sealed separately from preview");
    let immutable = false; try { await prisma.document.update({ where: { id: stored.id }, data: { dataSnapshot: {} } }); } catch { immutable = true; }
    assert(immutable, "Confirmed PDF snapshot was mutable");
    const replacements = await Promise.all([prepare(order.id, committed.version), prepare(order.id, committed.version)]);
    const race = await Promise.all(replacements.map(value => request(workflow, { identity, method: "POST", body: confirm(value, committed.version) })));
    assert(race.map(value => value.status).sort().join(",") === "201,409", `Confirmation race: ${JSON.stringify(race)}`);
    assert((await prisma.document.findUniqueOrThrow({ where: { id: stored.id } })).status === "SUPERSEDED", "Replaced invoice not marked in history");
    const history = await call(endpoint(order.id), undefined, 200, buyer);
    assert(history.invoices.length === 2, "History must omit unconfirmed versions");
    const current = await prisma.supplierOrder.findUniqueOrThrow({ where: { id: order.id } });
    const proof = await prisma.document.create({ data: { ownerOrganizationId: buyer.organizationId, supplierOrderId: order.id, kind: "PAYMENT_PROOF", source: "UPLOADED", format: "PDF", status: "GENERATED", title: "Synthetic proof", documentNumber: randomUUID() } });
    await prisma.orderTransferClaim.create({ data: { supplierOrderId: order.id, invoiceDocumentId: current.manualInvoiceDocumentId, documentId: proof.id, amountMinor: "11600", currency: "KZT", paidAt: new Date(), reportedById: buyer.userId, comment: "Synthetic invoice payment lock fixture" } });
    await call(endpoint(order.id) + "/prepare", { expectedVersion: current.version, idempotencyKey: randomUUID() }, 409);
    if (waybills) await verifyShipmentWaybills({ prisma, call, request, assert, identity, buyer, outsider, order, otherOrder, role, storageRoot });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permission: { code: "document.issue" } } });
    await call(endpoint(otherOrder.id) + "/prepare", { expectedVersion: 1, idempotencyKey: randomUUID() }, 403);
    const file = await readFile(path.join(storageRoot, stored.storageKey));
    assert(createHash("sha256").update(file).digest("hex") === stored.checksumSha256, "Stored file checksum mismatch");
    console.log("Invoice PostgreSQL/API PASS: two suppliers, unique numbering, replay/race, requisites, tenant/role, draft visibility, exact totals, stale, rollback, immutable versions and payment lock");
    }
  } catch (error) {
    primaryError = error;
    console.error("Invoice verification failed before cleanup:", error);
  } finally {
    try {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "OutboxEvent"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
    const docs = await prisma.document.findMany({ where: { supplierOrderId: { in: orderIds } }, select: { id: true } });
    await prisma.orderTransferClaim.deleteMany({ where: { supplierOrderId: { in: orderIds } } });
    await prisma.orderInvoicePreparation.deleteMany({ where: { supplierOrderId: { in: orderIds } } });
    await prisma.documentParticipant.deleteMany({ where: { documentId: { in: docs.map(d => d.id) } } });
    await prisma.document.deleteMany({ where: { id: { in: docs.map(d => d.id) } } });
    await prisma.orderWorkflowEvent.deleteMany({ where: { supplierOrderId: { in: orderIds } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: [...orderIds, ...docs.map(d => d.id)] } } });
    await prisma.supplierOrderItem.deleteMany({ where: { supplierOrderId: { in: orderIds } } });
    await prisma.supplierOrder.deleteMany({ where: { id: { in: orderIds } } });
    if (secondOffer) {
      await prisma.cartItem.deleteMany({ where: { offerId: secondOffer.id, cart: { buyerOrganizationId: buyer.organizationId } } });
      await prisma.supplierOffer.delete({ where: { id: secondOffer.id } });
    }
    if (warehouse) await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.supplierProfile.deleteMany({ where: { organizationId: supplier2.organizationId } });
    for (const organizationId of [supplierId, buyer.organizationId, supplier2.organizationId]) {
      await prisma.idempotencyRecord.deleteMany({ where: { scope: { in: [`organization-requisites:${organizationId}:save`, `organization-requisites:${organizationId}:confirm`] } } });
      await prisma.organizationRequisitesRevision.deleteMany({ where: { organizationId } }); await prisma.organizationRequisites.deleteMany({ where: { organizationId } });
    }
    } catch (cleanupError) {
      console.error("Invoice fixture cleanup failed:", cleanupError);
      primaryError ??= cleanupError;
    }
  }
  if (primaryError) throw primaryError;
}
