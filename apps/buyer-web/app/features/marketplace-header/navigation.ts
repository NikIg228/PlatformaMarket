import { isStorefrontPath, marketplaceCatalogUrl, readMarketplaceCatalog, safeCatalogReturn } from "../../catalog/marketplace-url";

export function catalogContext(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  return pathname.startsWith("/products/")
    ? safeCatalogReturn(params.get("returnTo") ?? undefined)
    : marketplaceCatalogUrl(readMarketplaceCatalog(params), pathname);
}
export function searchDestination(context: string, query: string) {
  const url = new URL(context, "http://local.invalid");
  if (process.env.NEXT_PUBLIC_UNIFIED_APP === "true" && !isStorefrontPath(url.pathname)) url.pathname = "/catalog";
  url.searchParams.set("q", query.trim().slice(0, 240));
  url.searchParams.delete("offset"); url.searchParams.delete("count");
  return url.pathname + url.search;
}
export function deliveryDestination(pathname: string, search: string, cityId: string, inCity: boolean, resetPagination = true) {
  const url = new URL(catalogContext(pathname, search), "http://local.invalid");
  if (resetPagination) { url.searchParams.delete("count"); url.searchParams.delete("offset"); }
  if (cityId) url.searchParams.set("deliveryCityId", cityId); else url.searchParams.delete("deliveryCityId");
  if (cityId && inCity) url.searchParams.set("inCity", "true"); else url.searchParams.delete("inCity");
  const target = url.pathname + url.search;
  if (!pathname.startsWith("/products/")) return target;
  const selection = new URLSearchParams({ returnTo: target });
  const previous = new URLSearchParams(search);
  for (const key of ["variant", "packaging"]) {
    const value = previous.get(key);
    if (value) selection.set(key, value);
  }
  return `${pathname}?${selection}`;
}
