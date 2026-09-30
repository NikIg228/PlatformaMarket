import type { SearchResult } from "../../catalog-search-types";
import type { MarketplaceCatalogState } from "../../catalog/marketplace-url";
import { catalogPriceToMinor } from "../../catalog/catalog-view-model";

export type FilterOptions = NonNullable<SearchResult["filterOptions"]>;
export const emptyFilters = {
  categoryId: "", category: "", brandId: "", brand: "", manufacturerId: "",
  supplierOrganizationId: "", minPrice: "", maxPrice: "", stock: "all",
  packaging: "", unit: "", delivery: "", attributeFilters: "",
};
export type CatalogFilters = typeof emptyFilters;
export type FilterPatch = Partial<CatalogFilters>;
export type AttributeValues = Record<string, string | number | boolean>;

export function catalogFilters(state: MarketplaceCatalogState): CatalogFilters {
  return Object.fromEntries(Object.entries(emptyFilters).map(([key, fallback]) =>
    [key, state[key as keyof CatalogFilters] ?? fallback])) as CatalogFilters;
}

export function readAttributes(value: string): AttributeValues {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string | number | boolean] =>
        ["string", "number", "boolean"].includes(typeof entry[1])));
    }
  } catch { /* Invalid old URLs remain removable through reset. */ }
  return {};
}

export function attributePatch(filters: CatalogFilters, code: string, value: string): FilterPatch {
  const attributes = readAttributes(filters.attributeFilters);
  if (value) attributes[code] = JSON.parse(value) as string | number | boolean;
  else delete attributes[code];
  return { attributeFilters: Object.keys(attributes).length ? JSON.stringify(attributes) : "" };
}

export function categoryPatch(categoryId: string): FilterPatch {
  return { categoryId, category: "", attributeFilters: "" };
}

export function priceError(min: string, max: string): string | undefined {
  const valid = (value: string) => !value || /^\d{1,18}([.,]\d{1,2})?$/.test(value);
  if (!valid(min) || !valid(max)) return "Укажите цену цифрами, не более двух знаков после запятой.";
  if (min && max && BigInt(catalogPriceToMinor(min) ?? "0") > BigInt(catalogPriceToMinor(max) ?? "0")) {
    return "Цена «От» не должна превышать цену «До».";
  }
  return undefined;
}

function displayPrice(value: string) {
  const [integer, decimal] = value.replace(",", ".").split(".");
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (decimal ? `,${decimal}` : "");
}

export function priceLabel(min: string, max: string) {
  if (min && max) return `Цена: ${displayPrice(min)}–${displayPrice(max)} ₸`;
  if (min) return `Цена: от ${displayPrice(min)} ₸`;
  if (max) return `Цена: до ${displayPrice(max)} ₸`;
  return "Цена";
}

export function categoryChoices(categories: FilterOptions["categories"] = []) {
  const byId = new Map(categories.map(category => [category.id, category]));
  return categories.map(category => {
    const names = [category.name];
    const seen = new Set([category.id]);
    let parent = category.parentId;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const item = byId.get(parent);
      if (!item) break;
      names.unshift(item.name);
      parent = item.parentId;
    }
    return { id: category.id, name: names.join(" / ") };
  }).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export type ActiveFilter = { key: string; label: string; patch: FilterPatch };
export function activeFilters(filters: CatalogFilters, options?: FilterOptions): ActiveFilter[] {
  const active: ActiveFilter[] = [];
  for (const [key, label, items] of [
    ["categoryId", "Категория", options?.categories], ["brandId", "Бренд", options?.brands],
    ["manufacturerId", "Производитель", options?.manufacturers], ["supplierOrganizationId", "Поставщик", options?.suppliers],
  ] as const) {
    if (filters[key]) active.push({ key, label: `${label}: ${items?.find(item => item.id === filters[key])?.name ?? "выбрано"}`,
      patch: key === "categoryId" ? categoryPatch("") : { [key]: "" } });
  }
  if (filters.minPrice || filters.maxPrice) active.push({ key: "price", label: priceLabel(filters.minPrice, filters.maxPrice), patch: { minPrice: "", maxPrice: "" } });
  if (filters.stock !== "all") active.push({ key: "stock", label: filters.stock === "true" ? "Только в наличии" : "Нет в наличии", patch: { stock: "all" } });
  for (const [key, label] of [["packaging", "Фасовка / единица продажи"], ["unit", "Единица"], ["delivery", "Доставка"], ["brand", "Бренд"], ["category", "Категория"]] as const) {
    if (filters[key]) active.push({ key, label: `${label}: ${filters[key]}`, patch: key === "category" ? { category: "", attributeFilters: "" } : { [key]: "" } });
  }
  for (const [code, value] of Object.entries(readAttributes(filters.attributeFilters))) {
    active.push({ key: `attribute:${code}`, label: `${options?.attributes.find(item => item.code === code)?.name ?? code}: ${typeof value === "boolean" ? value ? "Да" : "Нет" : value}`,
      patch: attributePatch(filters, code, "") });
  }
  return active;
}
