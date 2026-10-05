import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";

// Resolve the isolated profile before constructing a client; never use the dev URL.
const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl() });
const require = createRequire(import.meta.url);
const { WorkspaceReadsService } = require("../apps/api/dist/src/modules/commerce/workspace-reads.service.js");
const { SupplierAuxiliaryReadsService } = require("../apps/api/dist/src/modules/commerce/supplier-auxiliary-reads.service.js");
const { PromotionsService } = require("../apps/api/dist/src/modules/promotions/promotions.service.js");
const rollback = new Error("ROLLBACK_PRODUCT_READ_FIXTURE");
const runId = randomUUID();
const ids = rows => rows.items.map(row => row.id).sort();
try {
  await prisma.$transaction(async tx => {
    const organizations = [];
    for (let index = 0; index < 2; index++) organizations.push(await tx.organization.create({ data: {
      legalName: `Read verification ${runId}`, displayName: "Read verification",
      bin: `${Date.now().toString().slice(-10)}${index}9`,
      supplierProfile: { create: {} }, capabilities: { create: { capability: "SUPPLIER" } },
    } }));
    const [own, foreign] = organizations;
    const warehouse = await tx.warehouse.create({ data: { supplierOrganizationId: own.id, name: "First", code: runId } });
    const otherWarehouse = await tx.warehouse.create({ data: { supplierOrganizationId: foreign.id, name: "Other", code: runId } });
    const product = await tx.product.create({ data: { canonicalName: `Product ${runId}`, slug: runId, productType: "MATERIAL" } });
    const offers = [];
    for (let index = 0; index < 4; index++) {
      const supplierId = index === 3 ? foreign.id : own.id;
      const variant = await tx.productVariant.create({ data: { productId: product.id } });
      offers.push(await tx.supplierOffer.create({ data: {
        supplierOrganizationId: supplierId, productVariantId: variant.id, supplierSku: `SKU-${index}`, status: "ACTIVE",
        publication: { create: { marketplaceVisible: index !== 1 } },
        prices: index === 1 ? undefined : { create: { amountMinor: "100000", currency: "KZT", freshnessExpiresAt: new Date(Date.now() + (index === 2 ? -86400000 : 86400000)) } },
        inventoryBalances: { create: { supplierOrganizationId: supplierId, productVariantId: variant.id,
          warehouseId: index === 3 ? otherWarehouse.id : warehouse.id, quantityAvailable: "12.25", freshnessStatus: "FRESH" } },
      } }));
    }
    const reads = new WorkspaceReadsService(tx), auxiliary = new SupplierAuxiliaryReadsService(tx);
    const query = { q: "", limit: 50 };
    assert.deepEqual(ids(await reads.offers(own.id, { ...query, publication: "published" })), [offers[0].id, offers[2].id].sort());
    assert.deepEqual(ids(await reads.offers(own.id, { ...query, publication: "hidden" })), [offers[1].id]);
    assert.deepEqual(ids(await reads.offers(own.id, { ...query, attention: "required" })), [offers[1].id, offers[2].id].sort());
    const first = await reads.offers(own.id, { ...query, attention: "required", limit: 1 });
    const next = await reads.offers(own.id, { ...query, attention: "required", limit: 1, cursor: first.nextCursor });
    assert.deepEqual([...ids(first), ...ids(next)].sort(), [offers[1].id, offers[2].id].sort());
    await assert.rejects(reads.offers(foreign.id, { ...query, attention: "required", limit: 1, cursor: first.nextCursor }), /Cursor/);
    assert.equal((await auxiliary.inventory(own.id, { ...query, warehouseId: warehouse.id })).items.length, 3);
    assert.equal((await auxiliary.inventory(own.id, { ...query, warehouseId: otherWarehouse.id })).items.length, 0);
    const foreignBalance = await tx.inventoryBalance.findFirstOrThrow({ where: { offerId: offers[3].id } });
    await assert.rejects(auxiliary.reservations(own.id, foreignBalance.id, query), /not found/);
    const promotionIds = [];
    for (const [index, phase] of ["ACTIVE", "SCHEDULED", "EXPIRED", "EXHAUSTED", "FOREIGN"].entries()) {
      const item = await tx.promotion.create({ data: {
        supplierOrganizationId: phase === "FOREIGN" ? foreign.id : own.id, offerId: offers[phase === "FOREIGN" ? 3 : 0].id,
        name: `Promotion ${index}`, kind: "FIXED_AMOUNT", fixedAmountMinor: "10000", baseAmountMinor: "100000", currency: "KZT",
        scope: {}, minimumQuantity: "1", quantityLimit: "10", claimedQuantity: phase === "EXHAUSTED" ? "10" : "0",
        status: "ACTIVE", moderationStatus: "APPROVED", approvedRevision: 1,
        startsAt: new Date(Date.now() + (phase === "SCHEDULED" ? 86400000 : -86400000)),
        endsAt: new Date(Date.now() + (phase === "EXPIRED" ? -1000 : 172800000)),
        oldPriceEvidence: { capturedAt: new Date().toISOString(), baseAmountMinor: "100000", currency: "KZT", minimum30DaysMinor: "100000", historyDays: 0, raisedRecently: false, observations: [] },
      } });
      promotionIds.push(item.id);
    }
    const promotions = new PromotionsService(tx, {}, {}), context = { organizationId: own.id };
    const listQuery = { offset: 0, limit: 25 };
    assert.deepEqual(ids(await promotions.list({ ...listQuery, phase: "ACTIVE" }, context)), [promotionIds[0]]);
    assert.deepEqual(ids(await promotions.list({ ...listQuery, phase: "SCHEDULED" }, context)), [promotionIds[1]]);
    assert.deepEqual(ids(await promotions.list({ ...listQuery, phase: "ENDED" }, context)), promotionIds.slice(2, 4).sort());
    assert.equal((await promotions.list({ offset: 1, limit: 1, phase: "ENDED" }, context)).total, 2);
    await assert.rejects(promotions.list({ ...listQuery, supplierOrganizationId: foreign.id }, context), /не найдены/);
    throw rollback;
  }, { timeout: 20000 });
} catch (cause) {
  if (cause !== rollback) throw cause;
} finally {
  await prisma.$disconnect();
}
console.log("PASS: PostgreSQL offer filters/paging, warehouse isolation, foreign reservation denial and promotion phases; fixture rolled back.");
