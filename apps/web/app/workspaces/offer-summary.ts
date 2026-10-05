import type { WorkspaceOffer } from "@marketplace/schemas";

export function offerAttention(offer: WorkspaceOffer, now = Date.now()) {
  const price = offer.prices.find(item => item.status === "ACTIVE");
  const priceWarning = !price ? "Укажите цену" : price.freshnessExpiresAt && Date.parse(price.freshnessExpiresAt) <= now ? "Подтвердите цену" : null;
  const stockWarning = !offer.inventoryBalances.length ? "Укажите остаток" : offer.inventoryBalances.some(item => item.freshnessStatus !== "FRESH" || (item.freshnessExpiresAt && Date.parse(item.freshnessExpiresAt) <= now)) ? "Обновите остаток" : null;
  return { priceWarning, stockWarning, needsAttention: Boolean(priceWarning || stockWarning || offer.publication?.blockedReason) };
}
/** Sum decimal quantities without rounding through binary floating point. */
export function totalAvailable(offer: WorkspaceOffer) {
  const values = offer.inventoryBalances.map(item => item.quantityAvailable);
  const scale = Math.max(0, ...values.map(value => value.split(".")[1]?.length ?? 0));
  const total = values.reduce((sum, value) => {
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
    return sum + BigInt(`${whole}${fraction.padEnd(scale, "0")}`) * (value.startsWith("-") ? BigInt(-1) : BigInt(1));
  }, BigInt(0));
  const digits = (total < BigInt(0) ? -total : total).toString().padStart(scale + 1, "0");
  const result = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, "") : digits;
  return `${total < BigInt(0) ? "-" : ""}${result}`;
}
