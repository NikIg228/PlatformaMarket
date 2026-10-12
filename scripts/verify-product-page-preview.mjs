import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";
import { databaseLabel } from "./lib/local-database-profile.mjs";
import { applyPreview, previewProducts, previewUuid } from "./lib/product-page-preview-seed.mjs";

const url = testDatabaseUrl();
const prisma = new PrismaClient({ datasourceUrl: url });
const rollback = new Error("INTENTIONAL_PREVIEW_VERIFICATION_ROLLBACK");
const ids = previewProducts.map(p => p.id);
try {
  console.log(`Isolated verification: ${databaseLabel(url)}`);
  assert.equal(await prisma.product.count({ where: { id: { in: ids } } }), 0, "Verification requires unused fixture identities in the test database");
  try {
    await prisma.$transaction(async tx => {
      const unit = await tx.unitOfMeasure.findUniqueOrThrow({ where: { code: "piece" } });
      const city = await tx.city.findFirstOrThrow();
      for (const p of previewProducts) {
        await tx.product.create({ data: { id: p.id, slug: `preview-verification-${p.id}`, canonicalName: p.sourceName, productType: "TEST", status: "ACTIVE", externalMetadata: { sourceId: p.sourceId } } });
        for (const v of p.variants.filter(v => v.existing)) await tx.productVariant.create({ data: { id: v.id, productId: p.id, sku: v.sku, status: "ACTIVE", saleUnitId: unit.id } });
      }
      const source = previewProducts[0];
      for (let i = 1; i <= 6; i++) {
        const organizationId = previewUuid(`verify-supplier-${i}`), warehouseId = previewUuid(`verify-warehouse-${i}`);
        await tx.organization.create({ data: { id: organizationId, legalName: `Synthetic supplier ${i}`, displayName: `Supplier ${i}`, bin: `99101200000${i}`, commerceDataset: "TEST" } });
        await tx.supplierProfile.create({ data: { organizationId } });
        await tx.warehouse.create({ data: { id: warehouseId, supplierOrganizationId: organizationId, code: "preview-test", name: "Synthetic warehouse", cityId: city.id } });
        const offer = await tx.supplierOffer.create({ data: { supplierOrganizationId: organizationId, productVariantId: source.variants[0].id, saleUnitId: unit.id, externalId: `pilot-demo:${source.sourceId}:${i}`, status: "ACTIVE" } });
        await tx.offerPrice.create({ data: { offerId: offer.id, amountMinor: "100", currency: "KZT", status: "ACTIVE", freshnessExpiresAt: new Date("2026-01-01") } });
        await tx.inventoryBalance.create({ data: { supplierOrganizationId: organizationId, warehouseId, productVariantId: source.variants[0].id, offerId: offer.id } });
      }
      const unrelated = await tx.product.create({ data: { canonicalName: "Unrelated sentinel", slug: "preview-verification-sentinel", productType: "TEST" } });
      const now = new Date("2026-10-12T18:00:00Z");
      assert.deepEqual(await applyPreview(tx, now), { products: 5, variants: 16, offers: 96, expiresAt: new Date("2027-01-10T18:00:00Z") });
      const counts = async () => Promise.all([tx.supplierOffer.count({ where: { productVariant: { productId: { in: ids } } } }), tx.offerPrice.count({ where: { offer: { productVariant: { productId: { in: ids } } } } }), tx.productPackaging.count({ where: { productVariant: { productId: { in: ids } } } })]);
      assert.deepEqual(await counts(), [96, 96, 32]);
      await applyPreview(tx, now);
      assert.deepEqual(await counts(), [96, 96, 32], "Repeat must not duplicate offers/prices/packages");
      assert.deepEqual(await tx.product.findUniqueOrThrow({ where: { id: unrelated.id } }), unrelated, "Other products must be untouched");
      const balance = await tx.inventoryBalance.findFirstOrThrow({ where: { productVariantId: source.variants[0].id } });
      await tx.inventoryBalance.update({ where: { id: balance.id }, data: { quantityReserved: "1" } });
      await assert.rejects(applyPreview(tx, now), /reservations/);
      assert.equal((await tx.inventoryBalance.findUniqueOrThrow({ where: { id: balance.id } })).quantityReserved.toString(), "1");
      await tx.inventoryBalance.update({ where: { id: balance.id }, data: { quantityReserved: "0" } });
      await tx.product.update({ where: { id: source.id }, data: { canonicalName: "Foreign identity" } });
      await assert.rejects(applyPreview(tx, now), /identity mismatch/);
      console.log("PASS: 96 offers, 16 variants, 32 packages; idempotence, scope, reserved-stock denial, identity denial");
      throw rollback;
    }, { timeout: 120000, isolationLevel: "Serializable" });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal(await prisma.product.count({ where: { id: { in: ids } } }), 0);
  assert.equal(await prisma.organization.count({ where: { bin: { startsWith: "99101200000" } } }), 0);
  console.log("PASS: entire verification transaction rolled back; no test fixtures retained");
} finally { await prisma.$disconnect(); }
