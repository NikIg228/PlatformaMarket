import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { commerce } from "./verify-checkout-snapshot.mjs";
const require = createRequire(import.meta.url);
const domain = (file, name) => require(`../../apps/api/dist/src/modules/${file}.js`)[name];

// All organizations, offers, orders and inventory belong to the parent's
// disposable PostgreSQL fixture. Real services enforce the same boundaries.
export async function verifyOfferPromotions({ prisma, offers, supplierId, createBuyer, runId, assert, request }) {
  const config = require("../../apps/api/dist/src/platform/config/environment.js");
  const previousProfile = process.env.DEPLOYMENT_PROFILE;
  process.env.DEPLOYMENT_PROFILE = "go_live"; config.resetEnvironmentForTests();
  const Permissions = domain("access-control/access-control.service", "AccessControlService");
  const Terms = domain("agreements/supplier-terms.service", "SupplierTermsService");
  const Legal = domain("agreements/supplier-legal-documents", "SupplierLegalDocuments");
  const Promotions = domain("promotions/promotions.service", "PromotionsService");
  const Workflow = domain("commerce/order-workflow.service", "OrderWorkflowService");
  const permissions = new Permissions(prisma);
  const service = new Promotions(prisma, new Terms(prisma, new Legal(), {}), permissions);
  const workflow = new Workflow(prisma, permissions);
  const [buyer, seller, operator, foreign, raceA, raceB] = await Promise.all([51, 52, 53, 54, 55, 56].map(index => createBuyer(index)));
  const context = value => ({ actorId: value.userId, organizationId: value.organizationId });
  const sellerContext = { actorId: seller.userId, organizationId: supplierId };
  const role = await prisma.role.create({ data: { organizationId: supplierId, code: `${runId}-promotions`, name: "Synthetic promotions",
    permissions: { create: ["promotion.view", "promotion.manage", "order.confirm"].map(code => ({ permission: { connect: { code } } })) } } });
  await prisma.organizationMembership.create({ data: { organizationId: supplierId, userId: seller.userId, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
  await prisma.organizationCapability.create({ data: { organizationId: operator.organizationId, capability: "MARKETPLACE_OPERATOR" } });
  for (const [identity, codes] of [[buyer, ["order.approve"]], [operator, ["promotion.manage", "promotion.placement.manage"]]]) {
    const ownedRole = await prisma.role.findFirstOrThrow({ where: { organizationId: identity.organizationId } });
    await prisma.rolePermission.createMany({ data: (await prisma.permission.findMany({ where: { code: { in: codes } } })).map(p => ({ roleId: ownedRole.id, permissionId: p.id })) });
  }
  const reject = async (operation, status, label) => {
    let error; try { await operation(); } catch (caught) { error = caught; }
    assert(error && (!status || error.getStatus?.() === status), `${label}: expected ${status ?? "failure"}, got ${error?.message ?? "success"}`);
  };
  const query = { sort: "ENDING", offset: 0, limit: 24 };
  const cmd = async (p, action, actor = sellerContext, extra = {}) => service.command(p.id, { action, expectedVersion: p.version, idempotencyKey: randomUUID(), ...extra }, actor);
  const approve = async p => cmd(await cmd(p, "SUBMIT"), "APPROVE", context(operator), { reason: "Synthetic price and terms reviewed" });
  const terms = (offer, extra = {}) => ({ offerId: offer.offerId, name: `Synthetic promotion ${runId}`, description: "Synthetic only", kind: "PERCENTAGE", percentageBasisPoints: 1000,
    fixedAmountMinor: null, buyQuantity: null, giftOfferId: null, giftQuantity: null, minimumQuantity: "1", quantityLimit: "100",
    startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(), ...extra });
  const create = value => service.create({ terms: value, idempotencyKey: randomUUID() }, sellerContext);
  const cart = async (identity, offer, quantity) => {
    const instance = commerce(prisma), actor = context(identity);
    const value = await instance.createCart(identity.organizationId, { currency: "KZT" }, actor);
    await instance.addItem(value.id, { offerId: offer.offerId, quantity }, actor);
    return { instance, value, actor };
  };
  const execute = async (id, action, actor) => workflow.execute(id, { ...action, expectedVersion: (await prisma.supplierOrder.findUniqueOrThrow({ where: { id } })).version, idempotencyKey: randomUUID() }, actor);
  try {
    assert((await request("/promotions/storefront")).status === 404, "Pilot API unexpectedly exposes promotions");
    const [main, gift, raceMain, raceGift, failedMain, failedGift] = offers;
    const price = await prisma.offerPrice.findFirstOrThrow({ where: { offerId: main.offerId, status: "ACTIVE" } });
    await prisma.offerPrice.create({ data: { offerId: main.offerId, amountMinor: price.amountMinor.minus(100), currency: "KZT", status: "INACTIVE", validFrom: new Date(Date.now() - 10 * 86400000), validTo: new Date(Date.now() - 60000) } });
    const input = { terms: terms(main), idempotencyKey: randomUUID() };
    let p = await service.create(input, sellerContext);
    assert((await service.create(input, sellerContext)).id === p.id, "Create replay duplicated promotion");
    await reject(() => service.create({ ...input, terms: { ...input.terms, name: "Different body" } }, sellerContext), 409, "Idempotency body conflict");
    assert(p.evidence.raisedRecently && p.evidence.historyDays >= 10 && p.evidence.historyDays < 11 && p.evidence.minimum30DaysMinor === price.amountMinor.minus(100).toString(), "Price evidence lost real history length or prior minimum");
    await reject(() => service.list({ ...query, supplierOrganizationId: supplierId }, context(foreign)), 404, "Tenant history leak");
    const pending = await cmd(p, "SUBMIT");
    await reject(() => cmd(pending, "APPROVE", sellerContext, { reason: "Self approval denied" }), 403, "Supplier self approval");
    p = await cmd(pending, "APPROVE", context(operator), { reason: "Price increase explicitly reviewed" });
    assert(p.temporalStatus === "ACTIVE", "Approved current promotion not active");
    const quote = domain("promotions/checkout-promotions", "quoteOfferPromotion");
    for (const source of ["CONTRACT", "TIER"]) assert(await quote(prisma, { offerId: main.offerId, source }) === null, "Promotion stacked with a negotiated or tier price");
    const publicPage = await service.storefront(query);
    const visible = publicPage.items.find(item => item.id === p.id);
    assert(visible && !Object.hasOwn(visible, "decisions") && !Object.hasOwn(visible, "evidence"), "Storefront leaked private decisions or omitted approved promotion");
    await reject(() => prisma.offerPrice.update({ where: { id: price.id }, data: { amountMinor: price.amountMinor.plus(1) } }), null, "Direct price writer escaped trigger");
    const overlap = await cmd(await create(terms(main)), "SUBMIT");
    await reject(() => cmd(overlap, "APPROVE", context(operator), { reason: "Overlapping version" }), 409, "Stacking overlapping promotions");
    p = await cmd(p, "PLACE", context(operator), { startsAt: p.terms.startsAt, endsAt: p.terms.endsAt });
    assert((await service.storefront({ ...query, featured: true })).items.some(item => item.id === p.id), "Operator placement missing");
    const purchase = await cart(buyer, main, 10);
    const giftTerms = terms(main, { kind: "BUY_X_GET_Y", percentageBasisPoints: null, buyQuantity: "5", giftOfferId: gift.offerId, giftQuantity: "2" });
    p = await service.revise(p.id, { terms: giftTerms, expectedVersion: p.version, idempotencyKey: randomUUID() }, sellerContext);
    assert(p.moderationStatus === "DRAFT" && p.revision === 2 && !p.placementStartsAt && p.revisions.length === 2, "Revision retained prior approval/placement or overwrote history");
    assert(!(await service.storefront(query)).items.some(item => item.id === p.id), "Unreviewed revision leaked to storefront");
    p = await approve(p);
    const shown = await purchase.instance.validateCart(purchase.value.id, purchase.actor);
    assert(shown.items[0].changes.includes("OFFER_RULES") && shown.items[0].current.promotion.gift.quantity === "4", "Gift change did not require consent");
    await reject(() => purchase.instance.checkout(purchase.value.id, { idempotencyKey: randomUUID() }, purchase.actor), 409, "Checkout skipped promotion consent");
    await purchase.instance.reprice(purchase.value.id, purchase.actor, shown.cartVersion, shown.items.map(item => ({ cartItemId: item.cartItemId, snapshot: item.current })));
    const key = randomUUID();
    const checkout = await purchase.instance.checkout(purchase.value.id, { idempotencyKey: key }, purchase.actor);
    assert((await purchase.instance.checkout(purchase.value.id, { idempotencyKey: key }, purchase.actor)).id === checkout.id, "Checkout replay duplicated gift");
    const order = checkout.supplierOrders[0], parent = order.items.find(item => !item.giftForItemId), present = order.items.find(item => item.giftForItemId);
    assert(order.items.length === 2 && present.giftForItemId === parent.id && present.cartItemId === null && present.unitPriceMinor.toString() === "0" && present.quantity.toString() === "4", "Gift order item lost parent, quantity or zero price");
    assert((await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: gift.balanceId } })).quantityReserved.toString() === "4", "Gift stock was not reserved");
    await purchase.instance.confirmSupplierOrder(order.id, { decisions: order.items.map(item => ({ itemId: item.id, acceptedQuantity: Number(item.quantity) })) }, sellerContext);
    const reduction = quantity => ({ action: "PROPOSE_PAYMENT_REDUCTION", reason: "Synthetic buyer reduces purchase", items: [{ itemId: parent.id, acceptedQuantity: "5" }, { itemId: present.id, acceptedQuantity: quantity }] });
    await reject(() => execute(order.id, reduction("4"), context(buyer)), 409, "Buyer reduction retained unearned gift");
    await execute(order.id, reduction("2"), context(buyer));
    const pendingReduction = await prisma.orderPaymentReduction.findFirstOrThrow({ where: { supplierOrderId: order.id, status: "PENDING" } });
    assert((await prisma.supplierOrderItem.findUniqueOrThrow({ where: { id: present.id } })).acceptedQuantity.toString() === "4", "Gift changed before bilateral acceptance");
    await execute(order.id, { action: "DECIDE_PAYMENT_REDUCTION", reductionId: pendingReduction.id, accepted: true }, sellerContext);
    assert((await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: gift.balanceId } })).quantityReserved.toString() === "2", "Accepted reduction did not release only excess gift");
    p = await cmd(p, "SAVE_TEMPLATE");
    const copied = await service.create({ terms: terms(main), sourceTemplateId: p.id, idempotencyKey: randomUUID() }, sellerContext);
    assert(copied.id !== p.id && copied.moderationStatus === "DRAFT" && copied.revision === 1, "Template inherited approval");
    p = await cmd(p, "ARCHIVE");
    assert(!(await service.storefront(query)).items.some(item => item.id === p.id), "Archived promotion visible");
    assert((await prisma.supplierOrderItem.findUniqueOrThrow({ where: { id: parent.id } })).offerSnapshot.pricing.promotion.revision === 2, "Archive changed order promise");
    await execute(order.id, { action: "CANCEL", reason: "Synthetic reorder fixture" }, context(buyer));
    const reordered = await execute(order.id, { action: "REORDER" }, context(buyer));
    const currentCart = await prisma.cart.findFirstOrThrow({ where: { buyerOrganizationId: buyer.organizationId, status: "ACTIVE" }, include: { items: true } });
    assert(reordered && currentCart.items.length === 1 && currentCart.items[0].offerId === main.offerId, "Reorder copied a gift as a paid cart item");
    const revalidation = await commerce(prisma).validateCart(currentCart.id, context(buyer));
    assert(revalidation.items[0].changes.includes("OFFER_RULES") && !revalidation.items[0].current.promotion, "Reorder silently reused an archived promotion");
    const racePromotion = await approve(await create(terms(raceMain, { kind: "BUY_X_GET_Y", percentageBasisPoints: null, buyQuantity: "5", giftOfferId: raceGift.offerId, giftQuantity: "2" })));
    const racers = await Promise.all([raceA, raceB].map(identity => cart(identity, raceMain, 5)));
    const results = await Promise.allSettled(racers.map(value => value.instance.checkout(value.value.id, { idempotencyKey: randomUUID() }, value.actor)));
    assert(results.filter(value => value.status === "fulfilled").length === 1, "Concurrent checkout oversold the shared gift");
    assert((await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: raceGift.balanceId } })).quantityReserved.toString() === "2", "Gift race corrupted reserved stock");
    assert((await prisma.promotion.findUniqueOrThrow({ where: { id: racePromotion.id } })).claimedQuantity.toString() === "5", "Failed checkout consumed promotion limit");
    const winning = results.find(value => value.status === "fulfilled").value.supplierOrders[0];
    await commerce(prisma).confirmSupplierOrder(winning.id, { decisions: winning.items.map(item => ({ itemId: item.id, acceptedQuantity: Number(item.quantity) })) }, sellerContext);
    // The preceding manual-payment suite proves payment confirmation. Stage a
    // paid order here to isolate split fulfillment without inventing bank I/O.
    await prisma.supplierOrder.update({ where: { id: winning.id }, data: { status: "PAID", paymentStatus: "PAID" } });
    const Logistics = domain("logistics/logistics.service", "LogisticsService");
    const logistics = new Logistics(prisma);
    const paidItem = winning.items.find(item => !item.giftForItemId), giftItem = winning.items.find(item => item.giftForItemId);
    const shipment = items => logistics.createShipment(winning.id, { warehouseId: paidItem.warehouseId, method: "SUPPLIER_CITY", recipientName: "Synthetic buyer", items, fulfillmentSteps: [] }, sellerContext);
    await shipment([{ supplierOrderItemId: paidItem.id, quantity: 3 }]);
    const secondShipment = await shipment([{ supplierOrderItemId: paidItem.id, quantity: 2 }, { supplierOrderItemId: giftItem.id, quantity: 2 }]);
    assert(secondShipment.items.some(item => item.supplierOrderItemId === giftItem.id && item.quantity.toString() === "2"), "Split delivery removed the promised gift");
    assert((await prisma.supplierOrderItem.findUniqueOrThrow({ where: { id: giftItem.id } })).acceptedQuantity.toString() === "2", "Splitting delivery recalculated the order gift");
    const failedPromotion = await approve(await create(terms(failedMain, { kind: "BUY_X_GET_Y", percentageBasisPoints: null, buyQuantity: "5", giftOfferId: failedGift.offerId, giftQuantity: "1" })));
    const failed = await cart(foreign, failedMain, 5);
    const reserve = failed.instance.inventory.reserveForOrder.bind(failed.instance.inventory);
    failed.instance.inventory.reserveForOrder = async (...args) => {
      if (args[1] === failedGift.balanceId) throw new Error("Synthetic gift reservation failure");
      return reserve(...args);
    };
    await reject(() => failed.instance.checkout(failed.value.id, { idempotencyKey: randomUUID() }, failed.actor), 409, "Gift failure did not abort checkout");
    assert((await prisma.inventoryBalance.findUniqueOrThrow({ where: { id: failedMain.balanceId } })).quantityReserved.toString() === "0", "Gift failure leaked the main reserve");
    assert((await prisma.promotion.findUniqueOrThrow({ where: { id: failedPromotion.id } })).claimedQuantity.toString() === "0", "Gift compensation leaked promotion claim");
    console.log("Offer promotions: tenant/moderation/version/price history/trigger/placement/template/consent/gift reserve/replay/reduction/reorder/race/compensation PASS");
  } finally {
    const rows = await prisma.promotion.findMany({ where: { offerId: { in: offers.map(value => value.offerId) } }, select: { id: true } });
    const ids = rows.map(value => value.id);
    await prisma.promotionRedemption.deleteMany({ where: { promotionId: { in: ids } } });
    await prisma.promotionRevision.deleteMany({ where: { promotionId: { in: ids } } });
    await prisma.promotionDecision.deleteMany({ where: { promotionId: { in: ids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
    await prisma.idempotencyRecord.deleteMany({ where: { OR: [{ scope: { startsWith: `promotion:create:${supplierId}:` } }, ...ids.map(id => ({ scope: { startsWith: `promotion:${id}:` } }))] } });
    await prisma.promotion.deleteMany({ where: { id: { in: ids } } });
    if (previousProfile === undefined) delete process.env.DEPLOYMENT_PROFILE; else process.env.DEPLOYMENT_PROFILE = previousProfile;
    config.resetEnvironmentForTests();
  }
}
