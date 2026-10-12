import type { OfferComparisonResponse } from "@marketplace/schemas";
import type { SupplierOffer } from "../catalog/supplier-offers";

export type Comparison = OfferComparisonResponse;
export type Offer = Comparison["offers"][number];

function decimalParts(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return { value: BigInt((whole || "0") + fraction), scale: fraction.length };
}
export function compareDecimal(a: string, b: string) {
  const left = decimalParts(a), right = decimalParts(b);
  const scale = Math.max(left.scale, right.scale);
  const difference = left.value * BigInt(10) ** BigInt(scale - left.scale) - right.value * BigInt(10) ** BigInt(scale - right.scale);
  return difference < BigInt(0) ? -1 : difference > BigInt(0) ? 1 : 0;
}
export function saleTotal(priceMinor: string, quantity: string) {
  if (!/^\d+(?:\.\d+)?$/.test(priceMinor) || !/^\d+(?:\.\d+)?$/.test(quantity)) return null;
  const price = decimalParts(priceMinor), count = decimalParts(quantity);
  const scale = price.scale + count.scale;
  const digits = (price.value * count.value).toString().padStart(scale + 1, "0");
  return scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits;
}
export function packageKey(offer: Offer) {
  // IDs can differ by supplier; never compare unlike named sizes or currencies.
  const quantity = offer.packaging.quantityInBaseUnit.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return JSON.stringify([offer.packaging.name.trim(), quantity, offer.packaging.unit, offer.price.currency]);
}
export function packageLabel(offer: Offer) {
  return `${offer.packaging.name}${offer.packaging.unit ? ` · ${offer.packaging.quantityInBaseUnit} ${offer.packaging.unit}` : ""} · ${offer.price.currency}`;
}
export function offerAvailable(offer: Offer) {
  return offer.availability.some(item => compareDecimal(item.quantityAvailable, "0") > 0);
}
export function selectedOffers(comparison: Comparison, variantId: string, packaging: string, sort: string) {
  return comparison.offers.filter(offer => offer.variantId === variantId && packageKey(offer) === packaging).sort((a, b) => {
    const availability = Number(offerAvailable(b)) - Number(offerAvailable(a));
    if (availability) return availability;
    if (sort === "supplier") return a.supplier.name.localeCompare(b.supplier.name, "ru");
    return compareDecimal(a.price.amountMinor, b.price.amountMinor) * (sort === "expensive" ? -1 : 1) || a.supplier.name.localeCompare(b.supplier.name, "ru");
  });
}
export function toSupplierOffer(offer: Offer): SupplierOffer {
  return { id: offer.offerId, supplier: offer.supplier, priceMinor: offer.price.amountMinor,
    normalizedPriceMinor: offer.price.normalizedPriceMinor, currency: offer.price.currency,
    packaging: offer.packaging, available: offerAvailable(offer), delivery: offer.delivery,
    minimumOrderQuantity: offer.minimumOrderQuantity, orderIncrement: offer.orderIncrement,
    verifiedDocuments: offer.markers.verifiedDocuments, officialDistributor: offer.markers.officialDistributor };
}
export function productAttributes(comparison: Comparison, variantId: string): Array<[string, string]> {
  const display = (value: unknown) => value == null ? "—" : typeof value === "boolean" ? value ? "Да" : "Нет" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const attributes = comparison.comparisonAttributes.filter(attribute => attribute.scope === "PRODUCT" || attribute.variantId === variantId).map(attribute => [attribute.name, display(attribute.value)] as [string, string]);
  const variant = comparison.variants.find(item => item.id === variantId);
  for (const [name, value] of Object.entries(variant?.attributes ?? {})) {
    if (!attributes.some(([label]) => label === name)) attributes.push([name, display(value)]);
  }
  return attributes;
}
