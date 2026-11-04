import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";
import { PaymentSettlementService } from "../apps/api/dist/src/modules/payments/payment-settlement.service.js";

const datasourceUrl = testDatabaseUrl();
const db = new PrismaClient({ datasourceUrl }), peer = new PrismaClient({ datasourceUrl });
const prefix = `payment-recovery-${randomUUID()}`;
const organizations = [], intents = [], checkouts = [], carts = [];
let provider, merchant, product, variant, warehouse, offer, balance, lot, reservation;
const calls = { authorize: 0, capture: 0, cancel: 0, payout: 0 };
const adapter = Object.fromEntries(Object.keys(calls).map(method => [method, async () => {
  calls[method]++; return { status: "SUCCEEDED", externalId: randomUUID(), data: {} };
}]));
const service = client => new PaymentSettlementService(client, { resolve: () => ({ adapter, context: {} }) }, { assertActive: async () => {} });
function decorate(client, hook) {
  return new Proxy(client, { get(target, key) {
    if (key === "$transaction") return (callback, options) => target.$transaction(tx => hook(tx, callback), options);
    const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
  } });
}
async function fixture() {
  const cart = await db.cart.create({ data: { buyerOrganizationId: organizations[0], status: "CHECKED_OUT" } }); carts.push(cart.id);
  const checkout = await db.checkout.create({ data: { cartId: cart.id, buyerOrganizationId: organizations[0], totalAmountMinor: 100, currency: "KZT", idempotencyKey: randomUUID(), pricingSnapshot: {} } }); checkouts.push(checkout.id);
  const intent = await db.paymentIntent.create({ data: { checkoutId: checkout.id, buyerOrganizationId: organizations[0], providerId: provider.id, totalAmountMinor: 100, currency: "KZT", idempotencyKey: randomUUID() } }); intents.push(intent.id);
  const order = await db.supplierOrder.create({ data: { checkoutId: checkout.id, buyerOrganizationId: organizations[0], supplierOrganizationId: organizations[1], orderNumber: randomUUID(), subtotalAmountMinor: 100, currency: "KZT" } });
  const allocation = await db.paymentAllocation.create({ data: { paymentIntentId: intent.id, supplierOrderId: order.id, recipientOrganizationId: organizations[1], merchantAccountId: merchant.id, grossAmountMinor: 100, platformFeeMinor: 10, netAmountMinor: 90 } });
  return { intent, allocation, order, cart };
}
async function recover(method, target, context, input, afterRollback = async () => {}) {
  const before = calls[method];
  const invoke = client => service(client)[method === "payout" ? "processPayout" : method](target, input, context);
  const broken = decorate(db, async (tx, callback) => { await callback(tx); throw new Error("RECOVERY_COMMIT_FAILURE"); });
  await assert.rejects(() => invoke(broken), /RECOVERY_COMMIT_FAILURE/);
  assert.equal(calls[method], before + 1);
  const saved = await db.paymentAttempt.findFirstOrThrow({ where: { requestPayload: { path: ["clientIdempotencyKey"], equals: input.idempotencyKey } } });
  assert.equal(saved.status, "SUCCEEDED");
  assert.equal(await db.paymentTransaction.count({ where: { idempotencyKey: input.idempotencyKey } }), 0);
  assert.equal(await db.financialLedgerEntry.count({ where: { referenceId: saved.paymentIntentId } }), method === "payout" ? 2 : 0);
  await afterRollback();
  await assert.rejects(() => service(db)[method === "payout" ? "processPayout" : method](target, { ...input, idempotencyKey: randomUUID() }, context), error => error.getStatus() === 409);
  await assert.rejects(() => service(db)[method === "payout" ? "processPayout" : method](target, input, { organizationId: organizations[2] }), error => error.getStatus() === 403);
  let entered, release;
  const firstLocked = new Promise(resolve => { entered = resolve; });
  const proceed = new Promise(resolve => { release = resolve; });
  const held = decorate(db, async (tx, callback) => callback(new Proxy(tx, { get(t, key) {
    if (key === "$queryRaw") return async (...args) => { const result = await t.$queryRaw(...args); entered(); await proceed; return result; };
    return Reflect.get(t, key);
  } })));
  let secondEntered;
  const secondStarted = new Promise(resolve => { secondEntered = resolve; });
  const secondClient = decorate(peer, async (tx, callback) => { secondEntered(); return callback(tx); });
  const first = invoke(held); await firstLocked;
  const second = invoke(secondClient); const both = Promise.all([first, second]);
  await secondStarted; release(); await both;
  await invoke(db);
  assert.equal(calls[method], before + 1);
  assert.equal(await db.paymentTransaction.count({ where: { idempotencyKey: input.idempotencyKey } }), 1);
  console.log(`PASS ${method}: commit rollback, saved success, foreign tenant/key denial, two-connection recovery, no repeated provider call`);
}
try {
  const [identity] = await db.$queryRaw`SELECT current_database() AS name`;
  assert.equal(identity.name, "dentmarket_audit_20260914", "Only the approved disposable database is allowed");
  for (let i = 0; i < 3; i++) {
    const org = await db.organization.create({ data: { legalName: prefix, displayName: prefix, bin: `${Date.now() + i}`.slice(-12) } }); organizations.push(org.id);
  }
  provider = await db.paymentProvider.create({ data: { code: prefix, name: prefix, capabilities: {} } });
  merchant = await db.paymentMerchantAccount.create({ data: { organizationId: organizations[1], providerId: provider.id, externalMerchantId: prefix, onboardingStatus: "ACTIVE", verificationStatus: "VERIFIED", payoutStatus: "READY" } });
  await db.supplierProfile.create({ data: { organizationId: organizations[1] } });
  const context = { organizationId: organizations[0] };
  for (const method of ["authorize", "cancel", "capture"]) {
    const f = await fixture();
    if (method === "capture") {
      product = await db.product.create({ data: { canonicalName: prefix, slug: prefix, productType: "consumable" } });
      variant = await db.productVariant.create({ data: { productId: product.id } });
      warehouse = await db.warehouse.create({ data: { supplierOrganizationId: organizations[1], code: prefix, name: prefix } });
      offer = await db.supplierOffer.create({ data: { supplierOrganizationId: organizations[1], productVariantId: variant.id } });
      const stock = { supplierOrganizationId: organizations[1], warehouseId: warehouse.id, productVariantId: variant.id, offerId: offer.id,
        quantityOnHand: 10, quantityReserved: 2, quantityAvailable: 8 };
      balance = await db.inventoryBalance.create({ data: stock });
      lot = await db.inventoryLot.create({ data: { ...stock, inventoryBalanceId: balance.id, lotNumber: prefix, status: "ACTIVE", expirationDate: new Date("2035-12-31") } });
      const cartItem = await db.cartItem.create({ data: { cartId: f.cart.id, offerId: offer.id, quantity: 2,
        unitPriceMinor: 50, totalPriceMinor: 100, currency: "KZT", priceSource: "MANUAL", pricingSnapshot: {} } });
      const item = await db.supplierOrderItem.create({ data: { supplierOrderId: f.order.id, cartItemId: cartItem.id, offerId: offer.id, productVariantId: variant.id,
        warehouseId: warehouse.id, inventoryLotId: lot.id, quantity: 2, acceptedQuantity: 2, unitPriceMinor: 50, totalPriceMinor: 100,
        currency: "KZT", offerSnapshot: {}, inventorySnapshot: {} } });
      reservation = await db.inventoryReservation.create({ data: { inventoryBalanceId: balance.id, inventoryLotId: lot.id,
        supplierOrganizationId: organizations[1], warehouseId: warehouse.id, productVariantId: variant.id, quantity: 2,
        supplierOrderItemId: item.id, expiresAt: new Date(Date.now() + 60000), idempotencyKey: randomUUID() } });
    }
    await recover(method, f.intent.id, context, { idempotencyKey: randomUUID(), reason: "Recovery regression" }, async () => {
      if (method !== "capture") return;
      for (const [model, row] of [["inventoryBalance", balance], ["inventoryLot", lot]]) {
        const current = await db[model].findUniqueOrThrow({ where: { id: row.id } });
        assert.equal(current.quantityOnHand.toString(), "10");
        assert.equal(current.quantityReserved.toString(), "2");
        assert.equal(current.version, 1);
      }
      assert.equal((await db.inventoryReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status, "ACTIVE");
      assert.equal((await db.supplierOrder.findUniqueOrThrow({ where: { id: f.order.id } })).paymentStatus, "UNPAID");
    });
    assert.equal(await db.auditLog.count({ where: { entityId: f.intent.id } }), 1);
    assert.equal(await db.outboxEvent.count({ where: { aggregateId: f.intent.id } }), 1);
    if (method === "capture") {
      for (const [model, row] of [["inventoryBalance", balance], ["inventoryLot", lot]]) {
        const current = await db[model].findUniqueOrThrow({ where: { id: row.id } });
        assert.equal(current.quantityOnHand.toString(), "8");
        assert.equal(current.quantityReserved.toString(), "0");
        assert.equal(current.quantityAvailable.toString(), "8");
        assert.equal(current.version, 2);
      }
      assert.equal((await db.inventoryReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status, "CONSUMED");
      console.log("PASS capture stock: balance/lot/reservation rollback, exactly one consumption under race and replay");
      assert.equal(await db.financialLedgerEntry.count({ where: { referenceId: f.intent.id } }), 2);
      assert.equal((await db.supplierOrder.findUniqueOrThrow({ where: { id: f.order.id } })).version, 2);
      const payout = await db.payout.findFirstOrThrow({ where: { paymentAllocationId: f.allocation.id } });
      await recover("payout", payout.id, { organizationId: organizations[1] }, { idempotencyKey: randomUUID() });
      assert.equal(await db.financialLedgerEntry.count({ where: { referenceId: f.intent.id } }), 3);
      assert.equal(await db.auditLog.count({ where: { entityId: payout.id } }), 1);
      assert.equal(await db.outboxEvent.count({ where: { aggregateId: payout.id } }), 1);
    }
  }
} catch (error) {
  console.error("Payment recovery failed:", error.message);
  throw error;
} finally {
  const payouts = await db.payout.findMany({ where: { paymentAllocation: { paymentIntentId: { in: intents } } }, select: { id: true } });
  const entities = [...intents, ...payouts.map(p => p.id)];
  await db.auditLog.deleteMany({ where: { entityId: { in: entities } } });
  await db.outboxEvent.deleteMany({ where: { aggregateId: { in: entities } } });
  // Immutable synthetic ledger rows stay in the disposable database.
  await db.payout.deleteMany({ where: { id: { in: payouts.map(p => p.id) } } });
  for (const model of ["paymentCapture", "paymentAuthorization", "paymentAttempt", "paymentTransaction", "paymentAllocation"]) await db[model].deleteMany({ where: { paymentIntentId: { in: intents } } });
  await db.paymentIntent.deleteMany({ where: { id: { in: intents } } });
  if (reservation) await db.inventoryReservation.delete({ where: { id: reservation.id } });
  await db.supplierOrder.deleteMany({ where: { checkoutId: { in: checkouts } } });
  await db.checkout.deleteMany({ where: { id: { in: checkouts } } });
  await db.cart.deleteMany({ where: { id: { in: carts } } });
  if (merchant) await db.paymentMerchantAccount.delete({ where: { id: merchant.id } });
  if (provider) await db.paymentProvider.delete({ where: { id: provider.id } });
  if (lot) await db.inventoryLot.delete({ where: { id: lot.id } });
  if (balance) await db.inventoryBalance.delete({ where: { id: balance.id } });
  if (offer) await db.supplierOffer.delete({ where: { id: offer.id } });
  if (warehouse) await db.warehouse.delete({ where: { id: warehouse.id } });
  if (variant) await db.productVariant.delete({ where: { id: variant.id } });
  if (product) await db.product.delete({ where: { id: product.id } });
  await db.organization.deleteMany({ where: { id: { in: organizations } } });
  await Promise.all([db.$disconnect(), peer.$disconnect()]);
}
