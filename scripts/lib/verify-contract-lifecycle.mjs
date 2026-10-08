import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const service = (file, name) => require(`../../apps/api/dist/src/modules/${file}.js`)[name];

// Uses only the parent harness's disposable database and tracked synthetic organizations.
export async function verifyContractLifecycle({ prisma, createBuyer, runId }) {
  const seller = await createBuyer(71);
  const operator = await createBuyer(72);
  const foreign = await createBuyer(73);
  const outsider = await createBuyer(74);
  const context = value => ({ actorId: value.userId, organizationId: value.organizationId });
  const Terms = service("agreements/supplier-terms.service", "SupplierTermsService");
  const Authority = service("access-control/platform-authority.policy", "PlatformAuthorityPolicy");
  const Agreements = service("buyer-supplier-agreements/buyer-supplier-agreements.service", "BuyerSupplierAgreementsService");
  const { buildSupplierLegalBundle, supplierLegalDocuments } = require("../../apps/api/dist/src/modules/agreements/supplier-legal-documents.js");
  const published = version => buildSupplierLegalBundle(supplierLegalDocuments.map(document => ({
    ...document, status: "PUBLISHED", version, content: `Synthetic only, not legal text: ${version}/${document.code}`,
  })));
  let bundle = buildSupplierLegalBundle(supplierLegalDocuments);
  const terms = new Terms(prisma, { current: () => bundle }, new Authority(prisma));
  const input = (organizationVersion = 1) => ({ organizationVersion, bundleHash: bundle.hash,
    reviewedDocuments: bundle.documents.map(({ code, hash }) => ({ code, hash })),
    acknowledged: true, actsForOrganization: true, representativeAuthority: "Synthetic fixture representative" });
  const evidence = { ipAddress: null, userAgent: "contract-lifecycle-fixture" };
  const review = { expectedVersion: 1, status: "APPROVED", organizationVerified: true,
    representativeVerified: true, reason: "Synthetic checks only" };
  let documentId;
  try {
    await prisma.organizationCapability.createMany({ data: [
      { organizationId: seller.organizationId, capability: "SUPPLIER" },
      { organizationId: operator.organizationId, capability: "MARKETPLACE_OPERATOR" },
    ] });
    await prisma.supplierProfile.create({ data: { organizationId: seller.organizationId } });
    const role = await prisma.role.findFirstOrThrow({ where: { organizationId: seller.organizationId } });
    for (const code of ["document.view", "document.sign"]) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code } });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    }
    const city = await prisma.city.findFirstOrThrow();
    await prisma.warehouse.create({ data: { supplierOrganizationId: seller.organizationId,
      code: runId, name: "Synthetic warehouse", cityId: city.id, addressLine: "Synthetic street 1" } });
    await prisma.organizationCredential.create({ data: { organizationId: seller.organizationId,
      type: "REGISTRATION_CERTIFICATE", number: runId, status: "VERIFIED", verifiedAt: new Date() } });
    await assert.rejects(() => terms.accept(input(), context(seller), evidence), { status: 409 });
    bundle = published("fixture-v1");
    await assert.rejects(() => terms.accept(input(), context(foreign), evidence), { status: 403 });
    // createBuyer completed a buyer profile before this fixture gained SUPPLIER.
    // The supplier must still provide its two reserve contacts before acceptance.
    await assert.rejects(() => terms.accept(input(), context(seller), evidence), { status: 409 });
    assert.equal(await prisma.supplierTermsAcceptance.count({ where: { organizationId: seller.organizationId } }), 0);
    await prisma.organizationProfile.update({ where: { organizationId: seller.organizationId }, data: {
      additionalContacts: [1, 2].map(index => ({ contactName: `Synthetic Reserve ${index}`,
        phone: `+7700000000${index}`, email: `reserve${index}@example.invalid` })),
    } });
    const first = await terms.accept(input(), context(seller), evidence);
    assert.equal((await terms.accept(input(), context(seller), evidence)).id, first.id);
    const original = await prisma.supplierTermsAcceptance.findUniqueOrThrow({ where: { id: first.id } });
    assert.equal(original.userId, seller.userId);
    assert.equal(original.organizationId, seller.organizationId);
    assert.equal(original.organizationVersion, 1);
    assert.equal(original.evidenceSnapshot.method, "AUTHENTICATED_ORGANIZATION_ACCEPTANCE");
    assert.equal(await prisma.auditLog.count({ where: { entityId: first.id, action: "supplier_terms.accepted" } }), 1);
    assert.equal(await prisma.outboxEvent.count({ where: { aggregateId: first.id, eventType: "SupplierTermsAccepted" } }), 1);
    assert.equal((await terms.commercialState(seller.organizationId)).admitted, false);
    await terms.review(first.id, review, context(operator));
    assert.equal((await terms.commercialState(seller.organizationId)).admitted, true);
    const download = await terms.download(first.id, context(seller));
    await assert.rejects(() => terms.download(first.id, context(foreign)), { status: 403 });

    bundle = published("fixture-v2");
    assert.equal((await terms.commercialState(seller.organizationId)).admitted, false);
    const second = await terms.accept(input(), context(seller), evidence);
    assert.notEqual(second.id, first.id);
    assert.equal(second.admissionStatus, "PENDING");
    assert.equal(await terms.download(first.id, context(seller)), download);
    await terms.review(second.id, review, context(operator));
    await assert.rejects(() => terms.review(second.id, review, context(operator)), { status: 409 });
    await prisma.organization.update({ where: { id: seller.organizationId }, data: { version: { increment: 1 } } });
    assert.equal((await terms.commercialState(seller.organizationId)).admitted, false);
    await assert.rejects(() => terms.accept(input(), context(seller), evidence), { status: 409 });
    const third = await terms.accept(input(2), context(seller), evidence);
    assert.equal(third.admissionStatus, "PENDING");
    await terms.review(third.id, review, context(operator));
    assert.ok((await terms.activeSupplierIds()).includes(seller.organizationId));
    await terms.review(third.id, { ...review, expectedVersion: 2, status: "SUSPENDED" }, context(operator));
    assert.ok(!(await terms.activeSupplierIds()).includes(seller.organizationId));
    const preserved = await prisma.supplierTermsAcceptance.findUniqueOrThrow({ where: { id: first.id } });
    for (const key of ["documentsSnapshot", "organizationSnapshot", "evidenceSnapshot", "acceptedAt", "userId"])
      assert.deepEqual(preserved[key], original[key]);

    const document = await prisma.document.create({ data: { ownerOrganizationId: seller.organizationId,
      kind: "FRAMEWORK_SUPPLY_AGREEMENT", format: "PDF", source: "GENERATED", status: "SIGNED",
      title: `Synthetic framework ${runId}`, documentNumber: `${runId}-framework`, metadata: { notLegallyBinding: true } } });
    documentId = document.id;
    const now = Date.now();
    const agreement = await prisma.buyerSupplierAgreement.create({ data: {
      agreementNumber: `${runId}-framework`, supplierOrganizationId: seller.organizationId,
      buyerOrganizationId: foreign.organizationId, documentId, templateVersion: 1,
      status: "ACTIVE", autoRenew: false, startsAt: new Date(now + 60_000), endsAt: new Date(now + 120_000),
    } });
    const agreements = new Agreements(prisma, {});
    const state = () => agreements.current(seller.organizationId, foreign.organizationId, context(foreign));
    assert.deepEqual(await state(), { agreement: null, frameworkAgreementAvailable: false, oneTimeDealAvailable: true });
    await prisma.buyerSupplierAgreement.update({ where: { id: agreement.id }, data: { startsAt: new Date(now - 60_000) } });
    assert.equal((await state()).frameworkAgreementAvailable, true);
    await assert.rejects(() => agreements.current(seller.organizationId, foreign.organizationId, context(outsider)), { status: 403 });
    assert.equal((await agreements.current(seller.organizationId, outsider.organizationId, context(outsider))).frameworkAgreementAvailable, false);
    await prisma.buyerSupplierAgreement.update({ where: { id: agreement.id }, data: { endsAt: new Date(now - 1) } });
    assert.deepEqual(await state(), { agreement: null, frameworkAgreementAvailable: false, oneTimeDealAvailable: true });
    assert.equal((await prisma.buyerSupplierAgreement.findUniqueOrThrow({ where: { id: agreement.id } })).status, "EXPIRED");
  } finally {
    const receipts = await prisma.supplierTermsAcceptance.findMany({ where: { organizationId: seller.organizationId }, select: { id: true } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: receipts.map(value => value.id) } } });
    await prisma.supplierTermsAcceptance.deleteMany({ where: { organizationId: seller.organizationId } });
    await prisma.buyerSupplierAgreement.deleteMany({ where: { supplierOrganizationId: seller.organizationId } });
    if (documentId) await prisma.document.delete({ where: { id: documentId } });
    await prisma.warehouse.deleteMany({ where: { supplierOrganizationId: seller.organizationId } });
    await prisma.organizationCredential.deleteMany({ where: { organizationId: seller.organizationId } });
  }
  console.log("Contract lifecycle: draft/replay/reacceptance, immutable evidence, separate admission, organization version and effective framework dates PASS");
}
