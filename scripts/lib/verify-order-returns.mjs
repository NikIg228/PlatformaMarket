import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { commerce } from "./verify-checkout-snapshot.mjs";
const require = createRequire(import.meta.url);

export async function verifyOrderReturns({ prisma, workflow, cases, execute, proof, buyerContext, supplierContext, reject, assert, request, buyer }) {
  const Logistics = require("../../apps/api/dist/src/modules/logistics/logistics.service.js").LogisticsService;
  const logistics = new Logistics(prisma);
  const [paid, cancellation, , , rejected, race] = cases;
  const read = value => workflow.get(value.order.id, buyerContext);
  const latestReturn = async value => (await read(value)).returns.at(-1);
  const command = async (value, action) => ({ ...action, expectedVersion: (await read(value)).version, idempotencyKey: randomUUID() });
  const refund = async (value, record) => {
    await reject(() => execute(value, { action: "RECEIVE_MANUAL_REFUND", returnId: record.id }, buyerContext), 409, "Receipt before sent");
    const badProof = await proof(value, record.amountMinor.toString());
    await reject(() => execute(value, { action: "SEND_MANUAL_REFUND", returnId: record.id, documentId: badProof.id }), 409, "Buyer receipt used for refund");
    const doc = await proof(value, record.amountMinor.toString(), supplierContext.organizationId);
    await execute(value, { action: "SEND_MANUAL_REFUND", returnId: record.id, documentId: doc.id });
    assert((await latestReturn(value)).status === "REFUND_SENT", "Supplier fabricated refund receipt");
    await reject(() => execute(value, { action: "RECEIVE_MANUAL_REFUND", returnId: record.id }), 403, "Supplier received own refund");
    const receive = await command(value, { action: "RECEIVE_MANUAL_REFUND", returnId: record.id });
    const results = await Promise.all([workflow.execute(value.order.id, receive, buyerContext), workflow.execute(value.order.id, receive, buyerContext)]);
    assert(results[0].eventId === results[1].eventId && (await latestReturn(value)).status === "REFUND_RECEIVED", "Refund receipt replay failed");
  };
  await execute(paid, { action: "REQUEST_RETURN", kind: "OVERPAYMENT", reason: "Synthetic overpayment", items: [] }, buyerContext);
  const extra = await latestReturn(paid);
  assert(extra.amountMinor.eq(2), "Wrong exact overpayment amount");
  await reject(() => execute(paid, { action: "DECIDE_RETURN", returnId: extra.id, accepted: true, reason: "Synthetic accept" }, buyerContext), 403, "Buyer accepted own refund");
  await execute(paid, { action: "DECIDE_RETURN", returnId: extra.id, accepted: true, reason: "Synthetic accept" });
  await refund(paid, extra);
  await reject(() => execute(paid, { action: "REQUEST_RETURN", kind: "OVERPAYMENT", reason: "Duplicate overpayment", items: [] }, buyerContext), 409, "Refunding same excess twice");

  await execute(cancellation, { action: "REQUEST_RETURN", kind: "CANCELLATION", reason: "Synthetic cancellation", items: [] }, buyerContext);
  const cancel = await latestReturn(cancellation);
  await execute(cancellation, { action: "DECIDE_RETURN", returnId: cancel.id, accepted: true, reason: "Supplier stopped packing" });
  assert((await read(cancellation)).status === "CANCELLED", "Accepted cancellation did not stop order");
  const balance = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: cancellation.balanceId } });
  assert(balance.quantityOnHand.eq(10) && balance.quantityAvailable.eq(10) && balance.quantityReserved.eq(0), "Cancelled paid stock was not restored exactly once");
  await refund(cancellation, cancel);
  assert((await read(cancellation)).paymentStatus === "REFUNDED", "Complete cancelled refund not recorded");

  await execute(rejected, { action: "REQUEST_RETURN", kind: "CANCELLATION", reason: "Synthetic rejected cancellation", items: [] }, buyerContext);
  const denied = await latestReturn(rejected);
  await execute(rejected, { action: "DECIDE_RETURN", returnId: denied.id, accepted: false, reason: "Cannot stop preparation" });
  assert((await read(rejected)).status === "PAID", "Rejected cancellation changed paid order");

  const create = async (value, quantity, installation = false) => logistics.createShipment(value.order.id, { warehouseId: value.order.items[0].warehouseId,
    method: "SUPPLIER_CITY", recipientName: "Synthetic buyer", items: [{ supplierOrderItemId: value.item.id, quantity }], fulfillmentSteps: installation ? [{ type: "DELIVERY" }, { type: "INSTALLATION" }] : [] }, supplierContext);
  const transit = async (shipment, target) => {
    const current = await prisma.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
    return logistics.transitionShipment(shipment.id, { version: current.version, status: target }, supplierContext);
  };
  const send = async shipment => { for (const state of ["PLANNED", "PACKING", "READY", "DISPATCHED"]) await transit(shipment, state); };
  const first = await create(paid, 1), second = await create(paid, 1, true);
  await reject(() => create(paid, 1), 409, "Overship accepted quantity");
  await send(first);
  await execute(paid, { action: "RECEIVE_SHIPMENT", shipmentId: first.id, items: [{ shipmentItemId: first.items[0].id, deliveredQuantity: "0.5" }] }, buyerContext);
  await reject(() => execute(paid, { action: "RECEIVE_SHIPMENT", shipmentId: first.id, items: [{ shipmentItemId: first.items[0].id, deliveredQuantity: "0.4" }] }, buyerContext), 409, "Receipt decreased");
  await execute(paid, { action: "RECEIVE_SHIPMENT", shipmentId: first.id, items: [{ shipmentItemId: first.items[0].id, deliveredQuantity: "1" }] }, buyerContext);
  await send(second);
  assert((await read(paid)).status === "PARTIALLY_FULFILLED", "Second shipment regressed order progress");
  await reject(() => logistics.transitionFulfillmentStep(second.fulfillmentSteps[0].id, { status: "COMPLETED" }, supplierContext), 409, "Supplier fabricated goods receipt");
  await execute(paid, { action: "RECEIVE_SHIPMENT", shipmentId: second.id, items: [{ shipmentItemId: second.items[0].id, deliveredQuantity: "1" }] }, buyerContext);
  assert((await read(paid)).status === "PARTIALLY_FULFILLED", "Order closed before installation");
  const installation = second.fulfillmentSteps[1];
  await logistics.transitionFulfillmentStep(installation.id, { status: "IN_PROGRESS" }, supplierContext);
  await logistics.transitionFulfillmentStep(installation.id, { status: "COMPLETED" }, supplierContext);
  assert((await read(paid)).status === "DELIVERED", "Last fulfillment did not close received order");
  await reject(() => execute(paid, { action: "REQUEST_RETURN", kind: "CANCELLATION", reason: "Too late cancellation", items: [] }, buyerContext), 409, "Cancellation after dispatch");

  await execute(paid, { action: "REQUEST_RETURN", kind: "GOODS", reason: "Synthetic return", items: [{ orderItemId: paid.item.id, quantity: "1", condition: "Unopened packaging" }] }, buyerContext);
  const goods = await latestReturn(paid);
  assert(goods.amountMinor.eq("4503599627370497"), "Goods refund lost exact amount");
  await execute(paid, { action: "DECIDE_RETURN", returnId: goods.id, accepted: true, reason: "Accepted quantity and condition" });
  const earlyDoc = await proof(paid, goods.amountMinor.toString(), supplierContext.organizationId);
  await reject(() => execute(paid, { action: "SEND_MANUAL_REFUND", returnId: goods.id, documentId: earlyDoc.id }), 409, "Money returned before agreed goods received");
  await execute(paid, { action: "SEND_RETURN_GOODS", returnId: goods.id }, buyerContext);
  await execute(paid, { action: "RECEIVE_RETURN_GOODS", returnId: goods.id });
  assert((await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: paid.balanceId } })).quantityAvailable.eq(8), "Returned goods silently restocked");
  await refund(paid, goods);
  await reject(() => execute(paid, { action: "REQUEST_RETURN", kind: "GOODS", reason: "Too much returned", items: [{ orderItemId: paid.item.id, quantity: "2", condition: "Unopened packaging" }] }, buyerContext), 409, "Return exceeds remaining quantity");
  const response = await request(`/supplier-orders/${paid.order.id}/workflow`, { identity: buyer });
  assert(response.status === 200 && response.body.returns.at(-1).status === "REFUND_RECEIVED", "Return HTTP read contract");

  // Changed terms must still block checkout of the new purchase intention.
  const repeat = await command(paid, { action: "REORDER" });
  const repeated = await workflow.execute(paid.order.id, repeat, buyerContext);
  const replay = await workflow.execute(paid.order.id, repeat, buyerContext);
  assert(repeated.cartId && replay.cartId === repeated.cartId, "Reorder replay created another cart");
  await prisma.offerPrice.updateMany({ where: { offerId: paid.offerId }, data: { amountMinor: "4503599627370500" } });
  const validation = await commerce(prisma).validateCart(repeated.cartId, buyerContext);
  assert(validation.requiresAcceptance && !validation.canCheckout, "Reorder bypassed current price acceptance");
  await reject(() => execute(cancellation, { action: "REORDER" }, buyerContext), 409, "Reorder overwrote active cart");

  // Dispatch after request must prevent supplier approval from cancelling shipped goods.
  await execute(race, { action: "REQUEST_RETURN", kind: "CANCELLATION", reason: "Cancellation before dispatch race", items: [] }, buyerContext);
  const pending = await latestReturn(race);
  const shipment = await create(race, 1);
  await send(shipment);
  await reject(() => execute(race, { action: "DECIDE_RETURN", returnId: pending.id, accepted: true, reason: "Stale stopping decision" }), 409, "Dispatch/cancellation race");
  assert((await latestReturn(race)).status === "REQUESTED" && (await read(race)).status === "SHIPPED", "Failed cancellation partially committed");
  console.log("CORE03: split/partial receipt, installation closure, refund stages/authority/exact amounts/replay, cancellation stock/race, revalidated reorder PASS");
}
