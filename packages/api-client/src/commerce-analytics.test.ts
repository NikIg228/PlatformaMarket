import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index.js";
afterEach(() => vi.restoreAllMocks());
it("encodes analytics offset instants and preserves bearer/abort context", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
  const api = new MarketplaceApiClient("http://localhost/api", { accessToken: "synthetic" });
  const controller = new AbortController();
  await api.commerceAnalytics({ from: "2026-10-01T00:00:00+05:00", to: "2026-10-02T00:00:00+05:00", timezone: "Asia/Qyzylorda", dataset: "TEST", currency: "KZT", page: 2, pageSize: 25 }, { signal: controller.signal });
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(url.pathname).toBe("/api/commerce-analytics"); expect(url.searchParams.get("from")).toBe("2026-10-01T00:00:00+05:00"); expect(url.searchParams.get("page")).toBe("2");
  const sentSignal = fetcher.mock.calls[0][1]?.signal;
  expect(sentSignal?.aborted).toBe(false);
  controller.abort();
  expect(sentSignal?.aborted).toBe(true);
  expect(fetcher.mock.calls[0][1]?.headers).toEqual({ "content-type": "application/json", authorization: "Bearer synthetic" });
});
