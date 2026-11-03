import assert from 'node:assert/strict';
import { randomUUID, randomInt } from 'node:crypto';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);
const { InventoryFreshnessService } = require('../apps/api/dist/src/modules/inventory/inventory-freshness.service.js');
const target = process.env.DATABASE_URL;
assert(target && target === process.env.POSTGRES_TEST_DATABASE_URL, 'Run through db:test with an explicit isolated database');
const parsed = new URL(target);
assert.equal(parsed.pathname, '/dentmarket_audit_20260914');
assert.equal(parsed.port, '5432');
assert.equal(parsed.search, '?schema=public');
assert(['localhost', '127.0.0.1'].includes(parsed.hostname));
const reader = new PrismaClient({ datasourceUrl: target });
const writer = new PrismaClient({ datasourceUrl: target });
const marker = `freshness-audit-${randomUUID()}`;
let supplierId, productId, offerId, balanceId;
let barrierReached = false;
let refreshed;
try {
  for (const db of [reader, writer]) {
    const [identity] = await db.$queryRaw`SELECT current_database() AS name`;
    assert.equal(identity.name, 'dentmarket_audit_20260914');
  }
  const supplier = await reader.organization.create({ data: { legalName: marker, displayName: marker,
    bin: String(randomInt(100000, 999999)) + String(randomInt(100000, 999999)), commerceDataset: 'TEST',
    capabilities: { create: { capability: 'SUPPLIER' } }, supplierProfile: { create: { regulatoryDetails: { testFixture: marker } } } } });
  supplierId = supplier.id;
  const warehouse = await reader.warehouse.create({ data: { supplierOrganizationId: supplierId, code: marker, name: marker } });
  const product = await reader.product.create({ data: { canonicalName: marker, slug: marker, productType: 'MATERIAL', status: 'ACTIVE', variants: { create: { sku: marker, status: 'ACTIVE', packageQuantity: 1 } } }, include: { variants: true } });
  productId = product.id;
  const offer = await reader.supplierOffer.create({ data: { supplierOrganizationId: supplierId, productVariantId: product.variants[0].id, status: 'ACTIVE', sourceType: 'MANUAL', publication: { create: { status: 'PUBLISHED', marketplaceVisible: true, publishedAt: new Date() } } } });
  offerId = offer.id;
  const balance = await reader.inventoryBalance.create({ data: { supplierOrganizationId: supplierId, warehouseId: warehouse.id, productVariantId: product.variants[0].id, offerId,
    source: 'MANUAL', quantityOnHand: 10, quantityAvailable: 10, freshnessStatus: 'FRESH', availabilityStatus: 'IN_STOCK',
    lastSuccessfulSyncAt: new Date(Date.now() - 172800000), freshnessExpiresAt: new Date(Date.now() - 60000) } });
  balanceId = balance.id;
  await reader.freshnessPolicy.create({ data: { supplierOrganizationId: supplierId, scopeKey: supplierId, source: 'MANUAL', dataType: 'INVENTORY', staleAfterMinutes: 2880, expirationBehavior: 'PAUSE' } });
  const inventoryProxy = new Proxy(reader.inventoryBalance, { get(delegate, name) {
    if (name !== 'findMany') { const value = delegate[name]; return typeof value === 'function' ? value.bind(delegate) : value; }
    return async args => {
      const snapshot = await delegate.findMany(args);
      assert.equal(snapshot.length, 1);
      assert.equal(snapshot[0].id, balanceId);
      barrierReached = true;
      refreshed = await writer.inventoryBalance.update({ where: { id: balanceId }, data: { lastSuccessfulSyncAt: new Date(), freshnessExpiresAt: new Date(Date.now() + 3600000), freshnessStatus: 'FRESH', version: { increment: 1 } } });
      return snapshot;
    };
  } });
  const proxy = new Proxy(reader, { get(db, name) { if (name === 'inventoryBalance') return inventoryProxy; const value = db[name]; return typeof value === 'function' ? value.bind(db) : value; } });
  const service = new InventoryFreshnessService(proxy, { assertCanManage: async () => {} });
  const summary = await service.recompute(supplierId);
  const final = await reader.inventoryBalance.findUniqueOrThrow({ where: { id: balanceId } });
  const publication = await reader.offerPublication.findUniqueOrThrow({ where: { offerId } });
  assert(barrierReached, 'second-connection refresh must occur after candidate snapshot');
  const report = { database: parsed.pathname.slice(1),
    case: 'freshness-snapshot-concurrent-refresh', expected: { freshnessStatus: 'FRESH', publicationStatus: 'PUBLISHED', version: refreshed.version },
    actual: { freshnessStatus: final.freshnessStatus, publicationStatus: publication.status, version: final.version, futureExpiryPreserved: final.freshnessExpiresAt > new Date(), lastSyncPreserved: final.lastSuccessfulSyncAt.getTime() === refreshed.lastSuccessfulSyncAt.getTime() },
    defectReproduced: final.freshnessStatus === 'STALE' && publication.status === 'PAUSED' && final.freshnessExpiresAt > new Date(), summary };
  assert.equal(final.freshnessStatus, 'FRESH');
  assert.equal(final.version, refreshed.version);
  assert.equal(publication.status, 'PUBLISHED');
  assert.equal(summary.staleBalances, 0);
  assert.equal(await reader.outboxEvent.count({ where: { aggregateId: supplierId, eventType: 'InventoryFreshnessChanged' } }), 0);
  await writer.inventoryBalance.update({ where: { id: balanceId }, data: { freshnessExpiresAt: new Date(Date.now() - 60000), version: { increment: 1 } } });
  const normalService = new InventoryFreshnessService(reader, { assertCanManage: async () => {} });
  const expired = await normalService.recompute(supplierId);
  assert.equal(expired.staleBalances, 1);
  assert.equal(expired.pausedOffers, 1);
  const repeated = await normalService.recompute(supplierId);
  assert.equal(repeated.staleBalances, 0);
  assert.equal(await reader.outboxEvent.count({ where: { aggregateId: supplierId, eventType: 'InventoryFreshnessChanged' } }), 1);
  report.controls = { expired: expired.staleBalances, paused: expired.pausedOffers, repeated: repeated.staleBalances };
  console.log(JSON.stringify(report, null, 2));

} finally {
  if (supplierId) {
    await reader.auditLog.deleteMany({ where: { entityType: 'SupplierProfile', entityId: supplierId, action: 'inventory.freshness.recomputed' } });
    await reader.outboxEvent.deleteMany({ where: { aggregateType: 'SupplierProfile', aggregateId: supplierId, eventType: 'InventoryFreshnessChanged' } });
    if (balanceId) await reader.inventoryBalance.deleteMany({ where: { id: balanceId } });
    if (offerId) await reader.supplierOffer.deleteMany({ where: { id: offerId } });
    await reader.organization.delete({ where: { id: supplierId } });
  }
  if (productId) await reader.product.delete({ where: { id: productId } });
  await Promise.all([reader.$disconnect(), writer.$disconnect()]);
}
