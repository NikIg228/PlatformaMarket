import { describe, expect, it } from "vitest";
import { marketplaceCatalogUrl, readMarketplaceCatalog } from "../../catalog/marketplace-url";
import { activeFilters, catalogFilters, categoryChoices, categoryPatch, emptyFilters, priceError, priceLabel } from "./catalog-filter-model";

describe("catalog filter model", () => {
  it("preserves global delivery and query while resetting product filters", () => {
    const state = readMarketplaceCatalog(new URLSearchParams({
      deliveryCityId: "c3d186c0-53eb-407c-a203-0d1d8432efd7", inCity: "true", q: "цемент",
      brandId: "brand", minPrice: "100", maxPrice: "500", inStock: "true", count: "48",
    }));
    expect(activeFilters(catalogFilters(state))).toHaveLength(3);
    const reset = new URL(marketplaceCatalogUrl({ ...state, ...emptyFilters, count: 24 }), "http://local.invalid");
    expect(reset.searchParams.get("deliveryCityId")).toBe(state.deliveryCityId);
    expect(reset.searchParams.get("inCity")).toBe("true");
    expect(reset.searchParams.get("q")).toBe("цемент");
    expect(reset.searchParams.has("brandId")).toBe(false);
    expect(activeFilters(catalogFilters({ ...state, ...emptyFilters }))).toEqual([]);
  });

  it("counts both price bounds as one filter and clears them together", () => {
    const active = activeFilters({ ...emptyFilters, minPrice: "100", maxPrice: "500" });
    expect(active).toHaveLength(1);
    expect(active[0].patch).toEqual({ minPrice: "", maxPrice: "" });
  });

  it("validates large exact prices without floating-point rounding", () => {
    expect(priceError("999999999999999999,98", "999999999999999999,99")).toBeUndefined();
    expect(priceError("999999999999999999,99", "999999999999999999,98")).toBeTruthy();
    expect(priceError("-1", "10")).toBeTruthy();
    expect(priceError("1.234", "")).toBeTruthy();
    expect(priceLabel("", "50000")).toBe("Цена: до 50 000 ₸");
  });

  it("clears incompatible attributes and legacy category on category change", () => {
    expect(categoryPatch("child")).toEqual({ categoryId: "child", category: "", attributeFilters: "" });
    expect(categoryChoices([
      { id: "parent", name: "Материалы", parentId: null },
      { id: "child", name: "Цементы", parentId: "parent" },
    ])).toEqual([
      { id: "parent", name: "Материалы" },
      { id: "child", name: "Материалы / Цементы" },
    ]);
  });

});
