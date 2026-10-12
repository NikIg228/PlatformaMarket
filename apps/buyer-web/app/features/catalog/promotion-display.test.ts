import { expect, it } from "vitest";
import type { PublicPromotion } from "@marketplace/schemas";
import { activePromotions, catalogPromotionSlots, promotionProductHref, supportsCatalogPromotions } from "./promotion-display";
import { readMarketplaceCatalog } from "../../catalog/marketplace-url";

const item: PublicPromotion = { id: "campaign", supplierOrganizationId: "supplier", supplierName: "Поставщик", offerName: "Композит", productId: "product", giftName: null, temporalStatus: "ACTIVE", unitPriceMinor: "80000", baseAmountMinor: "100000", currency: "KZT", terms: { offerId: "offer", name: "Скидка", description: "", kind: "PERCENTAGE", percentageBasisPoints: 2000, fixedAmountMinor: null, buyQuantity: null, giftOfferId: null, giftQuantity: null, minimumQuantity: "1", quantityLimit: "100", startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-10-31T00:00:00.000Z" } };
it("excludes future, expired and paused campaigns and deduplicates active results", () => {
  const now = Date.parse("2026-10-12T00:00:00Z");
  expect(activePromotions([item, item, { ...item, id: "paused", temporalStatus: "PAUSED" }, { ...item, id: "future", terms: { ...item.terms, startsAt: "2026-10-20T00:00:00Z" } }, { ...item, id: "ended", terms: { ...item.terms, endsAt: "2026-10-12T00:00:00Z" } }], now)).toEqual([item]);
  expect(activePromotions([item], Date.parse(item.terms.endsAt))).toEqual([]);
});
it.each([5, 3, 2])("inserts campaigns only after complete product rows at %i columns", columns => {
  expect(catalogPromotionSlots(columns * 2 - 1, columns)).toEqual({ first: null, second: null });
  expect(catalogPromotionSlots(columns * 2, columns)).toEqual({ first: columns * 2, second: null });
  expect(catalogPromotionSlots(columns * 5, columns)).toEqual({ first: columns * 2, second: columns * 5 });
});
it("preserves exact product and offer identity in the campaign destination", () => {
  const url = new URL(promotionProductHref(item), "https://example.test");
  expect(url.pathname).toBe("/products/product");
  expect(url.searchParams.get("offer")).toBe("offer");
  expect(url.searchParams.get("returnTo")).toBe("/catalog");
});
it("retains catalog filters and loaded count while rejecting an external return URL", () => {
  const returnUrl = "/catalog?sort=NAME_ASC&categoryId=11111111-1111-4111-8111-111111111111&count=48";
  const url = new URL(promotionProductHref(item, returnUrl), "https://example.test");
  expect(url.searchParams.get("returnTo")).toBe(returnUrl);
  expect(new URL(promotionProductHref(item, "https://outside.test"), "https://example.test").searchParams.get("returnTo")).toBe("/");
});
it("does not advertise unrelated campaigns under unsupported catalog constraints", () => {
  expect(supportsCatalogPromotions(readMarketplaceCatalog(new URLSearchParams()))).toBe(true);
  expect(supportsCatalogPromotions(readMarketplaceCatalog(new URLSearchParams("categoryId=11111111-1111-4111-8111-111111111111")))).toBe(true);
  for (const query of ["q=sku", "deliveryMethod=PICKUP", "inStock=true", "inStock=false", "category=Материалы", "minPrice=100"]) {
    expect(supportsCatalogPromotions(readMarketplaceCatalog(new URLSearchParams(query))), query).toBe(false);
  }
});
