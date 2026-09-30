import { canonicalSearchQuery } from "../catalog-search";
import { catalogPriceToMinor } from "./catalog-view-model";
import type { MarketplaceCatalogState } from "./marketplace-url";

/** The city is supplied by DeliveryProvider only after validation against the API. */
export function publicCatalogQuery(state: MarketplaceCatalogState, cityId?: string) {
  const params = new URLSearchParams({ q: canonicalSearchQuery(state.query), sort: state.sort,
    limit: "24", priceBasis: "SALE_UNIT", includeFilterOptions: "true" });
  for (const [key, value] of Object.entries({
    cityId, inStock: state.stock === "all" ? undefined : state.stock,
    categoryId: state.categoryId, unit: state.unit, packaging: state.packaging,
    deliveryMethod: state.delivery, brandName: state.brand, categoryName: state.category,
    brandId: state.brandId, manufacturerId: state.manufacturerId,
    supplierOrganizationId: state.supplierOrganizationId, attributeFilters: state.attributeFilters,
    minSalePriceMinor: catalogPriceToMinor(state.minPrice), maxSalePriceMinor: catalogPriceToMinor(state.maxPrice),
  })) if (value) params.set(key, value);
  return params;
}
