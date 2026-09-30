import { marketplaceCatalogUrl, readMarketplaceCatalog, safeCatalogReturn } from "../../catalog/marketplace-url";

export function catalogContext(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  return pathname.startsWith("/products/")
    ? safeCatalogReturn(params.get("returnTo") ?? undefined)
    : marketplaceCatalogUrl(readMarketplaceCatalog(params), pathname);
}
export function searchDestination(context: string, query: string) {
  const url = new URL(context, "http://local.invalid");
  if (process.env.NEXT_PUBLIC_UNIFIED_APP === "true") url.pathname = "/catalog";
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
  return pathname.startsWith("/products/") ? `${pathname}?${new URLSearchParams({ returnTo: target })}` : target;
}
