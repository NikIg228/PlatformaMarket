import type { PublicPromotion } from "@marketplace/schemas";
import { safeCatalogReturn, type MarketplaceCatalogState } from "../../catalog/marketplace-url";

/** The promotion endpoint cannot constrain these filters; never imply it does. */
export function supportsCatalogPromotions(state: MarketplaceCatalogState) {
  return !state.query && !state.brandId && !state.manufacturerId && !state.brand &&
    !state.attributeFilters && !state.unit && !state.packaging && !state.minPrice && !state.maxPrice &&
    !state.verified && !state.official && !state.inCity && !state.delivery && state.stock === "all" &&
    (!state.category || Boolean(state.categoryId));
}

/** Dates are rechecked on the client; a long-open tab must not advertise an ended offer. */
export function activePromotions(items: PublicPromotion[], now = Date.now()) {
  return [...new Map(items.filter(item => item.temporalStatus === "ACTIVE" &&
    Date.parse(item.terms.startsAt) <= now && Date.parse(item.terms.endsAt) > now).map(item => [item.id, item])).values()];
}
export function catalogPromotionSlots(count: number, columns: number) {
  const first = columns * 2, second = columns * 5;
  return { first: count >= first ? first : null, second: count >= second ? second : null };
}
export function promotionProductHref(item: PublicPromotion, returnUrl = "/catalog") {
  return `/products/${encodeURIComponent(item.productId)}?offer=${encodeURIComponent(item.terms.offerId)}&returnTo=${encodeURIComponent(safeCatalogReturn(returnUrl))}`;
}
