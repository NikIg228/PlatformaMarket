import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
it("passes opaque cursors and filters without a caller-supplied tenant", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ items: [], nextCursor: null }));
  vi.stubGlobal("fetch", fetcher);
  const api = new MarketplaceApiClient("http://localhost/api", {});
  await api.workspaceOrders("buyer", { q: "A & B", status: "PAID", cursor: "opaque+/=", limit: 25 });
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(url.pathname).toBe("/api/workspaces/buyer/orders");
  expect(Object.fromEntries(url.searchParams)).toEqual({ q: "A & B", status: "PAID", cursor: "opaque+/=", limit: "25" });
  await api.workspaceCart("cart-id");
  expect(String(fetcher.mock.calls[1][0])).toBe("http://localhost/api/workspaces/buyer/carts/cart-id");
});
it("cancels auxiliary GETs without sending a caller-selected tenant", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ items: [], nextCursor: null }));
  vi.stubGlobal("fetch", fetcher);
  const api = new MarketplaceApiClient("http://localhost/api", {});
  const controller = new AbortController();
  await api.workspaceLots("balance/id", { cursor: "opaque", limit: 25 }, { signal: controller.signal });
  expect(String(fetcher.mock.calls[0][0])).toBe("http://localhost/api/workspaces/supplier/inventory/balance%2Fid/lots?cursor=opaque&limit=25");
  const signal = fetcher.mock.calls[0][1]?.signal;
  expect(signal?.aborted).toBe(false); controller.abort(); expect(signal?.aborted).toBe(true);
});
