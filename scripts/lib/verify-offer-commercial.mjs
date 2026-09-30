import { isDeepStrictEqual } from "node:util";

export async function verifyOfferCommercial({ prisma, offer, supplierId, fixture, createBuyer, request, runId, assert }) {
  const actor = await createBuyer(81);
  const limited = await createBuyer(82);
  const outsider = await createBuyer(83);
  const grant = async (userId, codes, suffix) => {
    const role = await prisma.role.create({ data: { organizationId: supplierId, code: `${runId}-${suffix}`, name: "Commercial fixture",
      permissions: { create: codes.map(code => ({ permission: { connect: { code } } })) } } });
    await prisma.organizationMembership.create({ data: { userId, organizationId: supplierId, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
    return { userId, organizationId: supplierId };
  };
  const identity = await grant(actor.userId, ["catalog.product.view", "pricing.manage", "inventory.adjust"], "editor");
  const priceOnly = await grant(limited.userId, ["catalog.product.view", "pricing.manage"], "limited");
  const foreignRole = await prisma.role.findFirstOrThrow({ where: { organizationId: outsider.organizationId } });
  const foreignPermissions = await prisma.permission.findMany({ where: { code: { in: ["catalog.product.view", "pricing.manage", "inventory.adjust"] } } });
  await prisma.rolePermission.createMany({ data: foreignPermissions.map(permission => ({ roleId: foreignRole.id, permissionId: permission.id })), skipDuplicates: true });
  const balance = await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: offer.balanceId } });
  const route = `/suppliers/${supplierId}/offers/${offer.offerId}/commercial`;
  const get = async warehouseId => {
    const response = await request(`${route}/${warehouseId}`, { identity });
    assert(response.status === 200, `Commercial GET failed: ${JSON.stringify(response.body)}`);
    return response.body;
  };
  const input = (state, key, changes = {}) => ({ warehouseId: state.warehouseId, expectedOfferVersion: state.offerVersion,
    expectedBalanceVersion: state.balance?.version ?? null, idempotencyKey: `${runId}-${key}`, amountMinor: state.price.amountMinor,
    currency: "KZT", includesVat: state.price.includesVat, vatRate: state.price.vatRate === null ? null : Number(state.price.vatRate),
    quantityOnHand: Number(state.balance?.quantityOnHand ?? 0), ...changes });
  const save = (body, who = identity) => request(route, { method: "PUT", identity: who, body });
  await prisma.inventoryBalance.update({ where: { id: balance.id }, data: { quantityReserved: 2, quantityAvailable: 8 } });
  const first = await get(balance.warehouseId);
  const initialHistory = await prisma.offerPriceHistory.count({ where: { offerId: offer.offerId } });
  const initialAudit = await prisma.auditLog.count({ where: { actorId: actor.userId } });
  const initialOutbox = await prisma.outboxEvent.count({ where: { aggregateId: { in: [offer.offerId, balance.id] } } });
  const rejected = await save(input(first, "invalid-stock", { amountMinor: "210000", quantityOnHand: 1 }));
  assert(rejected.status === 409, "Reserved inventory must reject the whole commercial write");
  assert(JSON.stringify(await get(balance.warehouseId)) === JSON.stringify(first), "Stock failure partially changed price/version/balance");
  assert(await prisma.offerPriceHistory.count({ where: { offerId: offer.offerId } }) === initialHistory, "Rollback retained price history");
  assert(await prisma.auditLog.count({ where: { actorId: actor.userId } }) === initialAudit, "Rollback retained audit effects");
  assert(await prisma.outboxEvent.count({ where: { aggregateId: { in: [offer.offerId, balance.id] } } }) === initialOutbox, "Rollback retained outbox effects");
  assert((await save(input(first, "missing-permission"), priceOnly)).status === 403, "Price-only actor changed stock");
  assert((await save(input(first, "foreign-tenant"), outsider)).status === 403, "Foreign tenant changed offer");
  assert((await request(`${route}/${balance.warehouseId}`, { identity: outsider })).status === 403, "Foreign tenant read commercial state");

  const command = input(first, "valid", { amountMinor: "210000", quantityOnHand: 8 });
  const saved = await save(command);
  assert(saved.status === 200 && saved.body.marketplaceVisible && saved.body.publicationStatus === "PUBLISHED", "Saving conditions changed existing publication");
  const replay = await save(command);
  assert(replay.status === 200, `Replay failed: ${JSON.stringify(replay.body)}`);
  assert(isDeepStrictEqual(replay.body, saved.body), "Replay changed the saved result");
  assert(await prisma.offerPriceHistory.count({ where: { offerId: offer.offerId } }) === initialHistory + 1, "Replay duplicated price history");
  assert((await save({ ...command, quantityOnHand: 7 })).status === 409, "Same replay key accepted another payload");
  const stale = await save(input(first, "stale", { amountMinor: "220000", quantityOnHand: 7 }));
  assert(stale.status === 409 && stale.body.code === "OFFER_COMMERCIAL_CHANGED", "Sequential stale editor overwrote a newer state");
  const race = await Promise.all([save(input(saved.body, "race-a", { amountMinor: "230000", quantityOnHand: 7 })),
    save(input(saved.body, "race-b", { amountMinor: "240000", quantityOnHand: 6 }))]);
  assert(race.filter(result => result.status === 200).length === 1 && race.filter(result => result.status === 409).length === 1,
    `Concurrent editors must yield one winner and one conflict: ${race.map(result => result.status)}`);
  const current = await get(balance.warehouseId);
  const warehouse = await prisma.warehouse.create({ data: { supplierOrganizationId: supplierId, code: `${runId}-commercial-b`, name: "Commercial second warehouse" } });
  const empty = await get(warehouse.id);
  assert(empty.balance === null, "New warehouse inherited another warehouse balance");
  const created = await save(input(empty, "new-warehouse", { quantityOnHand: 3 }));
  assert(created.status === 200 && created.body.balance.quantityOnHand === "3", "New warehouse balance creation failed");
  fixture.balanceIds.push(created.body.balance.id);
  const independent = await Promise.all([save(input(current, "independent-a", { quantityOnHand: 5 })),
    save(input(created.body, "independent-b", { quantityOnHand: 4 }))]);
  assert(independent.every(result => result.status === 200), "Unchanged shared price must allow independent warehouse versions");
  assert(independent.every(result => result.body.offerVersion === current.offerVersion), "Unchanged price needlessly invalidated other warehouse drafts");

  const legacyBefore = await get(balance.warehouseId);
  const legacyPrice = await request(`/suppliers/${supplierId}/offers/${offer.offerId}/price`, { method: "PUT", identity,
    body: { amountMinor: 250000, currency: "KZT", source: "MANUAL" } });
  assert(legacyPrice.status === 200, "Existing price writer failed");
  assert((await save(input(legacyBefore, "legacy-price-stale"))).status === 409, "Legacy price writer did not invalidate the editor snapshot");
  const stockBefore = await get(balance.warehouseId);
  const legacyStock = await request(`/suppliers/${supplierId}/inventory/balances`, { method: "PUT", identity,
    body: { warehouseId: balance.warehouseId, productVariantId: balance.productVariantId, offerId: offer.offerId, quantityOnHand: 4, source: "MANUAL" } });
  assert(legacyStock.status === 200, "Existing inventory writer failed");
  assert((await save(input(stockBefore, "legacy-stock-stale"))).status === 409, "Legacy stock writer did not invalidate the selected balance snapshot");
  await prisma.offerPublication.update({ where: { offerId: offer.offerId }, data: { status: "DRAFT", marketplaceVisible: false } });
  const draft = await save(input(await get(balance.warehouseId), "draft", { quantityOnHand: 3 }));
  assert(draft.status === 200 && !draft.body.marketplaceVisible && draft.body.publicationStatus === "DRAFT", "Saving draft silently published it");
  console.log("Offer commercial: atomic rollback incl. audit/outbox, tenant/permissions, stale/racing editors, replay, warehouse versions and publication PASS");
}
