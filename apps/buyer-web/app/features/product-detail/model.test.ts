import { expect, it } from "vitest";
import { compareDecimal, packageKey, productAttributes, saleTotal, selectedOffers, type Comparison, type Offer } from "./model";

const offer = (id: string, variantId: string, price: string, quantity = "4", available = true): Offer => ({
  offerId: id, variantId, supplier: { organizationId: id, name: id }, supplierSku: null,
  price: { amountMinor: price, currency: "KZT", source: "BASE", normalizedPriceMinor: price, baseUnits: quantity, normalizedUnit: "г" },
  packaging: { id, name: "Шприц", quantityInBaseUnit: quantity, unit: "г" }, minimumOrderQuantity: "1", orderIncrement: "1",
  availability: available ? [{ warehouseId: id, warehouse: "Склад", cityId: id, quantityAvailable: "1", updatedAt: null, freshnessExpiresAt: null }] : [],
  delivery: [], markers: { verifiedDocuments: false, complianceRisk: null, officialDistributor: false, supplierWarranty: false, requiresConfirmation: false },
});
const comparison = { product: { id: "p", name: "Товар", brand: null, manufacturer: null, baseUnit: null }, reviewSummary: { count: 0, averageRating: null }, variants: [], selectedVariantId: null, offers: [], comparisonAttributes: [] } as Comparison;

it("compares decimal minor units and multiplies beyond safe Number precision", () => {
  expect(compareDecimal("9007199254740993.1", "9007199254740993.09")).toBe(1);
  expect(compareDecimal("120.00", "120")).toBe(0);
  expect(saleTotal("9007199254740993", "2.5")).toBe("22517998136852482.5");
  expect(saleTotal("100", "bad")).toBeNull();
});
it("keeps the chosen variant, size and currency separate, prioritizing available stock", () => {
  const chosen = offer("B", "A2", "1400000"), cheap = offer("A", "A2", "1200000", "4.00");
  const data = { ...comparison, offers: [chosen, cheap, offer("other-size", "A2", "100", "2"), offer("other-variant", "A3", "100"), offer("unavailable", "A2", "1", "4", false), { ...offer("usd", "A2", "100"), price: { ...chosen.price, currency: "USD" } }] };
  expect(packageKey(chosen)).toBe(packageKey(cheap));
  expect(selectedOffers(data, "A2", packageKey(chosen), "cheapest").map(item => item.offerId)).toEqual(["A", "B", "unavailable"]);
  expect(selectedOffers(data, "A2", packageKey(chosen), "expensive").map(item => item.offerId)).toEqual(["B", "A", "unavailable"]);
});
it("does not leak attributes of another variant into the selected variant", () => {
  const data: Comparison = { ...comparison, variants: [{ id: "A2", sku: null, gtin: null, label: "A2", attributes: { "Оттенок": "A2" } }], comparisonAttributes: [
    { scope: "PRODUCT", code: "type", name: "Тип", value: "Композит" },
    { scope: "VARIANT", variantId: "A3", code: "shade", name: "Оттенок", value: "A3" },
  ] };
  expect(productAttributes(data, "A2")).toEqual([["Тип", "Композит"], ["Оттенок", "A2"]]);
});
