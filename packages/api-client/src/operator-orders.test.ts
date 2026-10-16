import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
it("encodes order filters/IDs and preserves abort for read-only uncached requests", async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const client = new MarketplaceApiClient("http://api.invalid/api", {}), abort = new AbortController();
  await client.operatorOrders({ q: "#order & clinic", buyer: "ТОО &", offset: 25 }, abort.signal);
  const url = new URL(fetcher.mock.calls[0][0]); expect(url.pathname).toBe("/api/operations/orders");
  expect(url.searchParams.get("q")).toBe("#order & clinic"); expect(url.searchParams.get("buyer")).toBe("ТОО &");
  expect(url.searchParams.get("offset")).toBe("25"); expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  await client.operatorOrder("id/with?query", abort.signal);
  expect(fetcher.mock.calls[1][0]).toBe("http://api.invalid/api/operations/orders/id%2Fwith%3Fquery");
  abort.abort(); expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true); expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
});
