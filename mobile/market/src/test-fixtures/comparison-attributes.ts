import { listDraftComparison, listDraftId } from "./list-draft";
export { listDraftScope as attributesScope, listDraftId as attributesId } from "./list-draft";
export function attributesComparison() {
 const body = listDraftComparison(), id = body.selectedVariantId!, selected = body.variants.find(variant => variant.id === id)!;
 body.product.brand = "  SYNTHETIC source brand  "; body.product.manufacturer = "  SYNTHETIC source manufacturer  "; selected.sku = "  0000123  ";
 selected.label = "SYNTHETIC selected variant"; selected.attributes = { "SYNTHETIC explicit field": "SYNTHETIC duplicate fallback", "SYNTHETIC decimal text": "  0001.250000  ", "SYNTHETIC structured": { private: "SYNTHETIC nested opaque" } };
 body.variants = [selected, { ...selected, id: listDraftId(7701), label: "SYNTHETIC other variant", attributes: { "SYNTHETIC other-only": "SYNTHETIC other dictionary" } }];
 body.comparisonAttributes = [
  { scope: "PRODUCT", code: "product-text", name: "SYNTHETIC product field", value: "  SYNTHETIC исходный текст\nбастапқы мәтін  " },
  { scope: "PRODUCT", code: "product-bool", name: "SYNTHETIC false field", value: false },
  { scope: "VARIANT", variantId: id, code: "variant-explicit", name: "SYNTHETIC explicit field", value: "SYNTHETIC explicit selected value" },
  { scope: "VARIANT", variantId: listDraftId(7701), code: "variant-other", name: "SYNTHETIC other field", value: "SYNTHETIC other selected value" },
  { scope: "VARIANT", code: "variant-unbound", name: "SYNTHETIC unbound field", value: "SYNTHETIC unbound value" },
 ]; return body;
}
