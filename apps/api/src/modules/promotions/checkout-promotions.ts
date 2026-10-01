import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AcceptedPromotion } from "@marketplace/schemas";
import { environment } from "../../platform/config/environment";
import { promotionGiftQuantity, promotionUnitPrice } from "./offer-promotion-rules";

type QuoteInput = { offerId: string; supplierOrganizationId: string; buyerOrganizationId: string; source: string; unitPriceMinor: string;
  currency: string; quantity: number; balanceId: string | null; lotId: string | null };
export async function quoteOfferPromotion(db: Prisma.TransactionClient, input: QuoteInput) {
  if (environment().DEPLOYMENT_PROFILE !== "go_live" || input.source !== "BASE") return null;
  const now = new Date();
  const matches = await db.promotion.findMany({ where: { offerId: input.offerId, status: "ACTIVE", moderationStatus: "APPROVED", startsAt: { lte: now }, endsAt: { gt: now } }, take: 2 });
  if (matches.length > 1) throw new ConflictException("У предложения пересекаются акции. Обратитесь к поставщику");
  const p = matches[0];
  if (!p || p.approvedRevision !== p.termsRevision || !p.quantityLimit || p.claimedQuantity.plus(input.quantity).gt(p.quantityLimit) || (p.minimumQuantity && p.minimumQuantity.gt(input.quantity))) return null;
  if (!p.baseAmountMinor?.eq(input.unitPriceMinor) || p.currency !== input.currency) throw new ConflictException("Обычная цена изменилась после проверки акции");
  const unit = promotionUnitPrice(p);
  const giftQuantity = p.kind === "BUY_X_GET_Y" ? promotionGiftQuantity(String(input.quantity), p.buyQuantity!.toString(), p.giftQuantity!.toString()) : "0";
  const gift = new Prisma.Decimal(giftQuantity).gt(0) ? await db.supplierOffer.findFirst({ where: { id: p.giftOfferId!, supplierOrganizationId: input.supplierOrganizationId, status: "ACTIVE",
    publication: { is: { status: { in: ["PUBLISHED", "RESTRICTED"] }, marketplaceVisible: true } }, productVariant: { status: "ACTIVE", product: { status: "ACTIVE" } } },
    include: { publication: true, productVariant: { include: { product: true } }, inventoryBalances: { where: { freshnessStatus: "FRESH", warehouse: { status: "ACTIVE" },
      OR: [{ freshnessExpiresAt: null }, { freshnessExpiresAt: { gt: now } }] }, include: { _count: { select: { lots: true } }, lots: { where: { status: "ACTIVE", OR: [{ expirationDate: null }, { expirationDate: { gt: now } }] }, orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { id: "asc" }] } }, orderBy: [{ quantityAvailable: "desc" }, { id: "asc" }] } } }) : null;
  const required = new Prisma.Decimal(giftQuantity);
  const selected = gift?.inventoryBalances.map(balance => ({ balance,
    lot: balance.lots.find(lot => lot.quantityAvailable.gte(required.plus(lot.id === input.lotId ? input.quantity : 0))) ?? null,
  })).find(({ balance, lot }) => balance.quantityAvailable.gte(required.plus(balance.id === input.balanceId ? input.quantity : 0)) && (!balance._count.lots || lot));
  if (required.gt(0) && (!gift || !selected || (Array.isArray(gift.publication?.allowedBuyerIds) && gift.publication.allowedBuyerIds.length && !gift.publication.allowedBuyerIds.includes(input.buyerOrganizationId))))
    throw new ConflictException("Подарок акции недоступен в обещанном количестве. Поставщик должен восстановить остаток или согласовать новые условия");
  const snapshot: AcceptedPromotion = { promotionId: p.id, revision: p.termsRevision, name: p.name, kind: p.kind as AcceptedPromotion["kind"],
    baseUnitPriceMinor: input.unitPriceMinor, unitPriceMinor: unit,
    discountMinor: new Prisma.Decimal(input.unitPriceMinor).minus(unit).mul(input.quantity).toFixed(0), endsAt: p.endsAt.toISOString(),
    buyQuantity: p.buyQuantity?.toString() ?? null, giftPerGroup: p.giftQuantity?.toString() ?? null,
    gift: gift ? { offerId: gift.id, name: gift.productVariant.product.canonicalName, quantity: giftQuantity } : null };
  return { snapshot, gift: gift && selected ? { offer: gift, balance: selected.balance, lot: selected.lot, quantity: giftQuantity } : null };
}

export async function claimCheckoutPromotion(tx: Prisma.TransactionClient, snapshot: AcceptedPromotion, input: { quantity: string; buyerId: string; checkoutId: string; orderId: string; itemId: string; currency: string }) {
  await tx.$queryRaw`SELECT id FROM "Promotion" WHERE id = ${snapshot.promotionId}::uuid FOR UPDATE`;
  const p = await tx.promotion.findUniqueOrThrow({ where: { id: snapshot.promotionId } });
  const now = new Date();
  if (p.status !== "ACTIVE" || p.moderationStatus !== "APPROVED" || p.termsRevision !== snapshot.revision || p.approvedRevision !== snapshot.revision || p.startsAt > now || p.endsAt <= now || !p.quantityLimit || p.claimedQuantity.plus(input.quantity).gt(p.quantityLimit))
    throw new ConflictException("Акция или её лимит изменились. Подтвердите текущие условия корзины");
  await tx.promotion.update({ where: { id: p.id }, data: { claimedQuantity: { increment: input.quantity }, redemptionCount: { increment: 1 } } });
  await tx.promotionRedemption.create({ data: { promotionId: p.id, buyerOrganizationId: input.buyerId, checkoutId: input.checkoutId,
    supplierOrderId: input.orderId, discountAmountMinor: snapshot.discountMinor, currency: input.currency, idempotencyKey: `checkout:${input.checkoutId}:${input.itemId}`,
    metadata: { quantity: input.quantity, revision: snapshot.revision, snapshot, released: false } } });
}

export async function releaseCheckoutPromotions(tx: Prisma.TransactionClient, checkoutId: string) {
  const receipts = await tx.promotionRedemption.findMany({ where: { checkoutId }, orderBy: { promotionId: "asc" } });
  for (const receipt of receipts) {
    const metadata = receipt.metadata as { quantity?: string; released?: boolean } | null;
    if (!metadata?.quantity || metadata.released) continue;
    await tx.$queryRaw`SELECT id FROM "Promotion" WHERE id = ${receipt.promotionId}::uuid FOR UPDATE`;
    const fresh = await tx.promotionRedemption.findUniqueOrThrow({ where: { id: receipt.id } });
    if ((fresh.metadata as { released?: boolean } | null)?.released) continue;
    await tx.promotion.update({ where: { id: receipt.promotionId }, data: { claimedQuantity: { decrement: metadata.quantity }, redemptionCount: { decrement: 1 } } });
    await tx.promotionRedemption.update({ where: { id: receipt.id }, data: { metadata: { ...(fresh.metadata as Prisma.JsonObject), released: true } } });
  }
}
