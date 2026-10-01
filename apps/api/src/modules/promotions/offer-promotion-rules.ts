import { ConflictException } from "@nestjs/common";
import { Prisma, type Promotion } from "@prisma/client";
import { promotionTermsSchema, promotionPriceEvidenceSchema, type PromotionTerms, type PromotionPriceEvidence, type OfferPromotion } from "@marketplace/schemas";
import { giftForPromotionQuantity } from "@marketplace/schemas";

export function promotionUnitPrice(p: Pick<Promotion, "kind" | "baseAmountMinor" | "percentageBasisPoints" | "fixedAmountMinor">) {
  const base = BigInt(p.baseAmountMinor?.toFixed(0) ?? "0");
  const discount = p.kind === "PERCENTAGE" ? base * BigInt(p.percentageBasisPoints ?? 0) / 10000n : p.kind === "FIXED_AMOUNT" ? BigInt(p.fixedAmountMinor?.toFixed(0) ?? "0") : 0n;
  if (base <= 0n || discount < 0n || discount >= base) throw new ConflictException("Скидка должна оставлять положительную цену товара");
  return (base - discount).toString();
}
export function promotionGiftQuantity(quantity: string, buy: string, gift: string) {
  return giftForPromotionQuantity(quantity, buy, gift);
}
export function promotionTerms(p: Promotion): PromotionTerms {
  return promotionTermsSchema.parse({ offerId: p.offerId, name: p.name, description: p.description ?? "", kind: p.kind,
    percentageBasisPoints: p.percentageBasisPoints, fixedAmountMinor: p.fixedAmountMinor?.toString() ?? null,
    buyQuantity: p.buyQuantity?.toString() ?? null, giftOfferId: p.giftOfferId, giftQuantity: p.giftQuantity?.toString() ?? null,
    minimumQuantity: p.minimumQuantity?.toString() ?? "1", quantityLimit: p.quantityLimit?.toString(), startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString() });
}
export function promotionTemporalStatus(p: Promotion, now = new Date()): OfferPromotion["temporalStatus"] {
  if (["ARCHIVED", "EXPIRED"].includes(p.status) || p.endsAt <= now || (p.quantityLimit && p.claimedQuantity.gte(p.quantityLimit))) return "ENDED";
  if (p.moderationStatus !== "APPROVED" || p.approvedRevision !== p.termsRevision) return "DRAFT";
  if (p.status === "PAUSED") return "PAUSED";
  if (p.status !== "ACTIVE") return "DRAFT";
  return p.startsAt > now ? "SCHEDULED" : "ACTIVE";
}
export async function capturePromotionPrice(db: Prisma.TransactionClient, offerId: string, supplierId: string, now = new Date()): Promise<PromotionPriceEvidence> {
  const offer = await db.supplierOffer.findFirst({ where: { id: offerId, supplierOrganizationId: supplierId, status: "ACTIVE" } });
  if (!offer) throw new ConflictException("Выберите действующее предложение своей организации");
  const price = await db.offerPrice.findFirst({ where: { offerId, status: "ACTIVE", validFrom: { lte: now },
    AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }, { OR: [{ freshnessExpiresAt: null }, { freshnessExpiresAt: { gt: now } }] }] }, orderBy: [{ validFrom: "desc" }, { id: "asc" }] });
  if (!price) throw new ConflictException("Сначала подтвердите актуальную обычную цену предложения");
  const since = new Date(now.getTime() - 30 * 86400000);
  const recentWhere = { offerId, currency: price.currency, validFrom: { gte: since, lte: now } };
  const [recent, preceding, first, aggregate] = await Promise.all([
    db.offerPrice.findMany({ where: recentWhere, orderBy: { validFrom: "desc" }, take: 200 }),
    db.offerPrice.findFirst({ where: { offerId, currency: price.currency, validFrom: { lt: since }, OR: [{ validTo: null }, { validTo: { gte: since } }] }, orderBy: { validFrom: "desc" } }),
    db.offerPrice.findFirst({ where: { offerId, currency: price.currency }, orderBy: { validFrom: "asc" } }),
    db.offerPrice.aggregate({ where: recentWhere, _min: { amountMinor: true } }),
  ]);
  const observations = [...(preceding ? [preceding] : []), ...recent.reverse()].map(row => ({ amountMinor: row.amountMinor.toFixed(0), observedAt: row.validFrom.toISOString() }));
  observations.push({ amountMinor: price.amountMinor.toFixed(0), observedAt: now.toISOString() });
  const minimum = observations.reduce((min, row) => BigInt(row.amountMinor) < min ? BigInt(row.amountMinor) : min, BigInt(aggregate._min.amountMinor?.toFixed(0) ?? price.amountMinor.toFixed(0)));
  const earliest = Math.min(first?.validFrom.getTime() ?? now.getTime(), ...observations.map(row => Date.parse(row.observedAt)));
  return { capturedAt: now.toISOString(), baseAmountMinor: price.amountMinor.toFixed(0), currency: price.currency,
    minimum30DaysMinor: minimum.toString(), historyDays: Math.min(30, Math.max(0, (now.getTime() - earliest) / 86400000)),
    raisedRecently: BigInt(price.amountMinor.toFixed(0)) > minimum, observations };
}
export async function promotionResponses(db: Prisma.TransactionClient, items: Promotion[]): Promise<OfferPromotion[]> {
  if (!items.length) return [];
  const ids = items.map(p => p.id);
  const [revisions, decisions, offers, suppliers] = await Promise.all([
    db.promotionRevision.findMany({ where: { promotionId: { in: ids } }, orderBy: { revision: "asc" } }),
    db.promotionDecision.findMany({ where: { promotionId: { in: ids } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    db.supplierOffer.findMany({ where: { id: { in: items.flatMap(p => [p.offerId, p.giftOfferId].filter((id): id is string => id !== null)) } }, select: { id: true, productVariant: { select: { product: { select: { id: true, canonicalName: true } } } } } }),
    db.organization.findMany({ where: { id: { in: items.map(p => p.supplierOrganizationId) } }, select: { id: true, displayName: true } }),
  ]);
  return items.map(p => ({ id: p.id, supplierOrganizationId: p.supplierOrganizationId, supplierName: suppliers.find(s => s.id === p.supplierOrganizationId)?.displayName ?? "Поставщик",
    offerName: offers.find(o => o.id === p.offerId)?.productVariant.product.canonicalName ?? "Товар", productId: offers.find(o => o.id === p.offerId)!.productVariant.product.id,
    giftName: offers.find(o => o.id === p.giftOfferId)?.productVariant.product.canonicalName ?? null, terms: promotionTerms(p), version: p.version,
    revision: p.termsRevision, moderationStatus: p.moderationStatus as OfferPromotion["moderationStatus"], temporalStatus: promotionTemporalStatus(p), status: p.status,
    evidence: promotionPriceEvidenceSchema.parse(p.oldPriceEvidence), unitPriceMinor: promotionUnitPrice(p), currency: p.currency!, claimedQuantity: p.claimedQuantity.toString(),
    isTemplate: p.isTemplate, placementStartsAt: p.placementStartsAt?.toISOString() ?? null, placementEndsAt: p.placementEndsAt?.toISOString() ?? null,
    revisions: revisions.filter(r => r.promotionId === p.id).map(r => ({ revision: r.revision, terms: promotionTermsSchema.parse(r.terms), evidence: promotionPriceEvidenceSchema.parse(r.evidence), createdAt: r.createdAt.toISOString() })),
    decisions: decisions.filter(d => d.promotionId === p.id).map(d => ({ action: d.action, reason: d.reason, actorId: d.actorId, revision: d.revision, createdAt: d.createdAt.toISOString() })),
  }));
}
