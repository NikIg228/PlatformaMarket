import { createRequire } from "node:module";
import { Prisma } from "@prisma/client";
import { offerComparisonResponseSchema } from "../../packages/schemas/dist/index.js";

const require = createRequire(import.meta.url);

export async function verifyCatalogAdmission({ prisma, offer, publicBuyer, foreignBuyer, supplierId, request, runId, assert }) {
  const source = await prisma.supplierOffer.findUniqueOrThrow({ where: { id: offer.offerId }, include: { productVariant: { include: { product: true } }, publication: true } });
  const balance = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: offer.balanceId } });
  const warehouse = await prisma.warehouse.findUniqueOrThrow({ where: { id: balance.warehouseId } });
  const productId = source.productVariant.productId;
  const cities = await prisma.city.findMany({ take: 2, orderBy: { id: "asc" } });
  assert(cities.length === 2, "Two reference cities required");
  const publication = source.publication;
  const nullValue = value => value === null ? Prisma.DbNull : value;
  let ruleId, credentialId;
  const compare = async ({ identity, cityId, variantId, spoofBuyer } = {}) => {
    const query = new URLSearchParams({ quantity: "1" });
    if (identity || spoofBuyer) query.set("buyerOrganizationId", spoofBuyer ?? identity.organizationId);
    if (cityId) query.set("cityId", cityId);
    if (variantId) query.set("variantId", variantId);
    const response = await request(`/${identity ? "marketplace" : "catalog"}/products/${productId}/compare?${query}`, { identity });
    assert(response.status === 200, `Comparison returned ${response.status}`);
    const body = offerComparisonResponseSchema.parse(response.body);
    return body.offers.filter(item => item.offerId === offer.offerId);
  };
  const audience = (buyers, cityIds = Prisma.DbNull) => prisma.offerPublication.update({ where: { offerId: offer.offerId }, data: { status: "RESTRICTED", marketplaceVisible: true, allowedBuyerIds: buyers, allowedCityIds: cityIds } });
  try {
    await prisma.warehouse.update({ where: { id: warehouse.id }, data: { cityId: cities[0].id } });
    for (const unrestricted of [Prisma.DbNull, Prisma.JsonNull, []]) {
      await audience(unrestricted, unrestricted);
      assert((await compare()).length === 1, "Unrestricted publication disappeared");
      assert((await compare({ identity: foreignBuyer, cityId: cities[0].id })).length === 1, "Unrestricted authenticated/city comparison disappeared");
    }
    await audience([foreignBuyer.organizationId]);
    assert((await compare()).length === 0, "Public compare exposed excluded offer");
    assert((await compare({ spoofBuyer: foreignBuyer.organizationId })).length === 0, "Public query overrode trusted buyer context");
    assert((await compare({ variantId: source.productVariantId })).length === 0, "Variant selection bypassed audience");
    assert((await compare({ identity: publicBuyer })).length === 0, "Authenticated excluded buyer saw offer");
    assert((await compare({ identity: foreignBuyer })).length === 1, "Allowed buyer lost access");
    const denied = await request(`/marketplace/products/${productId}/compare?buyerOrganizationId=${foreignBuyer.organizationId}&quantity=1`, { identity: publicBuyer });
    assert(denied.status === 403, "Buyer could impersonate another organization");
    const anonymous = await request(`/marketplace/products/${productId}/compare?buyerOrganizationId=${foreignBuyer.organizationId}&quantity=1`);
    assert([401, 403].includes(anonymous.status), "Protected compare accepted anonymous request");
    await audience([publicBuyer.organizationId], [cities[0].id]);
    assert((await compare({ cityId: cities[0].id })).length === 1, "Allowed city lost access");
    assert((await compare({ cityId: cities[1].id })).length === 0, "City restriction bypassed");
    assert((await compare()).length === 1, "Omitted city changed existing catalogue semantics");
    for (const malformed of [publicBuyer.organizationId, { buyer: publicBuyer.organizationId }, [null]]) {
      await audience(malformed);
      assert((await compare()).length === 0, "Malformed buyer audience became unrestricted");
    }
    await audience([publicBuyer.organizationId]);
    await prisma.offerPublication.update({ where: { offerId: offer.offerId }, data: { marketplaceVisible: false } });
    assert((await compare()).length === 0, "Hidden publication became visible");
    console.log("Catalogue audience HTTP controls PASS: public/authenticated/buyer/city/null/variant/hidden");

    const productType = `admission-${runId}`;
    await prisma.product.update({ where: { id: productId }, data: { productType } });
    const rule = await prisma.complianceRule.create({ data: {
      code: productType, version: 1, name: "Synthetic alternative-credential rule", productType,
      riskLevel: "GREEN", decision: "ALLOWED", status: "ACTIVE", effectiveFrom: new Date(0),
      conditions: { requirements: { requiredCredentialAnyOf: [["WHOLESALE_LICENSE", "MEDICAL_DEVICE_SALE_NOTIFICATION"]] } }, requiredCredentialTypes: [],
    } });
    ruleId = rule.id;
    const { ComplianceService } = require("../../apps/api/dist/src/modules/compliance/compliance.service.js");
    const service = new ComplianceService(prisma, {});
    const context = { actorId: publicBuyer.userId, organizationId: supplierId };
    const checkout = () => service.assertOfferAllowed(publicBuyer.organizationId, offer.offerId, balance.warehouseId, offer.lotId, context);
    const publish = () => service.assertOfferPublishable(supplierId, offer.offerId, context);
    const reviewRequired = async operation => {
      let failure;
      try { await operation(); } catch (error) { failure = error; }
      assert(failure?.getStatus?.() === 409, "Missing alternative credential did not require review");
    };
    await audience([]);
    await reviewRequired(checkout);
    await reviewRequired(publish);
    assert((await prisma.offerPublication.findUniqueOrThrow({ where: { offerId: offer.offerId } })).status === "UNDER_REVIEW", "Publication ignored review result");
    for (const type of ["WHOLESALE_LICENSE", "MEDICAL_DEVICE_SALE_NOTIFICATION"]) {
      const credential = await prisma.organizationCredential.create({ data: { organizationId: supplierId, type, number: runId, status: "VERIFIED", validTo: new Date("2035-01-01") } });
      credentialId = credential.id;
      assert((await checkout()).status === "PASSED", "Verified alternative rejected at checkout");
      assert((await publish()).status === "PASSED", "Verified alternative rejected at publication");
      await prisma.organizationCredential.update({ where: { id: credentialId }, data: { status: "PENDING" } });
      await reviewRequired(checkout);
      await prisma.organizationCredential.update({ where: { id: credentialId }, data: { status: "VERIFIED", validTo: new Date(0) } });
      await reviewRequired(publish);
      await prisma.organizationCredential.delete({ where: { id: credentialId } });
      credentialId = undefined;
    }
    console.log("Compliance admission PostgreSQL controls PASS: both guards, both alternatives, pending/expired denial");
  } finally {
    if (credentialId) await prisma.organizationCredential.delete({ where: { id: credentialId } });
    if (ruleId) {
      const checks = await prisma.complianceCheck.findMany({ where: { matchedRuleId: ruleId }, select: { id: true } });
      const ids = checks.map(check => check.id);
      await prisma.outboxEvent.deleteMany({ where: { aggregateType: "ComplianceCheck", aggregateId: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { entityType: "ComplianceCheck", entityId: { in: ids } } });
      await prisma.complianceCheck.deleteMany({ where: { id: { in: ids } } });
      await prisma.complianceRule.delete({ where: { id: ruleId } });
    }
    await prisma.product.update({ where: { id: productId }, data: { productType: source.productVariant.product.productType } });
    await prisma.warehouse.update({ where: { id: warehouse.id }, data: { cityId: warehouse.cityId } });
    await prisma.offerPublication.update({ where: { offerId: offer.offerId }, data: {
      status: publication.status, marketplaceVisible: publication.marketplaceVisible, blockedReason: publication.blockedReason,
      allowedBuyerIds: nullValue(publication.allowedBuyerIds), allowedCityIds: nullValue(publication.allowedCityIds), updatedAt: publication.updatedAt,
    } });
  }
}
