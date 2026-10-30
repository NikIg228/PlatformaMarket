import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readMarketplaceCatalog } from "../../catalog/marketplace-url";
import type { SearchProduct } from "../../catalog-search-types";

vi.mock("@marketplace/api-client", () => ({ frontendFeatures: { promotions: true } }));
vi.mock("./use-promotion-page", () => ({ usePromotionPage: () => ({ items: [{ id: "foreign" }], page: { total: 1 }, loading: true, error: "stale", retry: () => {} }) }));
vi.mock("./promotion-banner", () => ({ PromotionBanner: () => <div>Чужая акция</div> }));
import { CatalogProductGrid } from "./catalog-product-grid";

describe("supplier storefront grid", () => {
  it("does not render generic campaigns or stale campaign state among supplier products", () => {
    const products: SearchProduct[] = Array.from({ length: 12 }, (_, index) => ({ id: String(index), name: `Товар ${index}`, brand: null, manufacturer: null, categories: [], minNormalizedPriceMinor: null, isAvailable: false, offers: [] }));
    const html = renderToStaticMarkup(<CatalogProductGrid storefront products={products} state={readMarketplaceCatalog(new URLSearchParams())} returnUrl="/catalog/suppliers/test" imageSource={() => null} />);
    expect(html.match(/data-testid="product-card"/g)).toHaveLength(12);
    expect(html).not.toContain("Чужая акция");
    expect(html).not.toContain("Загружаем акции");
    expect(html).not.toContain("Акции временно недоступны");
  });
});
