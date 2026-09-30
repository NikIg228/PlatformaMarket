import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CompactProductCard } from "./compact-product-card";
import type { SearchProduct } from "../../catalog-search-types";
const product: SearchProduct = { id: "test", name: "Бренд Модель очень длинное полное название оттенок A2 шприц 4 г", brand: null, manufacturer: null, categories: [{ id: "1", name: "Материалы" }, { id: "2", name: "Материалы" }], minNormalizedPriceMinor: null, isAvailable: false, offers: [] };
describe("compact catalogue card", () => {
  it("retains the full original name and never substitutes missing SKU, media or price", () => {
    const html = renderToStaticMarkup(<CompactProductCard product={product} returnUrl="/?count=48" imageSource={() => null} />);
    expect(html).toContain(product.name); expect(html).toContain("Фото пока нет"); expect(html).toContain("Цена уточняется");
    expect(html).not.toContain("Артикул:"); expect(html.match(/Материалы/g)).toHaveLength(1); expect(html).toContain("returnTo=%2F%3Fcount%3D48");
  });
  it("uses approved display name, actual manufacturer SKU and exact available sale-unit price", () => {
    const offer = { id: "o", supplier: { id: "s", name: "Не показывать поставщика" }, priceMinor: "1700040", currency: "KZT", normalizedPriceMinor: "170", packaging: { name: "Коробка", quantityInBaseUnit: "100", unit: "шт" }, available: true, confirmationMode: "AUTO", deliveryMethods: [] };
    const html = renderToStaticMarkup(<CompactProductCard product={{ ...product, catalogName: "Бренд Модель A2 4 г", manufacturerSku: "REF-25", offers: [offer, { ...offer, available: false, priceMinor: "1" }] }} returnUrl="/" imageSource={() => null} />);
    expect(html).toContain("Бренд Модель A2 4 г"); expect(html).not.toContain(product.name); expect(html).toContain("REF-25"); expect(html).toContain("от 17 000,4 ₸"); expect(html).not.toContain("Не показывать поставщика"); expect(html).not.toContain("Коробка");
  });
});
