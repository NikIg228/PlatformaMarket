import { MarketplaceApiClient } from "@marketplace/api-client";
import type { CatalogSearchResponse, SupplierStorefrontQuery } from "@marketplace/schemas";
import type { SearchResult, SearchMedia } from "../../catalog-search-types";

const api = new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", {});
export async function fetchStorefrontResult(supplierId: string, params: URLSearchParams, signal: AbortSignal): Promise<SearchResult> {
  const value = await api.searchSupplierStorefront(supplierId, Object.fromEntries(params) as SupplierStorefrontQuery, signal);
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
