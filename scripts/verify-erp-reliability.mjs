import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";
import { SuppliersService } from "../apps/api/dist/src/modules/suppliers/suppliers.service.js";
import { SupplierAccessService } from "../apps/api/dist/src/modules/suppliers/supplier-access.service.js";
import { IntegrationCryptoService } from "../apps/api/dist/src/modules/integrations/integration-crypto.service.js";
import { IntegrationExecutionService } from "../apps/api/dist/src/modules/integrations/integration-execution.service.js";
import { IntegrationJobsService } from "../apps/api/dist/src/modules/integrations/integration-jobs.service.js";
import { IntegrationsService } from "../apps/api/dist/src/modules/integrations/integrations.service.js";
import { IntegrationAdapterRegistry } from "../apps/api/dist/src/modules/integrations/adapters/adapter-registry.service.js";
import { DataFreshnessService } from "../apps/api/dist/src/modules/inventory/data-freshness.service.js";

const datasourceUrl = testDatabaseUrl();
const db = new PrismaClient({ datasourceUrl }), peer = new PrismaClient({ datasourceUrl });
const suffix = randomUUID(), organizations = [];
let user, product, connection, source, offer;
const crypto = new IntegrationCryptoService();
const configuration = { endpoint: "https://synthetic.invalid", accessToken: "SYNTHETIC_ACCESS", items: [{ name: "public", refreshToken: "SYNTHETIC_ARRAY" }] };
function decorate(client, hook) {
  return new Proxy(client, { get(target, key) {
    if (key === "$transaction") return (callback, options) => target.$transaction(tx => hook(tx, callback), options);
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  } });
}
const sources = client => new SuppliersService(client, new SupplierAccessService(client), crypto);
let priceValue = 100;
const effects = new Map(); let reservationCalls = 0;
const reserve = async (_context, payload) => {
  reservationCalls++;
  assert.equal(payload.idempotencyKey, `reserve:${suffix}`);
  if (!effects.has(payload.idempotencyKey)) effects.set(payload.idempotencyKey, { externalId: randomUUID(), data: { reserved: true } });
  return effects.get(payload.idempotencyKey);
};
const adapter = { pullPrices: async () => ({ items: [{ externalId: "external", valueMinor: priceValue, currency: "KZT", raw: {} }] }), createReservation: reserve };
const execution = client => new IntegrationExecutionService(client, { resolve: () => ({ adapter, context: { connectionId: connection.id, credentials: {}, configuration: {} } }) },
  new IntegrationJobsService(client), new DataFreshnessService(client, new SupplierAccessService(client), {}), {});
