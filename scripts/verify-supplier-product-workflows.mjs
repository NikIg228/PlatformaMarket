import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";

const prisma = new PrismaClient({ datasourceUrl: testDatabaseUrl() });
const require = createRequire(import.meta.url);
const { ImportsService } = require("../apps/api/dist/src/modules/imports/imports.service.js");
const { ImportFileParser } = require("../apps/api/dist/src/modules/imports/import-file.parser.js");
const { SupplierAccessService } = require("../apps/api/dist/src/modules/suppliers/supplier-access.service.js");
const { FileUploadPolicyService } = require("../apps/api/dist/src/platform/security/file-upload-policy.service.js");
const { SupplierAuxiliaryReadsService } = require("../apps/api/dist/src/modules/commerce/supplier-auxiliary-reads.service.js");
const { applyImportedInventory } = require("../apps/api/dist/src/modules/imports/import-inventory.js");
const rollback = new Error("ROLLBACK_PRODUCT_WORKFLOWS_FIXTURE"), runId = randomUUID();
let organizationId;
async function verifyConcurrentInventory() {
  const id = randomUUID();
  let supplier, product;
  try {
    supplier = await prisma.organization.create({ data: { legalName: `Stock race ${id}`, displayName: "Isolated stock race", bin: `${Date.now()}`.slice(-12), supplierProfile: { create: {} } } });
    product = await prisma.product.create({ data: { canonicalName: id, slug: id, productType: "MATERIAL" } });
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku: id } });
    const warehouse = await prisma.warehouse.create({ data: { supplierOrganizationId: supplier.id, code: id, name: id } });
    const offer = await prisma.supplierOffer.create({ data: { supplierOrganizationId: supplier.id, productVariantId: variant.id, supplierSku: id } });
    const balance = await prisma.inventoryBalance.create({ data: { supplierOrganizationId: supplier.id, warehouseId: warehouse.id, productVariantId: variant.id, offerId: offer.id, quantityOnHand: "4.125", quantityReserved: "1.125", safetyStock: "0.25", quantityAvailable: "2.75" } });
    await assert.rejects(prisma.$transaction(async tx => {
      await tx.offerPrice.create({ data: { offerId: offer.id, amountMinor: "12345", currency: "KZT" } });
      const guarded = new Proxy(tx, { get(target, key) {
        if (key !== "inventoryBalance") return Reflect.get(target, key);
        return new Proxy(tx.inventoryBalance, { get(model, method) {
          if (method !== "findUnique") return Reflect.get(model, method);
          return async args => {
            const snapshot = await model.findUnique(args);
            // A separate connection commits a reservation after import reads its version.
            await prisma.$transaction(other => other.inventoryBalance.update({ where: { id: balance.id }, data: { quantityReserved: "2.125", quantityAvailable: "1.75", version: { increment: 1 } } }));
            return snapshot;
          };
        } });
      } });
      await applyImportedInventory(guarded, { supplierOrganizationId: supplier.id, warehouseId: warehouse.id, productVariantId: variant.id, offerId: offer.id, quantity: "8" });
    }, { timeout: 15000 }), /изменились во время импорта/);
    const after = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: balance.id } });
    assert.equal(after.quantityOnHand.toString(), "4.125"); assert.equal(after.quantityReserved.toString(), "2.125");
    assert.equal(after.quantityAvailable.toString(), "1.75"); assert.equal(after.version, balance.version + 1);
    assert.equal(await prisma.offerPrice.count({ where: { offerId: offer.id } }), 0, "Concurrent conflict rolls back preceding price write");
  } finally {
    if (supplier) await prisma.organization.delete({ where: { id: supplier.id } });
    if (product) await prisma.product.delete({ where: { id: product.id } });
  }
}
try {
  await prisma.$transaction(async tx => {
    const own = await tx.organization.create({ data: { legalName: `Product workflow ${runId}`, displayName: "Product workflow test", bin: `${Date.now()}`.slice(-12), supplierProfile: { create: {} }, capabilities: { create: { capability: "SUPPLIER" } } } });
    organizationId = own.id;
    const context = { organizationId: own.id, actorId: randomUUID() };
    const warehouse = await tx.warehouse.create({ data: { supplierOrganizationId: own.id, name: "Workflow test", code: runId } });
    const source = await tx.supplierDataSource.create({ data: { supplierOrganizationId: own.id, name: "Workflow test CSV", type: "CSV" } });
    const product = await tx.product.create({ data: { canonicalName: `Workflow product ${runId}`, slug: runId, productType: "MATERIAL" } });
    const variant = await tx.productVariant.create({ data: { productId: product.id, sku: runId } });
    await tx.supplierMappingMemory.create({ data: { supplierOrganizationId: own.id, sourceId: source.id, externalKey: `SKU:${runId.replaceAll("-", " ")}`, productVariantId: variant.id, confidence: "1", reasons: ["test_fixture"] } });
    // One-row batches run serially. Savepoints preserve real row rollback semantics.
    let savepoint = 0;
    const database = new Proxy(tx, { get(target, key) { return key === "$transaction" ? async action => {
      const name = `workflow_${++savepoint}`;
      await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
      try { const result = await action(tx); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`); return result; }
      catch (error) { await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`); throw error; }
    } : Reflect.get(target, key); } });
    const blobs = new Map();
    const storage = { put: async (key, body) => blobs.set(key, body), delete: async key => blobs.delete(key) };
    const uploads = new FileUploadPolicyService(tx, storage, { scan: async () => ({ provider: "isolated-test" }) });
    const service = new ImportsService(database, new SupplierAccessService(tx), new ImportFileParser(), {}, uploads, {}, {});
    const preview = { fileName: "price.csv", fileType: "CSV", contentBase64: Buffer.from('Код,Название,Цена\nA,Материал,"1234,56"\n').toString("base64") };
    await assert.rejects(service.previewFile(own.id, preview, { ...context, organizationId: randomUUID() }), /another organization/);
    assert.equal(await tx.uploadAsset.count({ where: { organizationId: own.id } }), 0);
    const parsed = await service.previewFile(own.id, preview, context);
    assert.equal(parsed.rows[0].rawData.Цена, "1234,56");
    assert.equal(await tx.importBatch.count({ where: { supplierOrganizationId: own.id } }), 0);
    assert.equal(blobs.size, 0);
    assert.equal(await tx.uploadAsset.count({ where: { organizationId: own.id, status: "REJECTED", deletedAt: { not: null } } }), 1);
    await assert.rejects(service.previewFile(own.id, { ...preview, fileName: "price.xlsx", fileType: "EXCEL" }, context), /not allowed/);
    assert.equal(blobs.size, 0);
    const mapping = { externalId: "Код", name: "Название", supplierSku: "Артикул", priceMinor: "Цена", currency: "Валюта", quantityOnHand: "Остаток" };
    for (const [index, amount, priceUnit, expected] of [[0, "1234,56", "MAJOR", "123456"], [1, "9007199254740993.12", "MAJOR", "900719925474099312"], [2, "250001", undefined, "250001"], [3, "-2", "MAJOR", null]]) {
      const batch = await service.createBatch(own.id, { sourceId: source.id, fileName: `test-${index}.csv`, fileType: "CSV", columnMapping: { ...mapping, ...(priceUnit ? { priceUnit } : {}) }, rows: [{ Код: `ROW-${index}`, Название: product.canonicalName, Артикул: runId, Цена: amount, Валюта: "KZT", Остаток: "4.125" }] }, context);
      const beforePrices = await tx.offerPrice.count({ where: { offer: { supplierOrganizationId: own.id } } });
      const result = await service.processBatch(own.id, batch.id, context);
      const row = await tx.importRow.findFirstOrThrow({ where: { batchId: batch.id } });
      if (expected) {
        assert.equal(result.status, "COMPLETED"); assert.equal(result.errorRows, 0); assert.equal(row.normalizedData.priceMinor, expected);
        const price = await tx.offerPrice.findFirstOrThrow({ where: { offer: { supplierOrganizationId: own.id }, status: "ACTIVE" } });
        assert.equal(price.amountMinor.toString(), expected);
        const balance = await tx.inventoryBalance.findFirstOrThrow({ where: { supplierOrganizationId: own.id } });
        assert.equal(balance.quantityOnHand.toString(), "4.125"); assert.equal(balance.quantityAvailable.toString(), "4.125");
        const offer = await tx.supplierOffer.findUniqueOrThrow({ where: { id: price.offerId }, include: { publication: true } });
        assert.equal(offer.publication.marketplaceVisible, false);
        const reads = new SupplierAuxiliaryReadsService(tx), query = { q: "", limit: 25 };
        assert.equal((await reads.inventory(own.id, { ...query, offerId: offer.id, balanceId: balance.id, warehouseId: warehouse.id })).items.length, 1);
        assert.equal((await reads.inventory(own.id, { ...query, offerId: randomUUID() })).items.length, 0);
        await service.processBatch(own.id, batch.id, context);
        assert.equal(await tx.offerPrice.count({ where: { offer: { supplierOrganizationId: own.id } } }), beforePrices + 1);
      } else {
        assert.equal(result.status, "COMPLETED_WITH_ERRORS"); assert.equal(row.errorCode, "INVALID_PRICE_MINOR");
        assert.equal(await tx.offerPrice.count({ where: { offer: { supplierOrganizationId: own.id } } }), beforePrices);
      }
    }
    const originalBalance = await tx.inventoryBalance.findFirstOrThrow({ where: { supplierOrganizationId: own.id } });
    await tx.inventoryBalance.update({ where: { id: originalBalance.id }, data: { quantityReserved: "1.125", safetyStock: "0.25", quantityAvailable: "2.75", version: { increment: 1 } } });
    for (const [index, quantity, available] of [[0, "4.125", "2.75"], [1, "1.375", "0"], [2, "1", null]]) {
      const batch = await service.createBatch(own.id, { sourceId: source.id, fileName: `stock-${index}.csv`, fileType: "CSV", columnMapping: mapping, rows: [{ Код: `STOCK-${index}`, Название: product.canonicalName, Артикул: runId, Цена: "98765", Валюта: "KZT", Остаток: quantity }] }, context);
      const before = await tx.inventoryBalance.findUniqueOrThrow({ where: { id: originalBalance.id } });
      const prices = await tx.offerPrice.findMany({ where: { offerId: before.offerId }, orderBy: { id: "asc" } });
      const historyCount = await tx.offerPriceHistory.count({ where: { offerId: before.offerId } });
      const result = await service.processBatch(own.id, batch.id, context);
      const after = await tx.inventoryBalance.findUniqueOrThrow({ where: { id: before.id } });
      assert.equal(after.quantityReserved.toString(), "1.125"); assert.equal(after.safetyStock.toString(), "0.25");
      if (available !== null) {
        assert.equal(result.status, "COMPLETED"); assert.equal(after.quantityAvailable.toString(), available);
        assert.equal(after.quantityOnHand.toString(), quantity); assert.equal(after.version, before.version + 1);
        if (available === "0") assert.equal(after.availabilityStatus, "OUT_OF_STOCK");
      } else {
        assert.equal(result.status, "COMPLETED_WITH_ERRORS"); assert.deepEqual(after, before);
        assert.deepEqual(await tx.offerPrice.findMany({ where: { offerId: before.offerId }, orderBy: { id: "asc" } }), prices);
        assert.equal(await tx.offerPriceHistory.count({ where: { offerId: before.offerId } }), historyCount);
        assert.equal(await tx.supplierExternalItem.count({ where: { sourceId: source.id, externalId: `STOCK-${index}` } }), 0);
      }
      await service.processBatch(own.id, batch.id, context);
      assert.deepEqual(await tx.inventoryBalance.findUniqueOrThrow({ where: { id: before.id } }), after);
    }
    throw rollback;
  }, { timeout: 30000 });
} catch (cause) {
  if (cause !== rollback) throw cause;
  await verifyConcurrentInventory();
} finally {
  if (organizationId) assert.equal(await prisma.organization.count({ where: { id: organizationId } }), 0, "Fixture must roll back");
  await prisma.$disconnect();
}
console.log("PASS: isolated PostgreSQL preview authorization/file policy/cleanup; exact major and legacy minor prices, invalid rejection, replay, draft publication, contextual inventory; reserved/safety stock preserved, zero availability, insufficient stock rolls back prices/history/external item; two-connection reservation conflict rolls back import write; fixtures cleaned.");
