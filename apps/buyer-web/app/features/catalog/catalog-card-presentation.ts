import type { SearchProduct } from "../../catalog-search-types";

export function catalogCardPresentation(product: SearchProduct) {
  const brand = product.brand?.trim() || product.manufacturer?.trim() || null;
  const categories = [...new Set(product.categories.map(item => item.name.trim()).filter(Boolean))];
  const parameters = product.attributes?.map(parts => parts.filter(Boolean).join(": ")).filter(Boolean).slice(0, 2) ?? [];
  const supplierCount = new Set(product.offers.map(offer => offer.supplier.id)).size;
  const plural = new Intl.PluralRules("ru-RU").select(supplierCount);
  const supplierLabel = `${supplierCount} ${plural === "one" ? "поставщик" : plural === "few" ? "поставщика" : "поставщиков"}`;
  return {
    brand,
    parameters: parameters.length ? [...categories.slice(0, 1), ...parameters].join(" · ") : categories.slice(0, 2).join(" · "),
    supplierLabel: supplierCount ? supplierLabel : "Нет предложений",
    available: product.offers.some(offer => offer.available),
  };
}