try {
  for (let i = 0; i < 2; i++) organizations.push(await db.organization.create({ data: { legalName: `ERP ${suffix}`, displayName: `ERP ${suffix}`, bin: `${Date.now() + i}`.slice(-12), supplierProfile: { create: {} } } }));
  user = await db.user.create({ data: { email: `${suffix}@erp.invalid`, displayName: "ERP test" } });
  const context = { actorId: user.id, organizationId: organizations[0].id };
  const sourceInput = { name: suffix, type: "API", configuration };
  await assert.rejects(() => sources(db).createDataSource(organizations[0].id, sourceInput, { ...context, organizationId: organizations[1].id }), error => error.getStatus() === 403);
  const broken = decorate(db, async (tx, callback) => { await callback(tx); throw new Error("ERP_TEST_ROLLBACK"); });
  await assert.rejects(() => sources(broken).createDataSource(organizations[0].id, sourceInput, context), /ERP_TEST_ROLLBACK/);
  assert.equal(await db.supplierDataSource.count({ where: { supplierOrganizationId: organizations[0].id } }), 0);
  source = await sources(db).createDataSource(organizations[0].id, sourceInput, context);
  const stored = await db.supplierDataSource.findUniqueOrThrow({ where: { id: source.id } });
  assert.equal(JSON.stringify([source, stored.configuration, await db.auditLog.findMany({ where: { entityId: source.id } }), await sources(db).list(context)]).includes("SYNTHETIC_"), false);
  assert.deepEqual(crypto.decryptJson(stored.encryptedConfiguration), { accessToken: configuration.accessToken, items: [{ refreshToken: "SYNTHETIC_ARRAY" }] });
  await db.supplierDataSource.update({ where: { id: source.id }, data: { configuration } });
  assert.equal(JSON.stringify(await sources(db).dataSources(organizations[0].id, context)).includes("SYNTHETIC_"), false);
  await db.supplierDataSource.update({ where: { id: source.id }, data: { configuration: stored.configuration } });
  console.log("PASS source secrets: encrypted SQL storage, safe response/list/audit, legacy read, tenant denial, transaction rollback");

  product = await db.product.create({ data: { canonicalName: suffix, slug: suffix, productType: "TEST", variants: { create: {} } }, include: { variants: true } });
  offer = await db.supplierOffer.create({ data: { supplierOrganizationId: organizations[0].id, productVariantId: product.variants[0].id, sourceId: source.id, sourceType: "API", status: "ACTIVE" } });
  const stale = new Date("2020-01-01T00:00:00Z");
  const price = await db.offerPrice.create({ data: { offerId: offer.id, amountMinor: 100, currency: "KZT", source: "API", lastConfirmedAt: stale, freshnessExpiresAt: stale } });
  connection = await db.integrationConnection.create({ data: { supplierOrganizationId: organizations[0].id, sourceId: source.id, provider: "MOCK", mode: "API", displayName: suffix,
    configuration: stored.configuration, encryptedConfiguration: stored.encryptedConfiguration } });
  const integrationService = new IntegrationsService(db, new SupplierAccessService(db), crypto);
  const updatedPublic = { endpoint: configuration.endpoint, items: [{ name: "updated" }] };
  const changedConnection = await integrationService.update(organizations[0].id, connection.id, { version: connection.version, configuration: updatedPublic }, context);
  assert.equal(JSON.stringify(changedConnection).includes("SYNTHETIC_"), false);
  const runtimeConnection = await db.integrationConnection.findUniqueOrThrow({ where: { id: connection.id } });
  const runtime = new IntegrationAdapterRegistry(crypto, {}, {}, {}).resolve(runtimeConnection);
  assert.deepEqual(runtime.context.configuration, { ...updatedPublic, accessToken: configuration.accessToken, items: [{ name: "updated", refreshToken: "SYNTHETIC_ARRAY" }] });
  await db.integrationDataBinding.create({ data: { connectionId: connection.id, dataType: "PRICE", offerId: offer.id, configuration: {} } });
  await db.integrationMapping.create({ data: { connectionId: connection.id, entityType: "VARIANT", externalId: "external", internalId: product.variants[0].id } });
  const priceJob = { id: randomUUID(), connectionId: connection.id, type: "PRICE_SYNC", payload: {}, cursor: {} };
  await assert.rejects(() => execution(broken).execute(priceJob), /ERP_TEST_ROLLBACK/);
  assert.equal((await db.offerPrice.findUniqueOrThrow({ where: { id: price.id } })).lastConfirmedAt.getTime(), stale.getTime());
  let entered, release, secondEntered;
  const firstLocked = new Promise(resolve => { entered = resolve; });
  const proceed = new Promise(resolve => { release = resolve; });
  const secondStarted = new Promise(resolve => { secondEntered = resolve; });
  const held = decorate(db, async (tx, callback) => callback(new Proxy(tx, { get(target, key) {
    if (key === "$queryRaw") return async (...args) => { const result = await target.$queryRaw(...args); entered(); await proceed; return result; };
    return Reflect.get(target, key);
  } })));
  const first = execution(held).execute(priceJob); await firstLocked;
  const second = execution(decorate(peer, async (tx, callback) => { secondEntered(); return callback(tx); })).execute(priceJob);
  const both = Promise.all([first, second]); await secondStarted; release();
  for (const result of await both) assert.equal(result.unchanged, 1);
  const confirmed = await db.offerPrice.findUniqueOrThrow({ where: { id: price.id } });
  assert(confirmed.lastConfirmedAt > stale && confirmed.freshnessExpiresAt > confirmed.lastConfirmedAt);
  assert.equal(await db.offerPrice.count({ where: { offerId: offer.id } }), 1);
  assert.equal(await db.offerPriceHistory.count({ where: { offerId: offer.id } }), 0);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: offer.id } }), 0);
  assert.equal((await db.supplierOffer.findUniqueOrThrow({ where: { id: offer.id } })).version, offer.version);
  await db.offerPrice.update({ where: { id: price.id }, data: { source: "MANUAL", lastConfirmedAt: stale, freshnessExpiresAt: stale } });
  assert.equal((await execution(db).execute(priceJob)).protected, 1);
  assert.equal((await db.offerPrice.findUniqueOrThrow({ where: { id: price.id } })).lastConfirmedAt.getTime(), stale.getTime());
  await db.offerPrice.update({ where: { id: price.id }, data: { source: "API" } });
  priceValue = Number.MAX_SAFE_INTEGER;
  assert.equal((await execution(db).execute(priceJob)).updated, 1);
  assert.equal(await db.offerPriceHistory.count({ where: { offerId: offer.id } }), 1);
  assert.equal(await db.outboxEvent.count({ where: { aggregateId: offer.id } }), 1);
  assert.equal((await db.offerPrice.findFirstOrThrow({ where: { offerId: offer.id, status: "ACTIVE" } })).amountMinor.toString(), String(Number.MAX_SAFE_INTEGER));
  console.log("PASS price: real rollback, two-connection unchanged confirmations, no new price/history/version/event, manual guard, changed-price control");

  const jobs = new IntegrationJobsService(db), worker = `erp-test:${suffix}`;
  const job = await jobs.enqueue(connection.id, { type: "RESERVATION_CREATE", idempotencyKey: `reserve:${suffix}`, maxAttempts: 3, payload: { idempotencyKey: "untrusted", quantity: 1 } });
  const [claimA, claimB] = await Promise.all([jobs.claimForAgent(connection.id, worker), new IntegrationJobsService(peer).claimForAgent(connection.id, "other-worker")]);
  const claimed = claimA ?? claimB;
  assert.equal([claimA, claimB].filter(Boolean).length, 1);
  const firstResult = await execution(db).execute(claimed);
  await assert.rejects(() => new IntegrationJobsService(broken).complete(job.id, claimed.lockedBy, firstResult), /ERP_TEST_ROLLBACK/);
  assert.equal((await db.integrationSyncJob.findUniqueOrThrow({ where: { id: job.id } })).status, "RUNNING");
  await jobs.fail(job.id, claimed.lockedBy, "Synthetic local completion failure", true, 0);
  const retry = await jobs.claimForAgent(connection.id, worker);
  const replay = await execution(db).execute(retry);
  await jobs.complete(job.id, worker, replay);
  assert.deepEqual(replay, firstResult); assert.equal(reservationCalls, 2); assert.equal(effects.size, 1);
  assert.equal((await db.integrationSyncJob.findUniqueOrThrow({ where: { id: job.id } })).status, "SUCCEEDED");
  console.log("PASS reservation: SQL claim exclusion, completion rollback, retry with stable key and one synthetic remote effect");
} catch (error) {
  console.error("ERP reliability failed:", error.message); throw error;
} finally {
  const orgIds = organizations.map(org => org.id);
  await db.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } });
  const sourceIds = (await db.supplierDataSource.findMany({ where: { supplierOrganizationId: { in: orgIds } }, select: { id: true } })).map(row => row.id);
  await db.outboxEvent.deleteMany({ where: { aggregateId: { in: [...sourceIds, ...(offer ? [offer.id] : [])] } } });
  if (connection) await db.integrationConnection.delete({ where: { id: connection.id } });
  if (offer) await db.supplierOffer.delete({ where: { id: offer.id } });
  if (product) await db.product.delete({ where: { id: product.id } });
  await db.supplierDataSource.deleteMany({ where: { id: { in: sourceIds } } });
  await db.supplierProfile.deleteMany({ where: { organizationId: { in: orgIds } } });
  await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  if (user) await db.user.delete({ where: { id: user.id } });
  await Promise.all([db.$disconnect(), peer.$disconnect()]);
}
