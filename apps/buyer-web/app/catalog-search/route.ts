import { NextRequest, NextResponse } from "next/server";
import { attachFallbackCatalogMedia } from "../catalog-fallback.server";
import type { SearchResult } from "../catalog-search-types";

const INTERNAL_API_URL = (
  process.env.INTERNAL_API_URL ??
  (process.env.NEXT_PUBLIC_API_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://127.0.0.1:4012/api")
).replace(/\/$/, "");

export async function GET(request: NextRequest) {
  try {
    const params = new URLSearchParams(request.nextUrl.searchParams);
    const supplierId = params.get("storefrontSupplierId");
    params.delete("storefrontSupplierId");
    if (supplierId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supplierId)) {
      return NextResponse.json({ message: "Invalid supplier identifier" }, { status: 400 });
    }
    // Keep the storefront endpoint authoritative for scope and availability;
    // reuse only the same exact-identity photo enrichment as the public catalogue.
    const path = supplierId ? `/catalog/suppliers/${supplierId}/search` : "/catalog/search";
    const query = params.toString();
    const response = await fetch(
      `${INTERNAL_API_URL}${path}${query ? `?${query}` : ""}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(3_500),
      },
    );
    if (!response.ok) {
      return NextResponse.json(
        { message: "Live catalog is unavailable" },
        { status: response.status },
      );
    }
    const result = (await response.json()) as Partial<SearchResult>;
    if (!Array.isArray(result.items) || typeof result.total !== "number") {
      return NextResponse.json(
        { message: "Live catalog returned an invalid response" },
        { status: 502 },
      );
    }
    return NextResponse.json(
      attachFallbackCatalogMedia(result as SearchResult),
      {
        headers: {
          "cache-control": "no-store",
          ...(response.headers.get("x-request-id")
            ? { "x-request-id": response.headers.get("x-request-id")! }
            : {}),
        },
      },
    );
  } catch {
    return NextResponse.json(
      { message: "Live catalog is unavailable" },
      { status: 502 },
    );
  }
}
