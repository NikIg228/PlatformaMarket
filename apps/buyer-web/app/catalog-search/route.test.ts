import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { searchFallbackCatalog } from "../catalog-fallback.server";

const supplierId = "c5d2ce73-d2ad-42b3-8fc6-4528f9f5b746";
afterEach(() => vi.unstubAllGlobals());
describe("catalogue media composition", () => {
  it("keeps supplier scope, live offers and total while adding only exact-identity photos", async () => {
    const original = searchFallbackCatalog("", "RELEVANCE").items[0]!;
    const product = { ...original, id: "live-id", media: [], offers: [] };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ total: 1, items: [product], facets: { categories: [], suppliers: [] } }), { headers: { "x-request-id": "trace-id" } }));
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(new NextRequest(`http://localhost/catalog-search?storefrontSupplierId=${supplierId}&q=cement&limit=5`));
    expect(fetcher.mock.calls[0][0]).toMatch(new RegExp(`/catalog/suppliers/${supplierId}/search\\?q=cement&limit=5$`));
    const body = await response.json();
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: "live-id", offers: [] });
    expect(body.items[0].media[0].securePath).toMatch(/^\/catalog\/products\//);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBe("trace-id");
  });
  it("rejects invalid supplier identifiers before any upstream request", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    for (const id of ["", "../settings", "https://other.invalid"]) {
      const response = await GET(new NextRequest(`http://localhost/catalog-search?storefrontSupplierId=${encodeURIComponent(id)}`));
      expect(response.status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves upstream failure without replacing it with snapshot products", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const response = await GET(new NextRequest(`http://localhost/catalog-search?storefrontSupplierId=${supplierId}`));
    expect(response.status).toBe(404);
    expect(await response.json()).not.toHaveProperty("items");
  });
  it("keeps the normal public catalogue endpoint unchanged", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ total: 0, items: [] })));
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(new NextRequest("http://localhost/catalog-search?q=test"));
    expect(response.status).toBe(200);
    expect(fetcher.mock.calls[0][0]).toMatch(/\/catalog\/search\?q=test$/);
    expect((await response.json()).items).toEqual([]);
  });
});
