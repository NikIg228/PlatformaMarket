import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { workspaceFixture } from "./workspace-session";

export async function operatorOrdersFixture() {
  const db = new PrismaClient();
  const expected = process.env.GITHUB_ACTIONS === "true" ? "marketplace" : "dentmarket_audit_20260914";
  const target = new URL(process.env.DATABASE_URL!);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.pathname !== `/${expected}`) throw new Error("Operator order fixtures require the approved disposable DB");
  const [identity] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (identity.name !== expected) throw new Error("Wrong database identity");
  const run = randomUUID(), prefix = `O-${run}`, orgIds: string[] = [], userIds: string[] = [], orderIds: string[] = [], cartIds: string[] = [], checkoutIds: string[] = [], ticketIds: string[] = [];
  const cleanup = async () => {
    await db.supportLink.deleteMany({ where: { ticketId: { in: ticketIds } } });
    await db.supportTicket.deleteMany({ where: { id: { in: ticketIds } } });
    await db.document.deleteMany({ where: { supplierOrderId: { in: orderIds } } });
    await db.orderDiscrepancy.deleteMany({ where: { supplierOrderId: { in: orderIds } } });
    await db.shipmentItem.deleteMany({ where: { shipment: { supplierOrderId: { in: orderIds } } } });
    await db.shipment.deleteMany({ where: { supplierOrderId: { in: orderIds } } });
    await db.orderManualReturn.deleteMany({ where: { supplierOrderId: { in: orderIds } } });
    await db.orderTransferClaim.deleteMany({ where: { supplierOrderId: { in: orderIds } } });
    await db.supplierOrderItem.deleteMany({ where: { supplierOrderId: { in: orderIds } } });
    await db.supplierOrder.deleteMany({ where: { id: { in: orderIds } } });
    await db.checkout.deleteMany({ where: { id: { in: checkoutIds } } });
    await db.cart.deleteMany({ where: { id: { in: cartIds } } });
    await db.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await db.organizationMembership.deleteMany({ where: { userId: { in: userIds } } });
    await db.role.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.organizationProfile.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.address.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.organizationCapability.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  };
  try {
    const digits = String(Date.now()).slice(-9);
    const actor = async (capability: "MARKETPLACE_OPERATOR" | "BUYER", digit: string, permissions: string[]) => {
      const org = await db.organization.create({ data: { bin: `${digit}${digits}`, legalName: `Order registry ${run}`, displayName: capability === "BUYER" ? `Клиника ${run}` : "Оператор заказов", capabilities: { create: { capability } } } }); orgIds.push(org.id);
      const user = await db.user.create({ data: { email: `orders-${digit}-${run}@example.invalid`, displayName: "Order registry fixture", emailVerifiedAt: new Date() } }); userIds.push(user.id);
      const role = await db.role.create({ data: { organizationId: org.id, code: "orders", name: "Order read", permissions: { create: permissions.map(code => ({ permission: { connect: { code } } })) } } });
      const member = await db.organizationMembership.create({ data: { userId: user.id, organizationId: org.id, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
      const session = await workspaceFixture(db, capability, { userId: user.id, organizationId: org.id, displayName: org.displayName });
      return { org, user, role, member, session, headers: { authorization: `Bearer ${session.accessToken}` } };
    };
    const operator = await actor("MARKETPLACE_OPERATOR", "941", ["order.confirm", "document.view", "support.ticket.view", "notification.view", "organization.view"]);
    const buyer = await actor("BUYER", "942", ["order.confirm", "order.create"]);
    const restricted = await actor("MARKETPLACE_OPERATOR", "943", ["organization.view"]);
    const offer = await db.supplierOffer.findFirstOrThrow({ where: { status: "ACTIVE" }, orderBy: { id: "asc" } });
    const supplier = await db.organization.findUniqueOrThrow({ where: { id: offer.supplierOrganizationId } });
    const warehouse = await db.warehouse.findFirstOrThrow({ where: { supplierOrganizationId: offer.supplierOrganizationId, status: "ACTIVE" } });
    const when = new Date("2026-10-16T00:00:00.000Z");
    for (let i = 0; i < 31; i++) {
      const cartId = randomUUID(), checkoutId = randomUUID(), orderId = randomUUID(); cartIds.push(cartId); checkoutIds.push(checkoutId); orderIds.push(orderId);
      await db.cart.create({ data: { id: cartId, buyerOrganizationId: buyer.org.id, status: "CHECKED_OUT" } });
      await db.checkout.create({ data: { id: checkoutId, cartId, buyerOrganizationId: buyer.org.id, totalAmountMinor: "9007199254740993", currency: "KZT", idempotencyKey: randomUUID(), pricingSnapshot: {} } });
      await db.supplierOrder.create({ data: { id: orderId, checkoutId, supplierOrganizationId: offer.supplierOrganizationId, buyerOrganizationId: buyer.org.id, orderNumber: `${prefix}-${String(i).padStart(2, "0")}`, status: "PARTIALLY_FULFILLED", paymentStatus: "PAID", subtotalAmountMinor: "9007199254740993", currency: "KZT", createdAt: when } });
    }
    const orderId = orderIds[30];
    const cartItem = await db.cartItem.create({ data: { cartId: cartIds[30], offerId: offer.id, quantity: "10", unitPriceMinor: "100", totalPriceMinor: "1000", currency: "KZT", priceSource: "BASE", pricingSnapshot: {} } });
    const line = await db.supplierOrderItem.create({ data: { supplierOrderId: orderId, cartItemId: cartItem.id, offerId: offer.id, productVariantId: offer.productVariantId, warehouseId: warehouse.id, quantity: "10", acceptedQuantity: "10", unitPriceMinor: "100", totalPriceMinor: "1000", currency: "KZT", status: "CONFIRMED", offerSnapshot: {}, inventorySnapshot: {} } });
    const shipment = await db.shipment.create({ data: { supplierOrderId: orderId, warehouseId: warehouse.id, shipmentNumber: `${prefix}-SHIP`, method: "PICKUP", pickup: true, status: "PARTIALLY_DELIVERED", recipientName: "Тестовая клиника", dispatchedAt: when, items: { create: { supplierOrderItemId: line.id, quantity: "10", deliveredQuantity: "8" } } }, include: { items: true } });
    const document = await db.document.create({ data: { ownerOrganizationId: offer.supplierOrganizationId, supplierOrderId: orderId, shipmentId: shipment.id, kind: "WAYBILL", category: "SHIPMENT", format: "PDF", source: "GENERATED", status: "DRAFT", title: "Накладная тестовой партии", documentNumber: `${prefix}-WAYBILL`, requiredSignatureCount: 2,
      participants: { create: [{ organizationId: offer.supplierOrganizationId, role: "ISSUER" }, { organizationId: buyer.org.id, role: "RECIPIENT" }] } } });
    const source = { orderVersion: 1, shipmentVersion: 1, shipmentNumber: shipment.shipmentNumber, documentId: document.id, documentVersion: 1, documentChecksum: null, documentSnapshot: null, sourceReceiptEventId: null,
      lines: [{ shipmentItemId: shipment.items[0].id, orderItemId: line.id, name: "Тестовый товар", uom: "шт", sentQuantity: "10", recordedReceivedQuantity: "8", unitPriceMinor: "100", taxSnapshot: null, isGift: false }] };
    const statement = { kind: "SHORTAGE", reason: "Получено восемь вместо десяти", requestedResolution: "RESUPPLY", attachmentIds: [], lines: [{ shipmentItemId: shipment.items[0].id, actualQuantity: "8", damagedQuantity: "0" }] };
    await db.orderDiscrepancy.createMany({ data: [{ supplierOrderId: orderId, shipmentId: shipment.id, status: "SUBMITTED", statement, source }, { supplierOrderId: orderId, shipmentId: shipment.id, status: "DRAFT", statement: { ...statement, reason: "PRIVATE_DRAFT_MUST_NOT_LEAK" }, source }] });
    const ticket = await db.supportTicket.create({ data: { number: `${prefix}-TICKET`, organizationId: buyer.org.id, requesterId: buyer.user.id, subject: "Проверить недостачу", description: "Synthetic order case", category: "ORDER" } }); ticketIds.push(ticket.id);
    await db.supportLink.create({ data: { ticketId: ticket.id, entityType: "SupplierOrder", entityId: orderId } });
    return { db, operator, buyer, restricted, prefix, orderIds, orderId, shipment, line, document, ticket, offer, supplier,
      dispose: async () => { try { await cleanup(); } finally { await db.$disconnect(); } } };
  } catch (error) { try { await cleanup(); } finally { await db.$disconnect(); } throw error; }
}
