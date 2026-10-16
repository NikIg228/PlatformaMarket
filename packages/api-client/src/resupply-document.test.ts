import { afterEach, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
it("preserves claim/document scopes and all preparation versions", async () => {
  const fetcher = vi.fn(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
  const client = new MarketplaceApiClient("http://api.invalid/api", {});
  await client.getResupplyDocuments("order", "claim");
  const input = { kind: "SETTLEMENT" as const, expectedOrderVersion: 1, expectedShipmentVersion: 2, expectedExceptionVersion: 3, expectedResupplyVersion: 4, idempotencyKey: "draft-replay" };
  await client.prepareResupplyDocument("order", "claim", input);
  await client.downloadResupplyDocument("order", "claim", "document");
  expect(fetcher.mock.calls).toHaveLength(3);
  expect(fetcher).toHaveBeenNthCalledWith(2, "http://api.invalid/api/supplier-orders/order/discrepancies/claim/documents/prepare", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
  expect(fetcher).toHaveBeenNthCalledWith(3, "http://api.invalid/api/supplier-orders/order/discrepancies/claim/documents/document/download", expect.anything());
});
