import { readFile } from "node:fs/promises";
import { Prisma } from "@prisma/client";

export async function verifyStorefrontUpgrade(prisma, assert) {
  const schema = `storefront_upgrade_${process.pid}`;
  const migration = await readFile(new URL("../../apps/api/prisma/migrations/20261030010000_supplier_storefront/migration.sql", import.meta.url), "utf8");
  const rollback = new Error("ROLLBACK_STOREFRONT_UPGRADE");
  try { await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe('CREATE TABLE "SupplierProfile" ("organizationId" UUID PRIMARY KEY, "regulatoryDetails" JSONB)');
    await tx.$executeRawUnsafe(`INSERT INTO "SupplierProfile" VALUES ('10000000-0000-4000-8000-000000000001', '{"preserved":true}')`);
    await tx.$executeRawUnsafe(migration);
    const [row] = await tx.$queryRawUnsafe('SELECT * FROM "SupplierProfile"');
    assert(row.regulatoryDetails.preserved && row.storefrontVersion === 0 && row.storefrontContent === null && row.storefrontLogoAssetId === null, "Storefront migration altered existing supplier data");
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; }
  console.log("Storefront additive upgrade preserves supplier data; defaults and rollback PASS");
}

export async function verifySupplierStorefront({ prisma, fixture, request, runId, assert }) {
  const supplierId = fixture.supplierId;
  const route = `/suppliers/${supplierId}/storefront`, publicRoute = `/catalog/suppliers/${supplierId}`;
  const users = await Promise.all(["editor", "reader"].map(label => prisma.user.create({ data: { email: `${runId}-storefront-${label}@example.invalid`, displayName: `Storefront ${label}`, emailVerifiedAt: new Date() } })));
  fixture.userIds.push(...users.map(user => user.id));
  for (let index = 0; index < users.length; index++) {
    const role = await prisma.role.create({ data: { organizationId: supplierId, code: `${runId}-storefront-${index}`, name: "Storefront fixture",
      permissions: { create: (index === 0 ? ["organization.view", "supplier.profile.manage"] : ["organization.view"]).map(code => ({ permission: { connect: { code } } })) } } });
    await prisma.organizationMembership.create({ data: { organizationId: supplierId, userId: users[index].id, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
  }
  const identity = { userId: users[0].id, organizationId: supplierId }, reader = { userId: users[1].id, organizationId: supplierId };
  // Prove the fixture's grants before exercising HTTP guards; do not bypass them.
  for (const [actor, canManage] of [[identity, true], [reader, false]]) {
    const membership = await prisma.organizationMembership.findFirst({ where: {
      userId: actor.userId, organizationId: supplierId, status: "ACTIVE",
      user: { status: "ACTIVE" }, organization: { status: "ACTIVE" },
      roles: { some: { role: { organizationId: supplierId, permissions: { some: { permission: { code: "supplier.profile.manage" } } } } } },
    }, select: { id: true } });
    assert(Boolean(membership) === canManage, `Storefront fixture has incorrect editor grants: expected ${canManage}`);
  }
  const content = { ru: { description: "Тестовый поставщик", location: "Алматы", hours: "Пн–Пт 09:00–18:00", delivery: "Самовывоз и доставка" }, kk: { description: "Сынақ жеткізушісі", location: "Алматы", hours: "", delivery: "" } };
  const check = async (url, options, expected) => { const result = await request(url, options); assert(result.status === expected, `Storefront ${url}: ${result.status}, expected ${expected}: ${JSON.stringify(result.body)}`); return result.body; };
  const original = await prisma.supplierProfile.findUniqueOrThrow({ where: { organizationId: supplierId } });
  const originalProduct = await prisma.product.findUniqueOrThrow({ where: { id: fixture.productId } });
  const offerIds = fixture.offerIds.slice(0, 9);
  const balances = await prisma.inventoryBalance.findMany({ where: { offerId: { in: fixture.offerIds } } });
  const prices = await prisma.offerPrice.findMany({ where: { offerId: { in: offerIds } } });
  const offers = await prisma.supplierOffer.findMany({ where: { id: { in: offerIds } } });
  const lots = await prisma.inventoryLot.findMany({ where: { offerId: { in: offerIds } } });
  const warehouseId = balances[0].warehouseId;
  const originalWarehouse = await prisma.warehouse.findUniqueOrThrow({ where: { id: warehouseId } });
  const trigger = `storefront_fail_${process.pid}`;
  try {
    await check("/catalog/suppliers/not-a-uuid", {}, 400);
    await check(route, {}, 401);
    await check(route, { identity: { ...identity, organizationId: fixture.buyerIds[0] } }, 403);
    await check(route, { method: "POST", identity: reader, body: { expectedVersion: 0, content } }, 403);
    await check(route, { method: "POST", identity, body: { expectedVersion: 0, content, additionalContacts: [] } }, 400);
    const saved = await check(route, { method: "POST", identity, body: { expectedVersion: 0, content } }, 201);
    assert(saved.version === 1 && saved.published, "Storefront settings save failed");
    const page = await check(publicRoute, {}, 200);
    assert(page.content.ru.description === content.ru.description && !JSON.stringify(page).includes("testFixture"), "Public page leaked private profile or lost description");
    await check(route, { method: "POST", identity, body: { expectedVersion: 0, content } }, 409);
    const race = await Promise.all(["A", "B"].map(label => request(route, { method: "POST", identity, body: { expectedVersion: 1, content: { ...content, ru: { ...content.ru, description: label } } } })));
    assert(race.map(value => value.status).sort().join(",") === "201,409", "Storefront CAS must have one winner");
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'supplier.storefront.updated' AND NEW."entityId" = '${supplierId}' THEN RAISE EXCEPTION 'synthetic storefront audit failure'; END IF; RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
    await check(route, { method: "POST", identity, body: { expectedVersion: 2, content } }, 500);
    assert((await prisma.supplierProfile.findUniqueOrThrow({ where: { organizationId: supplierId } })).storefrontVersion === 2, "Audit failure did not roll back storefront version");
    await prisma.$executeRawUnsafe(`DROP TRIGGER "${trigger}" ON "AuditLog"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION "${trigger}"()`);
    assert(await prisma.outboxEvent.count({ where: { aggregateId: supplierId, eventType: "SupplierStorefrontUpdated" } }) === 2, "Failed/replayed writes emitted extra events");

    const image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6XcAAAAASUVORK5CYII=";
    await check(`${route}/logo`, { method: "POST", identity, body: { expectedVersion: 2, fileName: "logo.svg", contentBase64: Buffer.from("<svg></svg>").toString("base64") } }, 400);
    const uploaded = await check(`${route}/logo`, { method: "POST", identity, body: { expectedVersion: 2, fileName: "logo.png", contentBase64: image } }, 201);
    assert(uploaded.version === 3 && uploaded.logoUrl, "Clean logo not linked");
    await check(`${publicRoute}/logo`, {}, 200);
    await prisma.organization.update({ where: { id: supplierId }, data: { status: "INACTIVE" } });
    await check(publicRoute, {}, 404); await check(`${publicRoute}/logo`, {}, 404);
    await prisma.organization.update({ where: { id: supplierId }, data: { status: "ACTIVE" } });
    await prisma.marketplaceAgreement.update({ where: { id: fixture.agreementId }, data: { status: "TERMINATED" } });
    await check(publicRoute, {}, 404); await check(`${publicRoute}/search`, {}, 404);
    await prisma.marketplaceAgreement.update({ where: { id: fixture.agreementId }, data: { status: "ACTIVE" } });

    const city = await prisma.city.findFirstOrThrow();
    await prisma.warehouse.update({ where: { id: warehouseId }, data: { cityId: city.id } });
    await prisma.product.update({ where: { id: fixture.productId }, data: { externalMetadata: { importedAsCanonicalDraft: true } } });
    // The same product has multiple offers: only the currently buyable ones may survive.
    await prisma.supplierOffer.update({ where: { id: offerIds[1] }, data: { status: "DRAFT" } });
    await prisma.offerPublication.update({ where: { offerId: offerIds[2] }, data: { marketplaceVisible: false } });
    await prisma.inventoryBalance.updateMany({ where: { offerId: offerIds[3] }, data: { quantityAvailable: 0 } });
    await prisma.inventoryBalance.updateMany({ where: { offerId: offerIds[4] }, data: { freshnessExpiresAt: new Date(0) } });
    await prisma.offerPrice.updateMany({ where: { offerId: offerIds[5] }, data: { freshnessExpiresAt: new Date(0) } });
    await prisma.offerPublication.update({ where: { offerId: offerIds[6] }, data: { allowedBuyerIds: [fixture.buyerIds[0]], status: "RESTRICTED" } });
    await prisma.inventoryLot.updateMany({ where: { offerId: offerIds[7] }, data: { expirationDate: new Date(0) } });
    await prisma.supplierOffer.update({ where: { id: offerIds[8] }, data: { minimumOrderQuantity: 100, orderIncrement: 10 } });
    const { SearchProjectionService } = await import("../../apps/api/dist/src/modules/search/search-projection.service.js");
    await new SearchProjectionService(prisma, {}).rebuildProduct(fixture.productId);
    const result = await check(`${publicRoute}/search?includeFilterOptions=true&inStock=false&supplierOrganizationId=${fixture.buyerIds[0]}&buyerOrganizationId=${supplierId}`, {}, 200);
    const item = result.items.find(item => item.id === fixture.productId);
    if (!item?.offers.some(offer => offer.id === offerIds[0])) {
      const { catalogSaleJoin } = await import("../../apps/api/dist/src/modules/search/catalog-sale-query.js");
      const diagnostic = await prisma.$queryRaw(Prisma.sql`SELECT p.id, p.status, p."externalMetadata", d."supplierIds", sale.*
        FROM "Product" p JOIN "ProductSearchDocument" d ON d."productId" = p.id
        ${catalogSaleJoin({ buyerOrganizationId: fixture.buyerIds[0], supplierOrganizationId: supplierId }, [supplierId], true)}
        WHERE p.id = ${fixture.productId}::uuid`);
      const { storefrontAvailabilitySql } = await import("../../apps/api/dist/src/modules/search/storefront-availability.js");
      const stock = await prisma.$queryRaw(Prisma.sql`SELECT NOW() AS now, o.status, o."minimumOrderQuantity", o."orderIncrement", ${storefrontAvailabilitySql()} AS available,
        pub.status AS publication, pub."allowedBuyerIds", pr."amountMinor", pr."validFrom", pr."freshnessExpiresAt", ib."freshnessExpiresAt" AS stockExpiry, ib."quantityAvailable", w.status AS warehouseStatus
        FROM "SupplierOffer" o JOIN "OfferPublication" pub ON pub."offerId" = o.id JOIN "OfferPrice" pr ON pr."offerId" = o.id
        JOIN "InventoryBalance" ib ON ib."offerId" = o.id JOIN "Warehouse" w ON w.id = ib."warehouseId" WHERE o.id = ${offerIds[0]}::uuid`);
      const balanceDiagnostic = await prisma.inventoryBalance.findMany({ where: { offerId: offerIds[0] }, include: { lots: true } });
      console.log("Storefront fixture search diagnostic", JSON.stringify({ result, diagnostic, stock, balanceDiagnostic }, (_key, value) => typeof value === "bigint" ? value.toString() : value));
    }
    assert(item && item.offers.some(offer => offer.id === offerIds[0]), "Available storefront offer missing");
    assert(!item.offers.some(offer => offerIds.slice(1).includes(offer.id)), "Unavailable, stale, private or below-minimum offer leaked");
    assert(result.items.every(product => product.offers.every(offer => offer.supplier.id === supplierId && offer.available)), "Foreign supplier or unavailable offer leaked");
    assert(result.filterOptions.suppliers.every(supplier => supplier.id === supplierId), "Storefront filter options escaped supplier");
    await prisma.inventoryBalance.updateMany({ where: { offerId: { in: fixture.offerIds } }, data: { quantityAvailable: 0 } });
    const empty = await check(`${publicRoute}/search`, {}, 200);
    assert(empty.total === 0 && empty.items.length === 0, "Unavailable product remains in storefront count/page");
    console.log("Storefront HTTP/PostgreSQL: public projection, roles/tenant, CAS/replay/rollback, logo validation/admission, fixed supplier, fresh buyable stock and empty counts PASS");
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "AuditLog"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
    await prisma.organization.update({ where: { id: supplierId }, data: { status: "ACTIVE" } });
    await prisma.marketplaceAgreement.update({ where: { id: fixture.agreementId }, data: { status: "ACTIVE" } });
    await prisma.supplierProfile.update({ where: { organizationId: supplierId }, data: { storefrontVersion: original.storefrontVersion, storefrontContent: original.storefrontContent ?? Prisma.DbNull, storefrontLogoAssetId: original.storefrontLogoAssetId } });
    await prisma.product.update({ where: { id: fixture.productId }, data: { externalMetadata: originalProduct.externalMetadata ?? Prisma.DbNull } });
    await prisma.warehouse.update({ where: { id: warehouseId }, data: { cityId: originalWarehouse.cityId } });
    for (const offer of offers) await prisma.supplierOffer.update({ where: { id: offer.id }, data: { status: offer.status, minimumOrderQuantity: offer.minimumOrderQuantity, orderIncrement: offer.orderIncrement } });
    await prisma.offerPublication.updateMany({ where: { offerId: { in: offerIds } }, data: { marketplaceVisible: true, status: "PUBLISHED", allowedBuyerIds: Prisma.DbNull } });
    for (const balance of balances) await prisma.inventoryBalance.update({ where: { id: balance.id }, data: { quantityAvailable: balance.quantityAvailable, freshnessExpiresAt: balance.freshnessExpiresAt } });
    for (const price of prices) await prisma.offerPrice.update({ where: { id: price.id }, data: { freshnessExpiresAt: price.freshnessExpiresAt } });
    for (const lot of lots) await prisma.inventoryLot.update({ where: { id: lot.id }, data: { expirationDate: lot.expirationDate } });
    await prisma.uploadAsset.deleteMany({ where: { organizationId: supplierId, purpose: "supplier-storefront-logo" } });
    await prisma.securityEvent.deleteMany({ where: { organizationId: supplierId, type: "upload.policy.rejected" } });
  }
}
