import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";

afterEach(() => vi.unstubAllGlobals());
describe("operator projection client", () => {
  it.each(["operatorDashboard", "operatorCapabilities"] as const)("%s uses the protected read route and supports cancellation", async method => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ observedAt: "2026-10-14T00:00:00Z" }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const client = new MarketplaceApiClient("http://api.invalid/api", {});
    expect(await client[method](controller.signal)).toMatchObject({ observedAt: "2026-10-14T00:00:00Z" });
    expect(fetcher.mock.calls[0][0]).toBe(`http://api.invalid/api/operations/${method === "operatorDashboard" ? "dashboard" : "capabilities"}`);
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeUndefined(); expect(init.cache).toBe("no-store");
    controller.abort(); expect(init.signal?.aborted).toBe(true);
  });
});
