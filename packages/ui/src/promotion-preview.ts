import type { PromotionTerms } from "@marketplace/schemas";

export function promotionDiscountFromPrice(value: string, baseMinor: string | null) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,18}(?:\.\d{1,2})?$/.test(normalized) || !baseMinor || !/^\d+$/.test(baseMinor)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const price = BigInt(whole!) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  const base = BigInt(baseMinor);
  return price > BigInt(0) && price < base ? (base - price).toString() : null;
}
export function promotionPriceText(minor?: string) {
  return minor && /^\d+$/.test(minor) ? `${BigInt(minor) / BigInt(100)}.${(BigInt(minor) % BigInt(100)).toString().padStart(2, "0")}` : "";
}

export function promotionPreviewPrice(terms: PromotionTerms, baseMinor: string | null) {
  if (!baseMinor || !/^\d+$/.test(baseMinor)) return null;
  const base = BigInt(baseMinor);
  if (base <= BigInt(0)) return null;
  if (terms.kind === "BUY_X_GET_Y") return base.toString();
  if (terms.kind === "PERCENTAGE" && (!Number.isInteger(terms.percentageBasisPoints) || !terms.percentageBasisPoints || terms.percentageBasisPoints < 1 || terms.percentageBasisPoints > 9000)) return null;
  if (terms.kind === "FIXED_AMOUNT" && !/^\d+$/.test(terms.fixedAmountMinor ?? "")) return null;
  const discount = terms.kind === "PERCENTAGE" ? base * BigInt(terms.percentageBasisPoints!) / BigInt(10000) : BigInt(terms.fixedAmountMinor!);
  return discount > BigInt(0) && discount < base ? (base - discount).toString() : null;
}
