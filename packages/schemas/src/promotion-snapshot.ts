import type { AcceptedPromotion } from "./promotions";

export function sameAcceptedPromotion(left: AcceptedPromotion | null | undefined, right: AcceptedPromotion | null | undefined): boolean {
  if (!left || !right) return !left && !right;
  const keys = ["promotionId", "revision", "name", "kind", "baseUnitPriceMinor", "unitPriceMinor", "discountMinor", "endsAt", "buyQuantity", "giftPerGroup"] as const;
  return keys.every(key => left[key] === right[key]) &&
    (left.gift && right.gift ? left.gift.offerId === right.gift.offerId && left.gift.name === right.gift.name && left.gift.quantity === right.gift.quantity : !left.gift && !right.gift);
}

export function giftForPromotionQuantity(quantity: string, buy: string, gift: string, cap?: string): string {
  const scaled = (value: string) => {
    if (!/^\d+(?:\.\d{1,6})?$/.test(value)) throw new Error("Invalid quantity");
    const [whole, fraction = ""] = value.split(".");
    return BigInt(whole + fraction.padEnd(6, "0"));
  };
  const divisor = scaled(buy);
  if (divisor === BigInt(0)) throw new Error("Buy quantity must be positive");
  const calculated = (scaled(quantity) / divisor) * scaled(gift);
  const value = cap !== undefined && scaled(cap) < calculated ? scaled(cap) : calculated;
  const text = value.toString().padStart(7, "0");
  return `${text.slice(0, -6)}.${text.slice(-6)}`.replace(/\.?0+$/, "") || "0";
}
// Historical order JSON predates this feature. Read only the display shape;
// HTTP writes and accepted snapshots are validated by acceptedPromotionSchema.
export function orderItemPromotion(snapshot: unknown): AcceptedPromotion | null {
  if (!snapshot || typeof snapshot !== "object" || !("pricing" in snapshot) || !snapshot.pricing || typeof snapshot.pricing !== "object" || !("promotion" in snapshot.pricing)) return null;
  const value = snapshot.pricing.promotion;
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (typeof p.promotionId !== "string" || typeof p.name !== "string" || typeof p.revision !== "number" || !Number.isInteger(p.revision) || p.revision < 1 || !["PERCENTAGE", "FIXED_AMOUNT", "BUY_X_GET_Y"].includes(String(p.kind)) || typeof p.endsAt !== "string") return null;
  if (![p.baseUnitPriceMinor, p.unitPriceMinor, p.discountMinor].every(value => typeof value === "string" && /^\d+$/.test(value))) return null;
  if (![p.buyQuantity, p.giftPerGroup].every(value => value === null || (typeof value === "string" && /^\d+(?:\.\d{1,6})?$/.test(value)))) return null;
  if (p.gift !== null) {
    if (!p.gift || typeof p.gift !== "object") return null;
    const gift = p.gift as Record<string, unknown>;
    if (typeof gift.offerId !== "string" || typeof gift.name !== "string" || typeof gift.quantity !== "string" || !/^\d+(?:\.\d{1,6})?$/.test(gift.quantity)) return null;
  }
  return value as AcceptedPromotion;
}
