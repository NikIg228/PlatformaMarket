import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";

// RFC UUIDv5 under the URL namespace. Keep this name/namespace stable: the
// target primary key is a permanent recovery receipt, without expiring tokens.
export function recoveredCartId(sourceId: string) {
  const bytes = createHash("sha1")
    .update(Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex"))
    .update(`urn:platformamarket:cart-recovery:${sourceId.toLowerCase()}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function recoverFailedCart(prisma: PrismaService, sourceId: string, buyerId: string,
  expectedVersion: number, context: SupplierActorContext) {
  const targetId = recoveredCartId(sourceId);
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${sourceId}::uuid AND "buyerOrganizationId" = ${buyerId}::uuid FOR UPDATE`;
      const source = await tx.cart.findFirstOrThrow({ where: { id: sourceId, buyerOrganizationId: buyerId }, include: { items: true, checkout: true } });
      if (source.status !== "ABANDONED" || source.checkout?.status !== "FAILED")
        throw new ConflictException("Восстановление доступно только после неудачного оформления заказа.");
      const previous = await tx.cart.findFirst({ where: { id: targetId, buyerOrganizationId: buyerId }, include: { items: true, checkout: true } });
      if (previous) return previous;
      if (source.version !== expectedVersion) throw new ConflictException("Корзина изменилась. Обновите страницу перед восстановлением.");
      // Compensation can fail independently; never create a second purchase
      // intention while the first still has an unresolved local/external hold.
      const unresolved = await tx.inventoryReservation.count({ where: {
        supplierOrderItem: { supplierOrder: { checkoutId: source.checkout.id } },
        OR: [{ status: { in: ["ACTIVE", "CONSUMED"] } }, { externalReservation: { is: { status: { not: "RELEASED" } } } }],
      } });
      if (unresolved) throw new ConflictException("Освобождение предыдущего резерва ещё не завершено. Обратитесь в поддержку перед повторным оформлением.");
      const active = await tx.cart.findFirst({ where: { buyerOrganizationId: buyerId, status: "ACTIVE" }, include: { items: true, checkout: true } });
      if (active) {
        if (active.items.length || active.checkout) throw new ConflictException("Сначала завершите работу с текущей корзиной. Её состав сохранён.");
        const retired = await tx.cart.updateMany({ where: { id: active.id, version: active.version, status: "ACTIVE", items: { none: {} }, checkout: { is: null } }, data: { status: "ABANDONED", version: { increment: 1 } } });
        if (retired.count !== 1) throw new ConflictException("Текущая корзина изменилась. Обновите страницу.");
      }
      const target = await tx.cart.create({ data: {
        id: targetId, buyerOrganizationId: buyerId, currency: source.currency, createdById: context.actorId,
        // Historical values are retained only to show a meaningful old/new
        // diff. Checkout always revalidates these against current conditions.
        items: { create: source.items.map(item => ({ offerId: item.offerId, quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor, totalPriceMinor: item.totalPriceMinor, currency: item.currency,
          priceSource: item.priceSource, priceRuleId: item.priceRuleId, pricingSnapshot: item.pricingSnapshot as Prisma.InputJsonValue })) },
      }, include: { items: true, checkout: true } });
      await tx.auditLog.create({ data: { ...context, action: "cart.recovered", entityType: "Cart", entityId: target.id,
        after: { sourceCartId: sourceId, checkoutId: source.checkout.id, itemCount: target.items.length, replacedEmptyCartId: active?.id ?? null } } });
      await tx.outboxEvent.create({ data: { aggregateType: "Cart", aggregateId: target.id, eventType: "CartRecovered",
        payload: { buyerOrganizationId: buyerId, sourceCartId: sourceId, cartId: target.id } } });
      return target;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (["P2002", "P2034"].includes(error.code) ||
      (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))))) {
      const previous = await prisma.cart.findFirst({ where: { id: targetId, buyerOrganizationId: buyerId }, include: { items: true, checkout: true } });
      if (previous) return previous;
      throw new ConflictException("Корзина меняется другим запросом. Обновите страницу и повторите восстановление.");
    }
    throw error;
  }
}
