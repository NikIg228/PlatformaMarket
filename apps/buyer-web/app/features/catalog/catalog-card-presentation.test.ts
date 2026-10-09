import { describe, expect, it } from "vitest";
import { catalogCardPresentation } from "./catalog-card-presentation";
import type { SearchProduct } from "../../catalog-search-types";

const product: SearchProduct = { id: "product", name: "Товар", brand: null, manufacturer: "Производитель", categories: [{ id: "1", name: "Материал" }], attributes: [["Оттенок", "A2"], ["Объём", "4 г"]], offers: [], minNormalizedPriceMinor: null, isAvailable: true };
describe("catalog card presentation", () => {
  it("never invents offers or availability from a product-level flag", () => {
    expect(catalogCardPresentation(product)).toEqual({ brand: "Производитель", parameters: "Материал · Оттенок: A2 · Объём: 4 г", supplierLabel: "Нет предложений", available: false });
  });
  it("counts unique suppliers and checks actual offer availability", () => {
    const offer = { id: "1", supplier: { id: "supplier", name: "Поставщик" }, priceMinor: null, currency: null, normalizedPriceMinor: null, packaging: { name: null, quantityInBaseUnit: "1", unit: null }, available: false, confirmationMode: "AUTO", deliveryMethods: [] };
    const view = catalogCardPresentation({ ...product, brand: "Бренд", offers: [offer, { ...offer, id: "2", available: true }] });
    expect(view.brand).toBe("Бренд"); expect(view.supplierLabel).toBe("1 поставщик"); expect(view.available).toBe(true);
  });
});
