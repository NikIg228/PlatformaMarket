import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { commerce } from "./verify-checkout-snapshot.mjs";

const require = createRequire(import.meta.url);
const domain = (path, name) => require(`../../apps/api/dist/src/modules/${path}`)[name];

export async function verifyLotEligibility({ prisma, offers, supplierId, createBuyer, createCartWithItem, runId, assert }) {
  const Access = domain("suppliers/supplier-access.service.js", "SupplierAccessService");
  const Inventory = domain("inventory/inventory.service.js", "InventoryService");
  const Freshness = domain("inventory/data-freshness.service.js", "DataFreshnessService");
  const Permissions = domain("access-control/access-control.service.js", "AccessControlService");
  const Workflow = domain("commerce/order-workflow.service.js", "OrderWorkflowService");
  const Logistics = domain("logistics/logistics.service.js", "LogisticsService");
  const access = new Access(prisma);
  const inventory = new Inventory(prisma, access, new Freshness(prisma, access));
  const workflow = new Workflow(prisma, new Permissions(prisma));
  const logistics = new Logistics(prisma, access);
  const buyer = await createBuyer(80);
  const buyerContext = { actorId: buyer.userId, organizationId: buyer.organizationId };
  const supplierContext = { actorId: buyer.userId, organizationId: supplierId };
  const role = await prisma.role.create({ data: { organizationId: supplierId, code: runId, name: "Synthetic lot test supplier",
    permissions: { create: ["order.confirm", "payment.transfer.confirm"].map(code => ({ permission: { connect: { code } } })) } } });
  await prisma.organizationMembership.create({ data: { userId: buyer.userId, organizationId: supplierId, status: "ACTIVE",
    roles: { create: { roleId: role.id } } } });
  const conflict = async (action, label) => {
    let error;
    try { await action(); } catch (caught) { error = caught; }
    assert(error?.getStatus?.() === 409, `${label}: expected domain conflict, got ${error?.message ?? "success"}`);
  };
  const recall = lotId => inventory.recallLot(supplierId, { inventoryLotId: lotId, reason: "Synthetic regression", source: "SUPPLIER", severity: "HIGH" }, supplierContext);
  const cases = [];
  for (const [index, offer] of offers.entries()) {
    const cart = await createCartWithItem(buyer, offer.offerId, 1);
    const checkout = await commerce(prisma).checkout(cart.id, { idempotencyKey: `${runId}-lot-${index}` }, buyerContext);
    const order = checkout.supplierOrders[0];
    const item = order.items[0];
    // Targeted consume fixture: invoice upload is tested separately. These UUID
    // references have no document FK and do not represent real payment evidence.
    await prisma.supplierOrderItem.update({ where: { id: item.id }, data: { acceptedQuantity: 1 } });
    await prisma.supplierOrder.update({ where: { id: order.id }, data: { status: "AWAITING_PAYMENT" } });
    const claim = await prisma.orderTransferClaim.create({ data: { supplierOrderId: order.id, invoiceDocumentId: randomUUID(),
      documentId: randomUUID(), amountMinor: order.subtotalAmountMinor, currency: "KZT", paidAt: new Date(), comment: "Synthetic targeted consume fixture" } });
    const command = { action: "CONFIRM_TRANSFER", claimId: claim.id, expectedVersion: order.version, idempotencyKey: `${runId}-consume-${index}` };
    cases.push({ ...offer, order, item, command });
  }
  const [recalled, expired, paid, planned] = cases;
  // Real overlapping transactions: commit recall after consume reads ACTIVE,
  // before it acquires inventory locks. Every query still reaches PostgreSQL.
  let barrierReached = false;
  const racingPrisma = new Proxy(prisma, { get(target, key) {
    if (key !== "$transaction") return Reflect.get(target, key);
    return (callback, options) => target.$transaction(tx => callback(new Proxy(tx, { get(client, property) {
      if (property !== "supplierOrder") return Reflect.get(client, property);
      return new Proxy(client.supplierOrder, { get(model, operation) {
        if (operation !== "findUniqueOrThrow") return Reflect.get(model, operation);
        return async args => {
          const order = await model.findUniqueOrThrow(args);
          if (!barrierReached) { barrierReached = true; await recall(recalled.lotId); }
          return order;
        };
      } });
    } })), options);
  } });
  await conflict(() => new Workflow(racingPrisma, new Permissions(prisma)).execute(recalled.order.id, recalled.command, supplierContext), "Recall racing payment");
  assert(barrierReached, "Recall/consume barrier was not exercised");
  await prisma.inventoryLot.update({ where: { id: expired.lotId }, data: { expirationDate: new Date(Date.now() - 1000) } });
  await conflict(() => workflow.execute(expired.order.id, expired.command, supplierContext), "Expiry while status remains ACTIVE");
  for (const test of [recalled, expired]) {
    const order = await prisma.supplierOrder.findUniqueOrThrow({ where: { id: test.order.id }, include: { transferClaims: true } });
    assert(order.paymentStatus === "UNPAID" && order.transferClaims[0].status === "PENDING", "Failed consume partially confirmed payment");
    const reservation = await prisma.inventoryReservation.findUniqueOrThrow({ where: { supplierOrderItemId: test.item.id } });
    assert(reservation.status === "ACTIVE", "Failed consume changed reservation");
    await inventory.releaseReservation(reservation.id, supplierContext);
    const lot = await prisma.inventoryLot.findUniqueOrThrow({ where: { id: test.lotId } });
    const balance = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: test.balanceId } });
    assert(lot.quantityAvailable.eq(0) && balance.quantityAvailable.eq(0), "Release restored unusable stock");
  }
  for (const test of [paid, planned]) {
    const result = await workflow.execute(test.order.id, test.command, supplierContext);
    const replay = await workflow.execute(test.order.id, test.command, supplierContext);
    assert(result.paymentStatus === "PAID" && replay.eventId === result.eventId, "Valid consume/replay failed");
    assert((await prisma.inventoryLot.findUniqueOrThrow({ where: { id: test.lotId } })).status === "DEPLETED", "Fully consumed lot should deplete");
  }
  const shipmentInput = test => ({ warehouseId: test.item.warehouseId, method: "PICKUP", recipientName: "Synthetic recipient", fulfillmentSteps: [],
    items: [{ supplierOrderItemId: test.item.id, quantity: 1 }] });
  const shipment = await logistics.createShipment(planned.order.id, shipmentInput(planned), supplierContext);
  const plan = await logistics.transitionShipment(shipment.id, { status: "PLANNED", version: shipment.version }, supplierContext);
  const packing = await logistics.transitionShipment(shipment.id, { status: "PACKING", version: plan.version }, supplierContext);
  const ready = await logistics.transitionShipment(shipment.id, { status: "READY", version: packing.version }, supplierContext);
  for (const test of [paid, planned]) {
    const result = await recall(test.lotId);
    assert(result.affectedReservationIds.length === 1, "Recall omitted consumed reservation");
  }
  await conflict(() => logistics.createShipment(paid.order.id, shipmentInput(paid), supplierContext), "Recall after payment before shipment");
  await conflict(() => logistics.transitionShipment(shipment.id, { status: "DISPATCHED", version: ready.version }, supplierContext), "Recall after READY before dispatch");
  assert((await prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } })).status === "READY", "Blocked dispatch changed shipment");
  // Even stale aggregate availability must not turn tracked stock into lotless stock.
  await prisma.inventoryBalance.update({ where: { id: expired.balanceId }, data: { quantityAvailable: 1, availabilityStatus: "IN_STOCK" } });
  await conflict(() => commerce(prisma).resolveOffer(buyer.organizationId, expired.offerId, 1, buyerContext), "Expired tracked stock must not become lotless");
  console.log("Lot eligibility: real PostgreSQL recall/expiry consume rollback, release, paid recall, dispatch and replay PASS");
}
