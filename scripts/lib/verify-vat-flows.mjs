import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { normalizeCatalogText } = require("../../apps/api/dist/src/modules/imports/matching.js");

// Runs only against the parent's disposable fixtures and already started test API.
export async function verifyVatFlows({ prisma, request, assert, supplierId, identity, tax, offers, createBuyer, createCartWithItem, runId }) {
  const call = async (path, body, expected = 201, who = identity, method = "POST") => {
    const result = await request(path, { identity: who, method, body });
    assert(result.status === expected, `VAT flow ${method} ${path}: expected ${expected}, got ${result.status} ${JSON.stringify(result.body)}`);
    return result.body;
  };
  const root = `/suppliers/${supplierId}`, ids = offers.map(offer => offer.offerId);
  const classify = async selection => {
    const input = { offerIds: ids, tax: { ...tax, selection } };
    const preview = await call(root + "/vat/offers/preview", input);
    await call(root + "/vat/offers/apply", { ...input, previewHash: preview.previewHash, idempotencyKey: randomUUID() });
  };
  await classify(tax.selection);
  const buyer = await createBuyer(33);
  const price = await prisma.offerPrice.findFirstOrThrow({ where: { offerId: ids[0], status: "ACTIVE" } });
  await prisma.offerPrice.update({ where: { id: price.id }, data: { amountMinor: "100001" } });
  const tier = await prisma.offerPriceTier.create({ data: { offerId: ids[0], minimumQuantity: 2, unitPriceMinor: "99999", currency: "KZT", validFrom: new Date(Date.now() - 60000) } });
  const cart = await createCartWithItem(buyer, ids[0], 2);
  const check = await call(`/carts/${cart.id}/validate`, {}, 200, buyer);
  const line = check.items[0].current;
  // 199998 × 16 / 116 = 27585.931... => 27586; base is the exact remainder.
  assert(line.totalPriceMinor === "199998" && line.tax.grossMinor === "199998" && line.tax.vatMinor === "27586" && line.tax.baseMinor === "172412", "VAT must be extracted from final discounted line total, then rounded once");
  await classify({ mode: "EXEMPT", rate: null, basis: "Synthetic exempt basis" });
  const changed = await call(`/carts/${cart.id}/validate`, {}, 200, buyer);
  assert(changed.requiresAcceptance && changed.items[0].changes.includes("OFFER_RULES") && changed.items[0].current.totalPriceMinor === line.totalPriceMinor,
    "Tax-only changes must require buyer acceptance despite identical gross");
  const blocked = await call(`/carts/${cart.id}/checkout`, { idempotencyKey: randomUUID() }, 409, buyer);
  assert(blocked.code === "CART_REVALIDATION_REQUIRED" && await prisma.checkout.count({ where: { cartId: cart.id } }) === 0, "Unaccepted VAT change created a partial checkout");
  await call(`/carts/${cart.id}/reprice`, { expectedVersion: changed.cartVersion, acceptedItems: changed.items.map(item => ({ cartItemId: item.cartItemId, snapshot: item.current })) }, 201, buyer);
  const checkoutKey = randomUUID(), checkout = await call(`/carts/${cart.id}/checkout`, { idempotencyKey: checkoutKey }, 201, buyer);
  assert(checkout.status === "COMPLETED", "Accepted VAT checkout did not complete");
  const order = await prisma.supplierOrder.findFirstOrThrow({ where: { checkoutId: checkout.id }, include: { items: true } });
  const immutable = order.items[0].offerSnapshot.pricing.tax;
  assert(immutable.declaration.selection.mode === "EXEMPT" && immutable.vatMinor === "0" && immutable.baseMinor === "199998", "Order lost the accepted tax declaration");
  await classify(tax.selection);
  const replay = await call(`/carts/${cart.id}/checkout`, { idempotencyKey: checkoutKey }, 201, buyer);
  const persisted = await prisma.supplierOrderItem.findUniqueOrThrow({ where: { id: order.items[0].id } });
  assert(replay.id === checkout.id && JSON.stringify(persisted.offerSnapshot.pricing.tax) === JSON.stringify(immutable), "Later tax settings rewrote immutable order or replay");
  await prisma.offerPriceTier.delete({ where: { id: tier.id } });

  const source = await prisma.supplierDataSource.create({ data: { supplierOrganizationId: supplierId, name: `VAT ${runId}`, type: "CSV", status: "ACTIVE" } });
  let connection;
  try {
    const offer = await prisma.supplierOffer.findUniqueOrThrow({ where: { id: ids[1] }, include: { productVariant: { include: { product: true } } } });
    // The parent deliberately creates many variants with the same product name;
    // provide an explicit confirmed mapping instead of relying on fuzzy ties.
    await prisma.supplierMappingMemory.create({ data: { supplierOrganizationId: supplierId, sourceId: source.id, externalKey: `SKU:${normalizeCatalogText(offer.productVariant.sku)}`,
      productVariantId: offer.productVariantId, version: 1, confidence: 1, reasons: ["synthetic_confirmed_mapping"] } });
    const columnMapping = { externalId: "id", name: "name", supplierSku: "sku", priceMinor: "price", currency: "currency", priceUnit: "MINOR", priceIncludesVat: false,
      vatMode: "mode", vatRate: "rate", vatBasis: "basis", expectedRequisitesVersion: tax.expectedRequisitesVersion, taxAcknowledged: true };
    const raw = { id: `${runId}-tax-row`, sku: offer.productVariant.sku, name: offer.productVariant.product.canonicalName, price: "10000", currency: "KZT", mode: "TAXABLE", rate: "16", basis: "" };
    const rows = [{ rowNumber: 2, rawData: raw }];
    const preview = await call(root + "/import-tax-preview", { columnMapping, rows });
    assert(preview.counts.individual === 1 && preview.items[0].amountMinor === "11600" && preview.items[0].offerId === offer.id, `Server preview failed to match/normalize net price: ${JSON.stringify(preview)}`);
    const create = { sourceId: source.id, fileName: "vat.csv", fileType: "CSV", columnMapping, rows: [raw], taxPreviewHash: preview.previewHash };
    await prisma.supplierOffer.update({ where: { id: offer.id }, data: { version: { increment: 1 } } });
    await call(root + "/import-batches", create, 409);
    assert(await prisma.importBatch.count({ where: { sourceId: source.id } }) === 0, "Stale import preview created a batch");
    const refreshed = await call(root + "/import-tax-preview", { columnMapping, rows });
    const batch = await call(root + "/import-batches", { ...create, taxPreviewHash: refreshed.previewHash });
    await call(`${root}/import-batches/${batch.id}/process`, {});
    const result = await call(`${root}/import-batches/${batch.id}`, undefined, 200, identity, "GET");
    assert(result.errorRows === 0 && result.processedRows === 1, `Tax import processing failed: ${JSON.stringify(result)}`);
    const imported = await prisma.offerPrice.findFirstOrThrow({ where: { offerId: offer.id, status: "ACTIVE" } });
    assert(imported.amountMinor.toString() === "11600" && imported.taxSnapshot.selection.rate === "16" && imported.taxSnapshot.declaredById === identity.userId, "Import did not persist supplier declaration and gross exactly once");
    const blank = { ...raw, price: "20000", mode: "", rate: "" }, blankMapping = { ...columnMapping, priceIncludesVat: true };
    const preserved = await call(root + "/import-tax-preview", { columnMapping: blankMapping, rows: [{ rowNumber: 2, rawData: blank }] });
    assert(preserved.counts.unchanged === 1 && preserved.items[0].selection.rate === "16", "Blank import fields lost an existing declaration");
    const stale = await call(root + "/import-batches", { ...create, columnMapping: blankMapping, rows: [blank], taxPreviewHash: preserved.previewHash });
    await prisma.supplierOffer.update({ where: { id: offer.id }, data: { version: { increment: 1 } } });
    const beforeHistory = await prisma.offerPriceHistory.count({ where: { offerId: offer.id } });
    await call(`${root}/import-batches/${stale.id}/process`, {});
    const staleResult = await call(`${root}/import-batches/${stale.id}`, undefined, 200, identity, "GET");
    assert(staleResult.errorRows === 1 && await prisma.offerPrice.count({ where: { id: imported.id, status: "ACTIVE" } }) === 1 && await prisma.offerPriceHistory.count({ where: { offerId: offer.id } }) === beforeHistory, "Stale processing leaked price/history instead of rolling back the row");

    connection = await prisma.integrationConnection.create({ data: { supplierOrganizationId: supplierId, sourceId: source.id, provider: "ONE_C", mode: "AGENT", status: "ACTIVE", displayName: "VAT ERP fixture" } });
    const binding = await prisma.integrationDataBinding.create({ data: { connectionId: connection.id, dataType: "PRICE", offerId: offer.id, priority: 17, configuration: { existing: "preserved" } } });
    const endpoint = `${root}/integrations/${connection.id}/bindings/${binding.id}/tax`;
    const command = { expectedUpdatedAt: binding.updatedAt.toISOString(), idempotencyKey: randomUUID(), priceTax: { priceIncludesVat: false, defaultVat: tax.selection, expectedRequisitesVersion: tax.expectedRequisitesVersion, taxAcknowledged: true } };
    const edited = await call(endpoint, command, 200, identity, "PATCH");
    await call(endpoint, command, 200, identity, "PATCH");
    assert(edited.offerId === offer.id && edited.priority === 17, "ERP tax edit changed binding scope/priority");
    const stored = await prisma.integrationDataBinding.findUniqueOrThrow({ where: { id: binding.id } });
    assert(stored.configuration.existing === "preserved" && stored.configuration.vatContext.actorId === identity.userId, "ERP lost configuration or actor capture");
    await call(endpoint, { ...command, idempotencyKey: randomUUID() }, 409, identity, "PATCH");
    const list = await call(root + "/integrations/price-tax", undefined, 200, identity, "GET");
    assert(list.some(item => item.id === binding.id && item.priceTax.priceIncludesVat === false), "Typed ERP read did not expose saved tax settings");
  } finally {
    if (connection) {
      await prisma.idempotencyRecord.deleteMany({ where: { scope: { startsWith: `integration-tax:${supplierId}:` } } });
      await prisma.integrationConnection.delete({ where: { id: connection.id } });
    }
    await prisma.supplierExternalItem.deleteMany({ where: { sourceId: source.id } });
    const batchIds = (await prisma.importBatch.findMany({ where: { sourceId: source.id }, select: { id: true } })).map(item => item.id);
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: batchIds } } });
    await prisma.importBatch.deleteMany({ where: { sourceId: source.id } });
    await prisma.supplierMappingMemory.deleteMany({ where: { sourceId: source.id } });
    await prisma.supplierOffer.updateMany({ where: { sourceId: source.id }, data: { sourceId: null } });
    await prisma.supplierDataSource.delete({ where: { id: source.id } });
  }
  console.log("VAT real PostgreSQL/API flows PASS: discounted line rounding, same-price consent, order immutability/replay, import net/blank/stale row rollback, ERP optimistic scope-preserving update");
}
