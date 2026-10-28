import assert from "node:assert/strict";

// Synthetic records, HTTP API and real Prisma/PostgreSQL from the existing harness.
// Persisted EDS rows below are test evidence, not a cryptographic verifier fixture.
export async function verifyWave1Security({ prisma, createBuyer, request, runId }) {
  const target = new URL(process.env.POSTGRES_TEST_DATABASE_URL);
  const expectedCluster = process.env.WAVE1_OWNED_CLUSTER_DATA_DIR;
  const [database] = await prisma.$queryRaw`SELECT current_setting('data_directory') AS directory`;
  assert(["127.0.0.1", "localhost"].includes(target.hostname) && target.port !== "5432" && expectedCluster
    && database.directory.replaceAll("\\", "/").toLowerCase() === expectedCluster.replaceAll("\\", "/").toLowerCase(), "Wave1 immutable ledger fixture requires its own disposable cluster");
  const [buyer, supplier, neighbor, outsider, denied, operator] = await Promise.all([81, 82, 83, 84, 85, 86].map(index => createBuyer(index)));
  const actors = [buyer, supplier, neighbor, outsider, operator];
  const documents = [], agreements = [], marketplaceAgreements = [], orders = [], ledgerIds = [];
  let cart, checkout, intent, provider;
  let assertions = 0;
  const check = (condition, message) => { assert(condition, message); assertions++; };
  const http = async (route, identity, status, body) => {
    const result = await request(route, { identity, ...(body ? { method: "POST", body } : {}) });
    assert.equal(result.status, status, `${route}: ${JSON.stringify(result.body)}`); assertions++;
    return result.body;
  };
  try {
    for (const actor of actors) {
      const role = await prisma.role.findFirstOrThrow({ where: { organizationId: actor.organizationId } });
      for (const code of ["payment.view", "document.view", "document.sign"]) {
        const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
        await prisma.rolePermission.createMany({ data: [{ roleId: role.id, permissionId: permission.id }], skipDuplicates: true });
      }
    }
    cart = await prisma.cart.create({ data: { buyerOrganizationId: buyer.organizationId, currency: "KZT" } });
    checkout = await prisma.checkout.create({ data: { cartId: cart.id, buyerOrganizationId: buyer.organizationId,
      totalAmountMinor: 2000, currency: "KZT", status: "COMPLETED", idempotencyKey: `${runId}-wave1`, pricingSnapshot: { synthetic: true } } });
    provider = await prisma.paymentProvider.create({ data: { code: `${runId}-wave1`, name: "Synthetic only", capabilities: {} } });
    intent = await prisma.paymentIntent.create({ data: { checkoutId: checkout.id, buyerOrganizationId: buyer.organizationId,
      providerId: provider.id, totalAmountMinor: 2000, currency: "KZT", idempotencyKey: runId } });
    const allocationIds = [];
    for (const [index, actor] of [supplier, neighbor].entries()) {
      const order = await prisma.supplierOrder.create({ data: { checkoutId: checkout.id, supplierOrganizationId: actor.organizationId,
        buyerOrganizationId: buyer.organizationId, orderNumber: `${runId}-wave1-${index}`, subtotalAmountMinor: 1000, currency: "KZT", commerceDataset: "TEST" } });
      orders.push(order.id);
      const allocation = await prisma.paymentAllocation.create({ data: { paymentIntentId: intent.id, supplierOrderId: order.id,
        recipientOrganizationId: actor.organizationId, grossAmountMinor: 1000, platformFeeMinor: 0, netAmountMinor: 1000 } });
      allocationIds.push(allocation.id);
      const entry = await prisma.financialLedgerEntry.create({ data: { debitAccount: `synthetic:${runId}`, creditAccount: `payable:supplier:${actor.organizationId}`,
        amountMinor: 1000, currency: "KZT", referenceType: "PaymentIntent", referenceId: intent.id,
        idempotencyKey: `${runId}-wave1-${index}`, metadata: { paymentAllocationId: allocation.id, synthetic: true } } });
      ledgerIds.push(entry.id);
    }
    const route = `/ledger?referenceType=PaymentIntent&referenceId=${intent.id}`;
    const own = await http(route, supplier, 200);
    check(own.length === 1 && own[0].id === ledgerIds[0] && own[0].metadata.paymentAllocationId === allocationIds[0], "Supplier saw adjacent allocation");
    const adjacent = await http(route, neighbor, 200);
    check(adjacent.length === 1 && adjacent[0].id === ledgerIds[1], "Neighbor did not receive only its own entry");
    check((await http(route, buyer, 200)).length === 2, "Buyer lost its payment entries");
    check((await http(route, outsider, 200)).length === 0, "Foreign tenant saw ledger");
    await http(route, { userId: supplier.userId, organizationId: outsider.organizationId }, 403);
    await http(route, denied, 403);
    check((await http(`/ledger?referenceType=PaymentIntent&referenceId=${outsider.organizationId}`, supplier, 200)).length === 0, "referenceId replaced by visibility");
    check((await http(`/ledger?referenceType=Unknown&referenceId=${intent.id}`, supplier, 200)).length === 0, "referenceType replaced by visibility");
    await prisma.organizationCapability.create({ data: { organizationId: operator.organizationId, capability: "MARKETPLACE_OPERATOR" } });
    const template = await prisma.documentTemplate.findUniqueOrThrow({ where: { code_version: { code: "MARKETPLACE_SUPPLIER_AGREEMENT_RU", version: 1 } } });
    for (const kind of ["buyer-supplier", "marketplace"]) {
      const counterparty = kind === "marketplace" ? operator : buyer;
      const document = await prisma.document.create({ data: { ownerOrganizationId: supplier.organizationId,
        kind: kind === "marketplace" ? "MARKETPLACE_SUPPLIER_AGREEMENT" : "FRAMEWORK_SUPPLY_AGREEMENT",
        format: "PDF", source: "GENERATED", status: "AWAITING_SIGNATURE", title: `Synthetic ${kind}`,
        documentNumber: `${runId}-${kind}`, storageKey: `synthetic/${runId}/${kind}.pdf`, checksumSha256: "a".repeat(64),
        requiredSignatureCount: 2, metadata: { synthetic: true, notLegallyBinding: true } } });
      documents.push(document.id);
      if (kind === "marketplace") {
        const agreement = await prisma.marketplaceAgreement.create({ data: { supplierOrganizationId: supplier.organizationId,
          operatorOrganizationId: operator.organizationId, agreementNumber: `${runId}-${kind}`, documentId: document.id, templateId: template.id, templateVersion: 1 } });
        marketplaceAgreements.push(agreement.id);
      } else {
        const agreement = await prisma.buyerSupplierAgreement.create({ data: { supplierOrganizationId: supplier.organizationId,
          buyerOrganizationId: buyer.organizationId, agreementNumber: `${runId}-${kind}`, documentId: document.id, templateVersion: 1 } });
        agreements.push(agreement.id);
      }
      await http(`/documents/${document.id}`, counterparty, 200); // Read access exists, completion must still be denied.
      const session = await http(`/documents/${document.id}/signature-sessions`, supplier, 201, { method: "MOCK", expiresInMinutes: 60 });
      const signatureId = session.signature.id;
      const before = await prisma.documentSignature.findUniqueOrThrow({ where: { id: signatureId } });
      check(before.signerUserId === supplier.userId && before.signerOrganizationId === supplier.organizationId, "Signer defaults were not persisted");
      await http(`/documents/signatures/${signatureId}/complete`, counterparty, 403, { status: "SIGNED" });
      const after = await prisma.documentSignature.findUniqueOrThrow({ where: { id: signatureId } });
      check(after.status === before.status && !after.signedAt, "Foreign completion changed persisted signature");
      await http(`/documents/signatures/${signatureId}/complete`, outsider, 403, { status: "SIGNED" });
      await http(`/documents/${document.id}/signature-sessions`, supplier, 403, { method: "MOCK", signerOrganizationId: counterparty.organizationId, expiresInMinutes: 60 });
      await prisma.documentSignature.createMany({ data: [
        { documentId: document.id, signerOrganizationId: supplier.organizationId, signerUserId: supplier.userId, method: "EDS", status: "SIGNED", signedAt: new Date() },
        { documentId: document.id, signerOrganizationId: supplier.organizationId, signerUserId: supplier.userId, method: "EDS", status: "SIGNED", signedAt: new Date() },
        { documentId: document.id, signerOrganizationId: outsider.organizationId, signerUserId: outsider.userId, method: "EDS", status: "SIGNED", signedAt: new Date() },
        { documentId: document.id, signerOrganizationId: counterparty.organizationId, signerUserId: counterparty.userId, method: "MOCK", status: "SIGNED", signedAt: new Date() },
      ] });
      await http(`/documents/signatures/${signatureId}/complete`, supplier, 201, { status: "SIGNED" });
      check((await prisma.document.findUniqueOrThrow({ where: { id: document.id } })).status === "PARTIALLY_SIGNED", "Duplicate/foreign/MOCK replaced missing agreement party");
      await http(`/documents/signatures/${signatureId}/complete`, supplier, 409, { status: "SIGNED" });
      check(await prisma.auditLog.count({ where: { entityId: signatureId, action: "document.signature.completed" } }) === 1, "Completion replay duplicated audit");
      await prisma.documentSignature.create({ data: { documentId: document.id, signerOrganizationId: counterparty.organizationId,
        signerUserId: counterparty.userId, method: "EDS", status: "SIGNED", signedAt: new Date() } });
      const finalSession = await http(`/documents/${document.id}/signature-sessions`, supplier, 201, { method: "MOCK", expiresInMinutes: 60 });
      await http(`/documents/signatures/${finalSession.signature.id}/complete`, supplier, 201, { status: "SIGNED" });
      check((await prisma.document.findUniqueOrThrow({ where: { id: document.id } })).status === "SIGNED", "Actual EDS parties did not complete agreement document");
    }
    console.log(JSON.stringify({ status: "passed", gate: "wave1-security-http-postgres", assertions,
      scenarios: ["adjacent-allocation", "foreign-tenant", "role-denial", "query-intersection", "signer-binding", "foreign-completion", "missing-party", "duplicate-signature", "completion-replay"],
      eds: "Persisted synthetic EDS evidence only; no real cryptographic/provider verification" }));
  } finally {
    const signatures = await prisma.documentSignature.findMany({ where: { documentId: { in: documents } }, select: { id: true } });
    const ids = [...documents, ...signatures.map(value => value.id)];
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await prisma.marketplaceAgreement.deleteMany({ where: { id: { in: marketplaceAgreements } } });
    await prisma.buyerSupplierAgreement.deleteMany({ where: { id: { in: agreements } } });
    await prisma.document.deleteMany({ where: { id: { in: documents } } });
    // Append-only ledger must not be deleted or its trigger disabled for a test.
    // It is removed when the already-verified owned cluster is disposed.
    if (intent) { await prisma.paymentAllocation.deleteMany({ where: { paymentIntentId: intent.id } }); await prisma.paymentIntent.delete({ where: { id: intent.id } }); }
    await prisma.supplierOrder.deleteMany({ where: { id: { in: orders } } });
    if (checkout) await prisma.checkout.delete({ where: { id: checkout.id } });
    if (cart) await prisma.cart.delete({ where: { id: cart.id } });
    if (provider) await prisma.paymentProvider.delete({ where: { id: provider.id } });
    check(await prisma.document.count({ where: { id: { in: documents } } }) === 0, "Security fixture documents remain");
    check(await prisma.financialLedgerEntry.count({ where: { id: { in: ledgerIds } } }) === ledgerIds.length, "Immutable synthetic ledger unexpectedly changed");
    console.log("Wave1 mutable fixtures cleanup PASS; immutable ledger retained only until owned cluster disposal");
  }
}
