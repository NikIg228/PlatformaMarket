import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { commerce } from "./verify-checkout-snapshot.mjs";
const require = createRequire(import.meta.url);
const domain = (path, name) => require(`../../apps/api/dist/src/modules/${path}`)[name];

export async function verifyReservationExpiry({ prisma, offers, supplierId, createBuyer, createCartWithItem, runId, assert }) {
  const Access = domain("suppliers/supplier-access.service.js", "SupplierAccessService");
  const Inventory = domain("inventory/inventory.service.js", "InventoryService");
  const Freshness = domain("inventory/data-freshness.service.js", "DataFreshnessService");
  const Permissions = domain("access-control/access-control.service.js", "AccessControlService");
  const Workflow = domain("commerce/order-workflow.service.js", "OrderWorkflowService");
  const Expiry = domain("inventory/reservation-expiry.service.js", "ReservationExpiryService");
  const access = new Access(prisma), inventory = new Inventory(prisma, access, new Freshness(prisma, access));
  // No queue needed for direct invocation; registration/scheduling use the
  // existing runtime service and are checked by the runtime/unit gates.
  const expiry = new Expiry(prisma, inventory, {});
  const workflow = new Workflow(prisma, new Permissions(prisma));
  const buyer = await createBuyer(86);
  const buyerContext = { actorId: buyer.userId, organizationId: buyer.organizationId };
  const supplierContext = { actorId: buyer.userId, organizationId: supplierId };
  const buyerRole = await prisma.role.findFirstOrThrow({ where: { organizationId: buyer.organizationId } });
  await prisma.rolePermission.create({ data: { role: { connect: { id: buyerRole.id } }, permission: { connect: { code: "order.approve" } } } });
  const role = await prisma.role.create({ data: { organizationId: supplierId, code: `${runId}-expiry`, name: "Synthetic expiry supplier",
    permissions: { create: ["order.confirm", "payment.transfer.confirm"].map(code => ({ permission: { connect: { code } } })) } } });
  await prisma.organizationMembership.create({ data: { userId: buyer.userId, organizationId: supplierId, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
  const cases = [];
  const deadline = new Date(Date.now() - 1000);
  for (const [index, offer] of offers.entries()) {
    const cart = await createCartWithItem(buyer, offer.offerId, 1);
    const checkout = await commerce(prisma).checkout(cart.id, { idempotencyKey: `${runId}-expiry-${index}` }, buyerContext);
    const order = checkout.supplierOrders[0], item = order.items[0];
    const reservation = await prisma.inventoryReservation.update({ where: { supplierOrderItemId: item.id }, data: { expiresAt: deadline } });
    cases.push({ ...offer, order, item, reservation });
  }
  const [boundary, pending, information, cancelled, recalled, crash, external] = cases;
  assert(!await expiry.expireOrder(boundary.order.id, new Date(deadline.getTime() - 1)), "Expiry ran before the deadline");
  let lateConfirmation;
  try { await commerce(prisma).confirmSupplierOrder(boundary.order.id, { decisions: [{ itemId: boundary.item.id, acceptedQuantity: 1 }] }, supplierContext); }
  catch (error) { lateConfirmation = error; }
  assert(lateConfirmation?.getStatus?.() === 409, "Supplier confirmation revived an expired local reservation");
  const parallel = await Promise.all([expiry.expireOrder(boundary.order.id, deadline), expiry.expireOrder(boundary.order.id, deadline)]);
  assert(parallel.filter(Boolean).length === 1, "Concurrent expiry did not have exactly one winner");
  assert(!await expiry.expireOrder(boundary.order.id, new Date(deadline.getTime() + 1)), "Expiry replay ran twice");
  assert((await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: boundary.reservation.id } })).status === "EXPIRED", "Expired reservation has wrong terminal state");
  const releasedBalance = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: boundary.balanceId } });
  assert(releasedBalance.quantityAvailable.eq(10) && releasedBalance.quantityReserved.eq(0), "Concurrent expiry returned stock twice");
  assert(await prisma.auditLog.count({ where: { action: "order.reservation.expired", entityId: boundary.order.id } }) === 1, "Expiry audit duplicated");
  const cancellations = id => prisma.commerceMetricEvent.count({ where: { supplierOrderId: id, kind: "CANCELLED" } });
  assert(await cancellations(boundary.order.id) === 1, "Concurrent expiry/replay lost or duplicated cancellation metric");
  for (const [value, status] of [[pending, "PENDING"], [information, "NEEDS_INFORMATION"]]) {
    await prisma.supplierOrder.update({ where: { id: value.order.id }, data: { status: "AWAITING_PAYMENT" } });
    await prisma.supplierOrderItem.update({ where: { id: value.item.id }, data: { acceptedQuantity: 1 } });
    value.claim = await prisma.orderTransferClaim.create({ data: { supplierOrderId: value.order.id, invoiceDocumentId: randomUUID(), documentId: randomUUID(), status,
      amountMinor: value.order.subtotalAmountMinor, currency: "KZT", paidAt: new Date(), comment: "Synthetic held transfer" } });
    assert(!await expiry.expireOrder(value.order.id, deadline), "Declared transfer lost its hold");
    assert((await workflow.get(value.order.id, buyerContext)).reservationState.status === "HELD_TRANSFER", "UI contract does not explain held transfer");
  }
  const confirmation = { action: "CONFIRM_TRANSFER", claimId: pending.claim.id, expectedVersion: pending.order.version, idempotencyKey: randomUUID() };
  const paidRace = await Promise.all([expiry.expireOrder(pending.order.id, deadline), workflow.execute(pending.order.id, confirmation, supplierContext)]);
  assert(paidRace[0] === false && paidRace[1].status === "PAID", "Expiry raced a protected payment incorrectly");
  assert((await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: pending.reservation.id } })).status === "CONSUMED", "Protected payment did not consume its reserve");
  const cancelRace = await Promise.allSettled([
    expiry.expireOrder(cancelled.order.id, deadline),
    workflow.execute(cancelled.order.id, { action: "CANCEL", expectedVersion: cancelled.order.version, idempotencyKey: randomUUID(), reason: "Synthetic cancel race", transferNotMade: true }, buyerContext),
  ]);
  for (const result of cancelRace) if (result.status === "rejected") assert(result.reason?.getStatus?.() === 409, "Unexpected cancel/expiry failure");
  const cancelledBalance = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: cancelled.balanceId } });
  assert(cancelledBalance.quantityAvailable.eq(10) && cancelledBalance.quantityReserved.eq(0), "Cancel/expiry returned inventory twice");
  assert(await cancellations(cancelled.order.id) === 1, "Cancel/expiry race lost or duplicated cancellation metric");
  await inventory.recallLot(supplierId, { inventoryLotId: recalled.lotId, reason: "Synthetic expiry recall", source: "SUPPLIER", severity: "HIGH" }, supplierContext);
  assert(await expiry.expireOrder(recalled.order.id, deadline), "Recalled reserve was not released");
  const recalledBalance = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: recalled.balanceId } });
  assert(recalledBalance.quantityAvailable.eq(0) && recalledBalance.quantityReserved.eq(0), "Expiry restored recalled inventory");
  // Simulate a crash after writes, before transaction commit. Every write is
  // still real PostgreSQL; only the final outbox call deliberately throws.
  const crashingPrisma = new Proxy(prisma, { get(target, key) {
    if (key !== "$transaction") return Reflect.get(target, key);
    return (callback, options) => target.$transaction(tx => callback(new Proxy(tx, { get(client, property) {
      if (property !== "outboxEvent") return Reflect.get(client, property);
      return new Proxy(client.outboxEvent, { get(model, operation) {
        if (operation !== "create") return Reflect.get(model, operation);
        return args => { if (args.data.eventType === "OrderReservationExpired") throw new Error("Synthetic worker crash before commit"); return model.create(args); };
      } });
    } })), options);
  } });
  let crashError;
  try { await new Expiry(crashingPrisma, inventory, {}).expireOrder(crash.order.id, deadline); } catch (error) { crashError = error; }
  assert(crashError?.message === "Synthetic worker crash before commit", "Crash barrier not reached");
  assert((await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: crash.reservation.id } })).status === "ACTIVE", "Crash committed partial release");
  assert((await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: crash.balanceId } })).quantityReserved.eq(1), "Crash lost held stock");
  assert(await cancellations(crash.order.id) === 0, "Crash committed cancellation metric outside transaction");
  assert(await expiry.expireOrder(crash.order.id, deadline), "Worker could not recover after crash");
  assert(await cancellations(crash.order.id) === 1, "Worker recovery did not record cancellation metric once");
  const source = await prisma.supplierDataSource.create({ data: { supplierOrganizationId: supplierId, name: `${runId}-expiry-external`, type: "API" } });
  const connection = await prisma.integrationConnection.create({ data: { supplierOrganizationId: supplierId, sourceId: source.id, provider: "MOCK", mode: "API", status: "PAUSED", displayName: "Synthetic external hold" } });
  try {
    await prisma.externalReservation.create({ data: { inventoryReservationId: external.reservation.id, connectionId: connection.id, status: "ACTIVE", idempotencyKey: `${runId}-external` } });
    assert(!await expiry.expireOrder(external.order.id, deadline), "Worker released an external hold");
    const standalone = await inventory.reserve(supplierId, external.balanceId, { quantity: 1, idempotencyKey: `${runId}-standalone`, ttlMinutes: 30, inventoryLotId: external.lotId }, supplierContext);
    await prisma.inventoryReservation.update({ where: { id: standalone.id }, data: { expiresAt: deadline } });
    assert(await expiry.expireStandalone(standalone.id, deadline), "Standalone reserve did not expire");
    assert(!await expiry.expireStandalone(standalone.id, deadline), "Standalone reserve expired twice");
    const batch = await expiry.expireBatch(deadline, 25, supplierId);
    assert(batch.orders === 0 && batch.standalone === 0, "Batch retried completed or held fixtures");
    assert((await prisma.inventoryReservation.findUniqueOrThrow({ where: { id: external.reservation.id } })).status === "ACTIVE", "Batch released external hold");
  } finally {
    await prisma.externalReservation.deleteMany({ where: { connectionId: connection.id } });
    await prisma.integrationConnection.delete({ where: { id: connection.id } });
    await prisma.supplierDataSource.delete({ where: { id: source.id } });
  }
  console.log("Reservation expiry: boundary/concurrent worker, transfer/clarification holds, confirm/cancel race, recall, crash rollback/retry, external and standalone PASS");
}
