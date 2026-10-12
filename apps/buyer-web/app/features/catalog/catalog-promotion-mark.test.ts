import { expect, it } from "vitest";
import type { SearchProduct } from "../../catalog-search-types";
import { catalogPromotionMark } from "./catalog-promotion-mark";

const now = Date.parse("2026-10-13T00:00:00Z");
const offer = { id: "offer", supplier: { id: "supplier", name: "Dental Supply" },
  priceMinor: "100000", currency: "KZT", normalizedPriceMinor: null,
  packaging: { name: "Шприц", quantityInBaseUnit: "1", unit: "шт" },
  available: true, confirmationMode: "AUTO", deliveryMethods: [],
  promotion: { label: "Композиты", percentage: 20, endsAt: "2026-10-14T00:00:00Z" } };
const product: SearchProduct = { id: "product", name: "Композит", brand: null,
  manufacturer: null, categories: [], minNormalizedPriceMinor: null, isAvailable: true, offers: [offer] };
it("labels the supplier benefit without changing the catalog price", () => {
  expect(catalogPromotionMark(product, now)).toEqual({ label: "−20% у поставщика", description: "Dental Supply: Композиты. Условия в предложении поставщика." });
  expect(product.offers[0].priceMinor).toBe("100000");
});
it("hides missing, expired, unavailable and malformed promotion claims", () => {
  for (const promotion of [null, { ...offer.promotion, endsAt: null }, { ...offer.promotion, endsAt: new Date(now).toISOString() }, { ...offer.promotion, percentage: 0 }, { ...offer.promotion, percentage: 101 }]) {
    expect(catalogPromotionMark({ ...product, offers: [{ ...offer, promotion }] }, now)).toBeNull();
  }
  expect(catalogPromotionMark({ ...product, offers: [{ ...offer, available: false }] }, now)).toBeNull();
});
