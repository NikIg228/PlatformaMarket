import type { SearchProduct } from "../../catalog-search-types";

/** Search has already checked offer/supplier, price version and campaign scope. */
export function catalogPromotionMark(product: SearchProduct, now = Date.now()) {
  const offer = product.offers.find(item => item.available && item.promotion &&
    item.promotion.percentage != null && item.promotion.percentage > 0 && item.promotion.percentage <= 100 &&
    item.promotion.endsAt && Date.parse(item.promotion.endsAt) > now);
  if (!offer?.promotion) return null;
  return { label: `−${offer.promotion.percentage}% у поставщика`,
    description: `${offer.supplier.name}: ${offer.promotion.label}. Условия в предложении поставщика.` };
}
