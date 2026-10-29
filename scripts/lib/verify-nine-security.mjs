import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PaymentSettlementService } = require("../../apps/api/dist/src/modules/payments/payment-settlement.service.js");
const { writeSyncedInventory } = require("../../apps/api/dist/src/modules/integrations/integration-inventory.js");

/** All fixture writes, including immutable ledger entries, roll back together. */
export async function verifyNineSecurity(prisma) {
  const rollback = new Error("security-nine-fixture-rollback");
  const suffix = randomUUID();
  try {
    await prisma.$transaction(async tx => {
      const binBase = BigInt(`0x${suffix.replaceAll("-", "").slice(0, 8)}`);
      const orgData = (name, index) => ({ legalName: `Security ${name} ${suffix}`, displayName: `Security ${name} ${suffix}`, bin: `96${(binBase + BigInt(index)).toString().padStart(10, "0")}` });
      const buyer = await tx.organization.create({ data: orgData("buyer", 0) });
      const supplier = await tx.organization.create({ data: { ...orgData("supplier", 1), supplierProfile: { create: {} } } });
      const other = await tx.organization.create({ data: { ...orgData("other", 2), supplierProfile: { create: {} } } });
      const user = await tx.user.create({ data: { email: `${suffix}@security.invalid`, displayName: "Security fixture" } });
      const cart = await tx.cart.create({ data: { buyerOrganizationId: buyer.id } });
      const checkout = await tx.checkout.create({ data: { cartId: cart.id, buyerOrganizationId: buyer.id, totalAmountMinor: 200, currency: "KZT", pricingSnapshot: [], idempotencyKey: suffix } });
      const orders = await Promise.all([supplier, other].map((org, i) => tx.supplierOrder.create({ data: { checkoutId: checkout.id, buyerOrganizationId: buyer.id, supplierOrganizationId: org.id, orderNumber: `${suffix}-${i}`, subtotalAmountMinor: 100, currency: "KZT", status: "PAID", paymentStatus: "PAID" } })));
      const provider = await tx.paymentProvider.create({ data: { code: `SECURITY_${suffix}`, name: "Offline fixture", capabilities: { supports_partial_refund: true } } });
      const intent = await tx.paymentIntent.create({ data: { checkoutId: checkout.id, buyerOrganizationId: buyer.id, providerId: provider.id, totalAmountMinor: 200, currency: "KZT", idempotencyKey: suffix, status: "CAPTURED" } });
      const allocations = await Promise.all(orders.map((order, i) => tx.paymentAllocation.create({ data: { paymentIntentId: intent.id, supplierOrderId: order.id, recipientOrganizationId: i ? other.id : supplier.id, grossAmountMinor: 100, platformFeeMinor: 0, netAmountMinor: 100, status: "CAPTURED" } })));
      let release, started;
      const waiting = new Promise(resolve => { started = resolve; });
      let calls = 0, pending = true, failApply = false;
      const adapter = { refund: async () => {
        calls++;
        if (pending) { started(); return new Promise(resolve => { release = resolve; }); }
        return { status: "SUCCEEDED", externalId: `${suffix}-${calls}`, data: {} };
      } };
      const db = new Proxy(tx, { get(target, key) {
        if (key === "$transaction") return async callback => { if (failApply) { failApply = false; throw new Error("simulated commit failure"); } return callback(tx); };
        return Reflect.get(target, key);
      } });
      const service = new PaymentSettlementService(db, { resolve: () => ({ adapter, context: {} }) }, {});
      const context = { actorId: user.id, organizationId: supplier.id };
      const command = { amountMinor: 60, idempotencyKey: `${suffix}-refund`, reason: "return" };
      const first = service.refund(allocations[0].id, command, context);
      await waiting;
      await assert.rejects(service.refund(allocations[0].id, { ...command, amountMinor: 70, idempotencyKey: `${suffix}-second` }, context), /processing/);
      assert.equal(calls, 1);
      release({ status: "PENDING", externalId: `${suffix}-pending`, data: {} });
      const pendingRow = await first;
      assert.equal(pendingRow.status, "PROCESSING");
      assert.equal((await tx.paymentAllocation.findUniqueOrThrow({ where: { id: allocations[0].id } })).refundedAmountMinor.toString(), "0");
      // Reset only these uncommitted synthetic PENDING rows for the recovery control.
      await tx.refund.delete({ where: { id: pendingRow.id } });
      await tx.paymentTransaction.deleteMany({ where: { paymentIntentId: intent.id } });
      await tx.paymentAttempt.deleteMany({ where: { paymentIntentId: intent.id } });
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: "CAPTURED" } });
      pending = false; failApply = true;
      await assert.rejects(service.refund(allocations[0].id, command, context), /simulated commit/);
      const beforeRecovery = calls;
      const recovered = await service.refund(allocations[0].id, command, context);
      assert.equal(recovered.status, "COMPLETED"); assert.equal(calls, beforeRecovery);
      assert.equal((await service.refund(allocations[0].id, command, context)).id, recovered.id);
      await assert.rejects(service.refund(allocations[0].id, { ...command, amountMinor: 70, idempotencyKey: `${suffix}-too-much` }, context), /exceeds/);
      const current = await tx.paymentIntent.findUniqueOrThrow({ where: { id: intent.id } });
      await assert.rejects(service.claimIntentProcessing(intent.id, [current.status], current.updatedAt, { allocationId: allocations[0].id, refundedAmountMinor: "0" }), /processing/);
      await service.refund(allocations[0].id, { ...command, amountMinor: 40, idempotencyKey: `${suffix}-remaining` }, context);
      assert.equal((await tx.paymentAllocation.findUniqueOrThrow({ where: { id: allocations[0].id } })).refundedAmountMinor.toString(), "100");
      await assert.rejects(service.refund(allocations[1].id, command, { ...context, organizationId: other.id }), /another allocation/);
      const foreignTx = await tx.paymentTransaction.create({ data: { paymentIntentId: intent.id, paymentAllocationId: allocations[1].id, providerId: provider.id, type: "CAPTURE", status: "SUCCEEDED", amountMinor: 100, currency: "KZT", idempotencyKey: `${suffix}-foreign`, responsePayload: { private: "foreign-provider-payload" } } });
      for (const transaction of [await tx.paymentTransaction.findUniqueOrThrow({ where: { id: recovered.paymentTransactionId } }), foreignTx]) await tx.paymentReconciliationEntry.create({ data: { providerId: provider.id, paymentIntentId: intent.id, paymentTransactionId: transaction.id, externalRef: transaction.id, status: "MATCHED", expected: { wholeIntent: "private" }, actual: {} } });
      const rows = await service.reconciliation({ limit: 100 }, context);
      const own = rows.filter(row => row.paymentIntentId === intent.id);
      assert.equal(own.length, 1); assert.equal(own[0].paymentIntent, null);
      assert.doesNotMatch(JSON.stringify(own), /foreign-provider-payload|wholeIntent/);
      const product = await tx.product.create({ data: { canonicalName: "Security stock", slug: suffix, productType: "consumable" } });
      const variant = await tx.productVariant.create({ data: { productId: product.id } });
      const warehouse = await tx.warehouse.create({ data: { supplierOrganizationId: supplier.id, code: suffix, name: "Security stock" } });
      const identity = { supplierOrganizationId: supplier.id, warehouseId: warehouse.id, productVariantId: variant.id };
      const balance = await tx.inventoryBalance.create({ data: { ...identity, quantityOnHand: 10, quantityAvailable: 10 } });
      await tx.inventoryBalance.update({ where: { id: balance.id }, data: { quantityReserved: { increment: 8 }, quantityAvailable: { decrement: 8 }, version: { increment: 1 } } });
      await assert.rejects(writeSyncedInventory(tx, balance, identity, { quantityOnHand: 10, quantityAvailable: 10 }, 0), /changed during sync/);
      const reserved = await tx.inventoryBalance.findUniqueOrThrow({ where: { id: balance.id } });
      assert.equal(reserved.quantityReserved.toString(), "8"); assert.equal(reserved.quantityAvailable.toString(), "2");
      await writeSyncedInventory(tx, reserved, identity, { quantityOnHand: 10, quantityAvailable: 2 }, 0);
      console.log("Security nine PostgreSQL PASS: processing exclusion, pending budget, durable recovery, replay, sequential refunds, stale budget, cross-allocation denial, reconciliation projection, ERP version conflict/control; fixtures rolled back");
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) { if (error !== rollback) throw error; }
}
