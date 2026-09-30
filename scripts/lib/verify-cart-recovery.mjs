import { commerce } from "./verify-checkout-snapshot.mjs";

export async function verifyCartRecovery({ prisma, offers, createBuyer, createCartWithItem, request, runId, assert }) {
  const buyer = await createBuyer(84);
  const foreign = await createBuyer(85);
  const context = { actorId: buyer.userId, organizationId: buyer.organizationId };
  const source = await createCartWithItem(buyer, offers[0].offerId, 1);
  assert((await request(`/carts/${source.id}/items`, { method: "POST", identity: buyer, body: { offerId: offers[1].offerId, quantity: 1 } })).status === 201, "Recovery fixture second item failed");
  const service = commerce(prisma);
  const reserve = service.inventory.reserveForOrder.bind(service.inventory);
  let calls = 0;
  let unavailableBalance;
  service.inventory.reserveForOrder = async (...args) => {
    calls += 1;
    if (calls === 2) {
      unavailableBalance = args[1];
      // Real concurrent stock loss after checkout has resolved both lines.
      await prisma.inventoryBalance.update({ where: { id: unavailableBalance }, data: { quantityOnHand: 0, quantityAvailable: 0, version: { increment: 1 } } });
      await prisma.inventoryLot.updateMany({ where: { inventoryBalanceId: unavailableBalance }, data: { quantityOnHand: 0, quantityAvailable: 0 } });
    }
    return reserve(...args);
  };
  let failure;
  try { await service.checkout(source.id, { idempotencyKey: `${runId}-recovery-source` }, context); }
  catch (error) { failure = error; }
  assert(failure?.getStatus?.() === 409 && calls === 2, "Fixture must fail after one real successful reserve");
  const failed = await prisma.cart.findUniqueOrThrow({ where: { id: source.id }, include: { checkout: { include: { supplierOrders: { include: { items: { include: { reservation: true } } } } } }, items: true } });
  assert(failed.status === "ABANDONED" && failed.checkout.status === "FAILED" && failed.items.length === 2, "Compensation lost failed cart history");
  const reservations = failed.checkout.supplierOrders.flatMap(order => order.items.flatMap(item => item.reservation ? [item.reservation] : []));
  assert(reservations.length === 1 && reservations[0].status === "RELEASED", "Partial checkout did not release its successful reservation");
  const firstBalance = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: reservations[0].inventoryBalanceId } });
  assert(firstBalance.quantityReserved.eq(0) && firstBalance.quantityAvailable.eq(10), "Compensation did not restore the first balance exactly once");
  const route = `/carts/${source.id}/recover`;
  const body = { expectedVersion: failed.version };
  assert((await request(route, { method: "POST", identity: foreign, body })).status === 403, "Foreign tenant recovered a cart");
  assert((await request(route, { method: "POST", identity: buyer, body: { expectedVersion: failed.version - 1 } })).status === 409, "Stale recovery version accepted");
  await prisma.inventoryReservation.update({ where: { id: reservations[0].id }, data: { status: "ACTIVE" } });
  assert((await request(route, { method: "POST", identity: buyer, body })).status === 409, "Recovery ignored unresolved compensation");
  await prisma.inventoryReservation.update({ where: { id: reservations[0].id }, data: { status: "RELEASED" } });
  const availableOffer = offers.find(offer => offer.balanceId !== unavailableBalance);
  const current = await createCartWithItem(buyer, availableOffer.offerId, 1);
  assert((await request(route, { method: "POST", identity: buyer, body })).status === 409, "Recovery overwrote a nonempty current cart");
  const currentCart = await prisma.cart.findUniqueOrThrow({ where: { id: current.id }, include: { items: true } });
  const removed = await request(`/carts/${current.id}/items/${currentCart.items[0].id}`, { method: "DELETE", identity: buyer, body: { expectedVersion: currentCart.version } });
  assert(removed.status === 200, "Could not empty the current fixture cart");
  await prisma.offerPrice.updateMany({ where: { offerId: availableOffer.offerId, status: "ACTIVE" }, data: { amountMinor: { increment: 500 } } });
  const [left, right] = await Promise.all([request(route, { method: "POST", identity: buyer, body }), request(route, { method: "POST", identity: buyer, body })]);
  assert(left.status === 201 && right.status === 201 && left.body.id === right.body.id, "Concurrent recovery created different carts or failed to replay");
  const recovered = left.body;
  assert(recovered.id !== source.id && recovered.items.length === 2 && recovered.checkout === null, "Recovery must preserve every intention in a new cart");
  assert(await prisma.auditLog.count({ where: { entityId: recovered.id, action: "cart.recovered" } }) === 1, "Recovery duplicated its audit effect");
  assert(await prisma.outboxEvent.count({ where: { aggregateId: recovered.id, eventType: "CartRecovered" } }) === 1, "Recovery duplicated its outbox effect");
  const listed = await request(`/buyers/${buyer.organizationId}/carts`, { identity: buyer });
  assert(listed.body.find(cart => cart.id === source.id).recoveredCartId === recovered.id, "Failed history lacks the recovery link");
  const validated = await request(`/carts/${recovered.id}/validate`, { method: "POST", identity: buyer });
  assert(validated.body.items.length === 2 && validated.body.requiresAcceptance && !validated.body.canCheckout, "Recovery hid changed price/unavailable stock");
  assert((await request(`/carts/${recovered.id}/checkout`, { method: "POST", identity: buyer, body: { idempotencyKey: `${runId}-unsafe-recovery`, expectedVersion: recovered.version } })).status === 409, "Recovered cart bypassed revalidation");
  // Remove only through an explicit buyer action, then accept the displayed price.
  const unavailableItem = recovered.items.find(item => item.offerId !== availableOffer.offerId);
  assert((await request(`/carts/${recovered.id}/items/${unavailableItem.id}`, { method: "DELETE", identity: buyer, body: { expectedVersion: recovered.version } })).status === 200, "Explicit unavailable-item removal failed");
  const shown = (await request(`/carts/${recovered.id}/validate`, { method: "POST", identity: buyer })).body;
  const repriced = await request(`/carts/${recovered.id}/reprice`, { method: "POST", identity: buyer, body: { expectedVersion: shown.cartVersion, acceptedItems: shown.items.map(item => ({ cartItemId: item.cartItemId, snapshot: item.current })) } });
  assert(repriced.status === 201, "Recovery price acceptance failed");
  const checkout = await request(`/carts/${recovered.id}/checkout`, { method: "POST", identity: buyer, body: { expectedVersion: repriced.body.version, idempotencyKey: `${runId}-recovered-checkout` } });
  assert(checkout.status === 201 && checkout.body.status === "COMPLETED", "Validated recovered cart cannot checkout");
  const replay = await request(route, { method: "POST", identity: buyer, body });
  assert(replay.status === 201 && replay.body.id === recovered.id && replay.body.status === "CHECKED_OUT", "Later replay created another purchase intention");
  assert(await prisma.inventoryReservation.count({ where: { supplierOrderItem: { supplierOrder: { checkoutId: checkout.body.id } } } }) === 1, "Recovery duplicated new reservations");
  assert((await prisma.cart.findUniqueOrThrow({ where: { id: source.id } })).status === "ABANDONED", "Recovery rewrote original history");
  console.log("Cart recovery: partial compensation, tenant, stale/hold guards, concurrent permanent replay, changed price/unavailable row and new checkout PASS");
}
