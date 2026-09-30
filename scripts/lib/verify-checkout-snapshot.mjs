import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const serviceClass = (relative, name) => require(`../../apps/api/dist/src/modules/${relative}`)[name];

// Real domain services and PostgreSQL reads/writes. Dependencies outside this
// local fixture's lifecycle fail closed if unexpectedly reached.
export function commerce(prisma) {
  const unused = new Proxy({}, { get() { throw new Error("Unexpected external dependency in checkout snapshot fixture"); } });
  const Access = serviceClass("suppliers/supplier-access.service.js", "SupplierAccessService");
  const Freshness = serviceClass("inventory/data-freshness.service.js", "DataFreshnessService");
  const Inventory = serviceClass("inventory/inventory.service.js", "InventoryService");
  const External = serviceClass("integrations/external-reservations.service.js", "ExternalReservationsService");
  const Compliance = serviceClass("compliance/compliance.service.js", "ComplianceService");
  const Agreements = serviceClass("agreements/marketplace-agreements.service.js", "MarketplaceAgreementsService");
  const Terms = serviceClass("agreements/supplier-terms.service.js", "SupplierTermsService");
  const Legal = serviceClass("agreements/supplier-legal-documents.js", "SupplierLegalDocuments");
  const Commerce = serviceClass("commerce/commerce.service.js", "CommerceService");
  const access = new Access(prisma);
  return new Commerce(prisma, new Inventory(prisma, access, new Freshness(prisma, access)),
    new External(prisma, unused, unused), access, new Compliance(prisma, unused),
    new Agreements(prisma, unused, new Terms(prisma, new Legal(), unused)));
}

export async function verifyCheckoutSnapshot({ prisma, databaseUrl, offerId, createBuyer, createCartWithItem, runId, assert }) {
  const writer = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const buyer = await createBuyer(95);
    const context = { actorId: buyer.userId, organizationId: buyer.organizationId };
    const cart = await createCartWithItem(buyer, offerId, 1);
    const price = await prisma.offerPrice.findFirstOrThrow({ where: { offerId, status: "ACTIVE" } });
    const accepted = price.amountMinor.toString();
    const service = commerce(prisma);
    const resolve = service.resolveCurrentOffer.bind(service);
    let resolutions = 0;
    // Deterministic barrier: the writer commits after the first real offer
    // read, while checkout is suspended before validating/persisting its line.
    service.resolveCurrentOffer = async (...args) => {
      const result = await resolve(...args);
      resolutions += 1;
      if (resolutions === 1) await writer.offerPrice.update({ where: { id: price.id }, data: { amountMinor: price.amountMinor.plus(10000) } });
      return result;
    };
    const input = { idempotencyKey: `${runId}-snapshot` };
    const result = await service.checkout(cart.id, input, context);
    assert(result.status === "COMPLETED", "Accepted snapshot checkout should complete");
    const items = result.supplierOrders.flatMap(order => order.items);
    assert(items.length === 1 && items[0].unitPriceMinor.toString() === accepted,
      "Concurrent price update reached an order without buyer consent");
    assert(resolutions === 1, "Checkout resolved commercial state twice");
    const replay = await service.checkout(cart.id, input, context);
    assert(replay.id === result.id && resolutions === 1, "Replay must preserve the original snapshot without rereading prices");
    assert(await prisma.inventoryReservation.count({ where: { supplierOrderItemId: items[0].id } }) === 1,
      "Replay duplicated inventory reservation");

    const changedBuyer = await createBuyer(96);
    const changedCart = await createCartWithItem(changedBuyer, offerId, 1);
    const changedContext = { actorId: changedBuyer.userId, organizationId: changedBuyer.organizationId };
    await writer.offerPrice.update({ where: { id: price.id }, data: { vatRate: "16", includesVat: false } });
    await writer.supplierOffer.update({ where: { id: offerId }, data: { baseUnitsPerSaleUnit: "10" } });
    let conflict;
    try { await commerce(prisma).checkout(changedCart.id, { idempotencyKey: `${runId}-changed-terms` }, changedContext); }
    catch (error) { conflict = error.getResponse?.(); }
    assert(conflict?.code === "CART_REVALIDATION_REQUIRED" && conflict.validation.requiresAcceptance,
      "VAT/packaging change must preserve the actionable consent envelope");
    assert(await prisma.checkout.count({ where: { cartId: changedCart.id } }) === 0,
      "Terms conflict created a partial checkout");
    const persisted = await prisma.cart.findUniqueOrThrow({ where: { id: changedCart.id } });
    assert(persisted.status === "ACTIVE", "Terms conflict must preserve the active cart");
    const acceptanceService = commerce(prisma);
    const shown = await acceptanceService.validateCart(changedCart.id, changedContext);
    const acceptedItems = shown.items.filter(item => item.current).map(item => ({ cartItemId: item.cartItemId, snapshot: item.current }));
    await writer.offerPrice.update({ where: { id: price.id }, data: { amountMinor: price.amountMinor.plus(20000) } });
    let staleAcceptance;
    try { await acceptanceService.reprice(changedCart.id, changedContext, shown.cartVersion, acceptedItems); }
    catch (error) { staleAcceptance = error.getResponse?.(); }
    assert(staleAcceptance?.code === "CART_REVALIDATION_REQUIRED", "Reprice silently accepted a price newer than the displayed snapshot");
    const fresh = await acceptanceService.validateCart(changedCart.id, changedContext);
    await acceptanceService.reprice(changedCart.id, changedContext, fresh.cartVersion,
      fresh.items.filter(item => item.current).map(item => ({ cartItemId: item.cartItemId, snapshot: item.current })));
    const acceptedCheckout = await acceptanceService.checkout(changedCart.id, { idempotencyKey: `${runId}-accepted-terms` }, changedContext);
    assert(acceptedCheckout.supplierOrders[0].items[0].unitPriceMinor.toString() === price.amountMinor.plus(20000).toString(),
      "Explicit current consent did not preserve the accepted price");
    console.log("Checkout snapshot: real two-connection price race, VAT/packaging consent, stale acceptance, replay and rollback PASS");
  } finally { await writer.$disconnect(); }
}
