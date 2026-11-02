import type { CatalogSearchResponse } from "../../../../packages/schemas/src/core-api";
import { catalogMediaPage } from "./catalog-media";
import { reviewId } from "./buyer-review";
export const commercialCategoryId = reviewId(200001), commercialSupplierId = reviewId(200002), commercialBrandId = reviewId(200003), commercialManufacturerId = reviewId(200004);
export function commercialPage(options: { offset?: number; q?: string; withOptions?: boolean; attributes?: boolean; empty?: boolean; manyBrands?: boolean } = {}): CatalogSearchResponse {
  const page = catalogMediaPage(); page.query = options.q ?? ""; page.offset = options.offset ?? 0; page.total = options.empty ? 0 : 48; page.limit = 24; if (options.empty) page.items = []; else page.items[0]!.name = `SYNTHETIC commercial page ${page.offset}`;
  page.facets = { categories: [{ id: commercialCategoryId, name: "SYNTHETIC commercial category", count: 999 }], suppliers: [{ id: commercialSupplierId, name: "SYNTHETIC commercial supplier", count: 999 }] };
  if (options.withOptions !== false) page.filterOptions = { categories: [{ id: commercialCategoryId, name: "SYNTHETIC commercial category", parentId: null }], brands: options.manyBrands ? Array.from({ length: 45 },(_,index) => ({ id: reviewId(201000+index), name: `SYNTHETIC brand ${String(index).padStart(2,"0")}` })) : [{ id: commercialBrandId, name: "SYNTHETIC brand absent from current product page" },{ id: reviewId(200005), name: "SYNTHETIC alternative brand" }], manufacturers: [{ id: commercialManufacturerId, name: "SYNTHETIC source manufacturer" }], suppliers: [{ id: commercialSupplierId, name: "SYNTHETIC commercial supplier" }], packaging: ["SYNTHETIC source box","SYNTHETIC source pack"], attributes: options.attributes === false ? [] : [{ code: "typed", name: "SYNTHETIC typed characteristic", values: [0,false,"0","false"] },{ code: "capacity", name: "SYNTHETIC capacity", values: [0,1,2] }] };
  else delete page.filterOptions;
  return page;
}
