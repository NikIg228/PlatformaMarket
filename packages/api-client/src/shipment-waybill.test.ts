import { afterEach, describe, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";
afterEach(() => vi.unstubAllGlobals());
describe("shipment waybill client", () => {
  it("keeps both scopes, concurrency versions and replay key", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 })); vi.stubGlobal("fetch", fetcher);
    const client = new MarketplaceApiClient("http://api.invalid/api", {});
    await client.getShipmentWaybills("order", "shipment");
    const input = { expectedOrderVersion: 2, expectedShipmentVersion: 3, idempotencyKey: "same-retry-key" };
    await client.prepareShipmentWaybill("order", "shipment", input);
    expect(fetcher.mock.calls[0][0]).toBe("http://api.invalid/api/supplier-orders/order/shipments/shipment/waybills");
    expect(fetcher.mock.calls[1][0]).toBe("http://api.invalid/api/supplier-orders/order/shipments/shipment/waybills/prepare");
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "POST", body: JSON.stringify(input) });
  });
});
