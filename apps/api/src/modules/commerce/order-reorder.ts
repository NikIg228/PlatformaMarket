import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Order } from "./order-workflow.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";

export async function reorder(tx: Prisma.TransactionClient, order: Order, context: SupplierActorContext) {
  if (!["DELIVERED", "CANCELLED"].includes(order.status)) throw new ConflictException("Повторная закупка доступна из завершённого заказа.");
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${context.organizationId}::uuid FOR UPDATE`;
  const active = await tx.cart.findFirst({ where: { buyerOrganizationId: context.organizationId, status: "ACTIVE" }, include: { items: true, checkout: true } });
  if (active?.items.length || active?.checkout) throw new ConflictException("Сначала завершите работу с текущей корзиной. Её состав сохранён.");
  const items = order.items.filter(item => item.acceptedQuantity.gt(0));
  if (!items.length) throw new ConflictException("В заказе нет согласованных товаров для повторной закупки.");
  if (active) await tx.cart.update({ where: { id: active.id }, data: { status: "ABANDONED", version: { increment: 1 } } });
  const source = await tx.cartItem.findMany({ where: { id: { in: items.map(item => item.cartItemId) } } });
  // The old snapshot only explains the diff. Existing checkout revalidates
  // every offer and requires explicit acceptance of changed commercial terms.
  const cart = await tx.cart.create({ data: { buyerOrganizationId: context.organizationId, currency: order.currency, createdById: context.actorId,
    items: { create: items.map(item => {
      const previous = source.find(line => line.id === item.cartItemId);
      if (!previous) throw new ConflictException("История позиции недоступна.");
      const snapshot = previous.pricingSnapshot && typeof previous.pricingSnapshot === "object" && !Array.isArray(previous.pricingSnapshot) ? previous.pricingSnapshot : {};
      return { offerId: item.offerId, quantity: item.acceptedQuantity, unitPriceMinor: item.unitPriceMinor, totalPriceMinor: item.totalPriceMinor,
        currency: order.currency, priceSource: previous.priceSource, priceRuleId: previous.priceRuleId,
        pricingSnapshot: { ...snapshot, quantity: item.acceptedQuantity.toString(), unitPriceMinor: item.unitPriceMinor.toString(), totalPriceMinor: item.totalPriceMinor.toString() } as Prisma.InputJsonValue };
    }) },
  } });
  await tx.outboxEvent.create({ data: { aggregateType: "Cart", aggregateId: cart.id, eventType: "OrderReordered", payload: { sourceOrderId: order.id, buyerOrganizationId: context.organizationId, cartId: cart.id } } });
  return cart.id;
}
