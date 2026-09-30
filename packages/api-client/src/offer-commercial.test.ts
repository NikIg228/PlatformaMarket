import { describe, expect, it, vi } from "vitest";
import { MarketplaceApiClient } from "./index";

describe("offer commercial client", () => {
  it("sends exact terms, selected balance version and one replay key", async () => {
    const client = new MarketplaceApiClient("https://example.invalid/api", {});
    const put = vi.spyOn(client, "put").mockResolvedValue({ offerVersion: 4 });
    const input = { warehouseId: "warehouse-b", expectedOfferVersion: 3, expectedBalanceVersion: 2,
      idempotencyKey: "same-request", amountMinor: "9007199254740993", currency: "KZT" as const, includesVat: true, vatRate: 16, quantityOnHand: 3 };
    await client.saveSupplierOfferCommercial("supplier", "offer", input);
    expect(put).toHaveBeenCalledWith("/suppliers/supplier/offers/offer/commercial", input);
  });
});
