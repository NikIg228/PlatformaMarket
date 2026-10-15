import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
it("encodes registry search and detail IDs and forwards abort without writing", async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const client = new MarketplaceApiClient("http://api.invalid/api", {}), controller = new AbortController();
  await client.operatorOrganizations({ q: "#clinic & bin", status: "ARCHIVED", offset: 25 }, controller.signal);
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.pathname).toBe("/api/operations/organizations"); expect(url.searchParams.get("q")).toBe("#clinic & bin");
  expect(url.searchParams.get("offset")).toBe("25");
  expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  expect(fetcher.mock.calls[0][1].body).toBeUndefined();
  await client.operatorOrganization("id/with?query", controller.signal);
  expect(fetcher.mock.calls[1][0]).toBe("http://api.invalid/api/operations/organizations/id%2Fwith%3Fquery");
  controller.abort(); expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true); expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
});
