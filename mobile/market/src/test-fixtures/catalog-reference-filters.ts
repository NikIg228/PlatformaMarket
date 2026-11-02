import { commercialPage } from "./catalog-commercial-filters";
import { commercialCategoryId, commercialSupplierId } from "./catalog-commercial-filters";
import { reviewId } from "./buyer-review";
export const referenceRoot = reviewId(210001), referenceOrphan = reviewId(210003), referenceCycleA = reviewId(210005), referenceCycleB = reviewId(210006), referenceGlobalSupplier = reviewId(210100);
export function referencePage(options: Parameters<typeof commercialPage>[0] & { manySuppliers?: boolean } = {}) {
  const page = commercialPage(options); if (!page.filterOptions) return page;
  page.filterOptions.categories = [{ id: referenceRoot, name: "SYNTHETIC taxonomy root", parentId: null },{ id: commercialCategoryId, name: "SYNTHETIC commercial category", parentId: referenceRoot },{ id: referenceOrphan, name: "SYNTHETIC orphan category", parentId: reviewId(210004) },{ id: referenceCycleA, name: "SYNTHETIC cycle A", parentId: referenceCycleB },{ id: referenceCycleB, name: "SYNTHETIC cycle B", parentId: referenceCycleA }];
  page.filterOptions.suppliers = options.manySuppliers ? Array.from({ length: 45 },(_,index) => ({ id: reviewId(230000+index), name: `SYNTHETIC reference supplier ${String(index).padStart(2,"0")}` })) : [{ id: commercialSupplierId, name: "SYNTHETIC commercial supplier" },{ id: referenceGlobalSupplier, name: "SYNTHETIC off-page supplier" }];
  return page;
}
