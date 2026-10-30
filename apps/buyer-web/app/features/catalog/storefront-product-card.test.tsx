import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StorefrontProductCard } from "./storefront-product-card";
import type { SearchProduct } from "../../catalog-search-types";

const product: SearchProduct = { id: "product", name: "Материал A2", brand: null, manufacturer: null, categories: [], minNormalizedPriceMinor: null, isAvailable: true, offers: [
  { id: "offer", supplier: { id: "supplier", name: "Поставщик" }, priceMinor: "280000", currency: "KZT", normalizedPriceMinor: "2800", packaging: { name: "Коробка", quantityInBaseUnit: "100", unit: "шт" }, available: true, confirmationMode: "AUTO", deliveryMethods: [] },
] };
describe("storefront product navigation", () => {
  it("links directly to the product with the supplier search context and actual sale-unit price", () => {
    const returnUrl = "/catalog/suppliers/supplier?query=A2&sort=PRICE_ASC";
    const html = renderToStaticMarkup(<StorefrontProductCard product={product} returnUrl={returnUrl} imageSource={() => "/catalog/image.webp"} />);
    expect(html).toContain(`returnTo=${encodeURIComponent(returnUrl)}`);
    expect(html).toContain("Подробнее: Материал A2");
    expect(html).not.toContain("Выбрать поставщика");
    expect(html).toContain("2 800 ₸");
    expect(html).toContain("Коробка");
    expect(html).toContain("В наличии");
    expect(html).toContain('/catalog/image.webp');
  });
  it("never invents image, price or stock and retains the localized product action", () => {
    const html = renderToStaticMarkup(<StorefrontProductCard product={{ ...product, offers: [], isAvailable: false }} returnUrl="/catalog/suppliers/supplier?lang=kk" imageSource={() => null} locale="kk" />);
    expect(html).toContain("Фото әлі жоқ");
    expect(html).toContain("Бағасы нақтылануда");
    expect(html).toContain("Қолда жоқ");
    expect(html).toContain("Толығырақ: Материал A2");
    expect(html).not.toContain("2 800");
  });
});
