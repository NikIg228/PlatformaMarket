import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
describe("order discrepancy client", () => {
  it("sends explicit resupply confirmation with the original concurrency and replay keys", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
    const client = new MarketplaceApiClient("http://api.invalid/api", {});
    const input = { action: "DISPATCH_RESUPPLY" as const, discrepancyId: "claim", expectedOrderVersion: 2,
      expectedShipmentVersion: 3, expectedExceptionVersion: 4, idempotencyKey: "resupply-retry", acknowledged: true as const,
      carrierName: "Carrier", trackingNumber: "NEW-2" };
    await client.executeOrderDiscrepancy("order", input);
    expect(fetcher).toHaveBeenCalledWith("http://api.invalid/api/supplier-orders/order/discrepancies", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
  });
  it("preserves order, claim and attachment scope with exact concurrency and replay inputs", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
    const client = new MarketplaceApiClient("http://api.invalid/api", {});
    const input = { action: "SUBMIT" as const, discrepancyId: "claim", expectedOrderVersion: 2, expectedShipmentVersion: 3, expectedExceptionVersion: 4, idempotencyKey: "same-retry-key" };
    await client.getOrderDiscrepancies("order"); await client.executeOrderDiscrepancy("order", input);
    await client.uploadDiscrepancyAttachment("order", { fileName: "proof.png", contentBase64: "file" });
    await client.downloadDiscrepancyAttachment("order", "claim", "asset");
    expect(fetcher.mock.calls).toEqual([
      ["http://api.invalid/api/supplier-orders/order/discrepancies", expect.objectContaining({ cache: "no-store" })],
      ["http://api.invalid/api/supplier-orders/order/discrepancies", expect.objectContaining({ method: "POST", body: JSON.stringify(input) })],
      ["http://api.invalid/api/supplier-orders/order/discrepancies/attachments", expect.objectContaining({ method: "POST" })],
      ["http://api.invalid/api/supplier-orders/order/discrepancies/claim/attachments/asset", expect.objectContaining({ cache: "no-store" })],
    ]);
  });
});
