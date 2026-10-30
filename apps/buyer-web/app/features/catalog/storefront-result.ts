import type { CatalogSearchResponse } from "@marketplace/schemas";
import type { SearchResult, SearchMedia } from "../../catalog-search-types";
import { fetchLiveCatalog } from "../../catalog/live-search";

export async function fetchStorefrontResult(supplierId: string, params: URLSearchParams, signal: AbortSignal): Promise<SearchResult> {
  const query = new URLSearchParams(params);
  query.set("storefrontSupplierId", supplierId);
  const value = await fetchLiveCatalog<CatalogSearchResponse>(query, signal);
  return storefrontResult(value);
}

function mediaMetadata(value: unknown): SearchMedia["metadata"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  return {
    exactProductPhoto: data.exactProductPhoto === true,
    rightsStatus: typeof data.rightsStatus === "string" ? data.rightsStatus : undefined,
    sourceImageUrl: typeof data.sourceImageUrl === "string" ? data.sourceImageUrl : null,
  };
}
export function storefrontResult(value: CatalogSearchResponse): SearchResult {
  return { ...value, items: value.items.map(product => ({ ...product,
    media: product.media.map(media => ({ ...media, metadata: mediaMetadata(media.metadata) })),
  })) };
}
