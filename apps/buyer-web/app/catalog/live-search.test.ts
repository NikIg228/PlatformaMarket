import { afterEach, expect, it, vi } from "vitest";
import { appendCatalogPage, fetchLiveCatalog, loadCatalogWindow } from "./live-search";
afterEach(() => vi.unstubAllGlobals());
it("does not inject the retired header's saved city into a catalog request", async () => {
  vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify({ id: "62eb0572-edeb-44cc-ac8b-bea17a24049d", name: "Алматы" }) } });
  const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [{ id: "visible-product" }], total: 1 }));
  vi.stubGlobal("fetch", fetcher);
  const params = new URLSearchParams({ q: "", limit: "24" });
  expect((await fetchLiveCatalog(params)).total).toBe(1);
  expect(fetcher.mock.calls[0][0]).toBe("/catalog-search?q=&limit=24");
  expect(params.has("cityId")).toBe(false);
});
it("preserves an explicitly supplied city instead of overriding it from old storage", async () => {
  vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify({ id: "old-city" }) } });
  const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [], total: 0 }));
  vi.stubGlobal("fetch", fetcher);
  await fetchLiveCatalog(new URLSearchParams({ cityId: "selected-city" }));
  expect(fetcher.mock.calls[0][0]).toBe("/catalog-search?cityId=selected-city");
});
it("exposes API outage instead of silently fetching a reserve catalog", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({}, { status: 500 })); vi.stubGlobal("fetch", fetcher);
  await expect(fetchLiveCatalog(new URLSearchParams())).rejects.toThrow("временно недоступен");
  expect(fetcher).toHaveBeenCalledTimes(3); expect(fetcher.mock.calls[0][0]).toBe("/catalog-search?");
});
it("restores multiple pages with bounded requests", async () => {
  const load = vi.fn(async (offset: number, limit: number) => ({ items: Array.from({ length: Math.min(limit, 53-offset) }, (_, i) => ({ id: String(offset+i) })), total: 53 }));
  expect((await loadCatalogWindow(load, 72)).items).toHaveLength(53);
  expect(load.mock.calls).toEqual([[0,24], [24,24], [48,24]]);
});

it("merges overlapping pages by product ID while advancing by raw API rows", () => {
  const first = appendCatalogPage(null, { items: [{ id: "a", price: 1 }, { id: "a", price: 2 }], total: 4 });
  const merged = appendCatalogPage(first, { items: [{ id: "a", price: 3 }, { id: "b", price: 4 }], total: 4 });
  expect(merged.items).toEqual([{ id: "a", price: 3 }, { id: "b", price: 4 }]);
  expect(merged.nextOffset).toBe(4);
});

it("restores overlapping pages without requesting the same offset again", async () => {
  const load = vi.fn(async (offset: number) => ({
    items: offset < 4 ? [{ id: "same" }, { id: "same" }] : [], total: 6,
  }));
  const result = await loadCatalogWindow(load, 6);
  expect(result.items).toEqual([{ id: "same" }]);
  expect(result.nextOffset).toBe(6);
  expect(load.mock.calls.map(([offset]) => offset)).toEqual([0, 2, 4]);
});
