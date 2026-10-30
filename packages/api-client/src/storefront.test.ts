import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
const id = "00000000-0000-4000-8000-000000000001";
afterEach(() => vi.unstubAllGlobals());
it("keeps public reads separate from authenticated storefront editing and preserves cancellation", async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const publicApi = new MarketplaceApiClient("/api", {}), signal = new AbortController().signal;
  await publicApi.supplierStorefront(id, signal);
  await publicApi.searchSupplierStorefront(id, { q: "A2 & B", offset: 24 }, signal);
  expect(fetcher.mock.calls[0]![0]).toBe(`/api/catalog/suppliers/${id}`);
  expect(fetcher.mock.calls[1]![0]).toBe(`/api/catalog/suppliers/${id}/search?q=A2+%26+B&offset=24`);
  expect(fetcher.mock.calls[0]![1].headers).not.toHaveProperty("x-organization-id");
  expect(fetcher.mock.calls[0]![1].signal).toBeDefined();
  const api = new MarketplaceApiClient("/api", { userId: id, organizationId: id });
  const input = { expectedVersion: 4, content: { ru: { description: "", location: "", hours: "", delivery: "" }, kk: { description: "", location: "", hours: "", delivery: "" } } };
  await api.saveSupplierStorefront(id, input);
  expect(fetcher.mock.calls[2]![0]).toBe(`/api/suppliers/${id}/storefront`);
  expect(fetcher.mock.calls[2]![1]).toMatchObject({ method: "POST", body: JSON.stringify(input) });
});
