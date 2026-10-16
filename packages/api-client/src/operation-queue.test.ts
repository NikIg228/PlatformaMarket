import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
it("encodes global queue filters, paging and abort without adding actor context to the query", async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const client = new MarketplaceApiClient("http://api.invalid/api", {}), abort = new AbortController();
  await client.operationWorkQueue({ q: "100% & #_заказ", kind: "SUPPLIER_CONFIRMATION", priority: "CRITICAL", assignment: "MINE", due: "OVERDUE", sort: "queue", offset: 50 }, abort.signal);
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.pathname).toBe("/api/operations/work-queue");
  expect(Object.fromEntries(url.searchParams)).toEqual({ q: "100% & #_заказ", kind: "SUPPLIER_CONFIRMATION", priority: "CRITICAL", assignment: "MINE", due: "OVERDUE", sort: "queue", offset: "50" });
  expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store" });
  abort.abort(); expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});
