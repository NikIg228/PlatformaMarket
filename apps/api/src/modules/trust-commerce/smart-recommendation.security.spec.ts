import { describe, expect, it, vi } from "vitest";
import { SmartRecommendationService } from "./smart-recommendation.service";

describe("recommendation audience on saved decisions", () => {
  async function replay(buyers: unknown, cities: unknown = []) {
    const service = new SmartRecommendationService({
      organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) },
      address: { findFirst: vi.fn().mockResolvedValue({ cityId: "city" }) },
      recommendationDecision: { findUnique: vi.fn().mockResolvedValue({ buyerOrganizationId: "buyer", result: {
        scenarios: [{ offerId: "offer", priceMinor: 500 }], promoted: [{ offerId: "offer" }], organicBestOfferId: "offer",
      } }) },
      product: { findFirst: vi.fn().mockResolvedValue({ variants: [{ supplierOffers: [{ id: "offer", publication: { allowedBuyerIds: buyers, allowedCityIds: cities } }] }] }) },
    } as never);
    return service.recommend({ buyerOrganizationId: "buyer", destinationAddressId: "address", productId: "product", idempotencyKey: "key" } as never, { actorId: "actor", organizationId: "buyer" });
  }
  it("removes revoked buyer access from all saved scenarios and sponsored results", async () => {
    expect(await replay(["other-buyer"])).toEqual({ scenarios: [], promoted: [], organicBestOfferId: null });
  });
  it("also respects a restricted destination", async () => {
    expect(await replay(["buyer"], ["other-city"])).toEqual({ scenarios: [], promoted: [], organicBestOfferId: null });
  });
  it.each([null, [], ["buyer"]])("retains an authorized saved result (%j)", async buyers => {
    expect(await replay(buyers)).toMatchObject({ scenarios: [{ offerId: "offer", priceMinor: 500 }], promoted: [{ offerId: "offer" }], organicBestOfferId: "offer" });
  });
  it("excludes an inaccessible offer before pricing/ranking a fresh decision", async () => {
    const readPrices = vi.fn(() => { throw new Error("Private prices must not be evaluated"); });
    const offer = { id: "hidden", publication: { allowedBuyerIds: ["other-buyer"] }, get contractPrices() { return readPrices(); } };
    const empty = () => ({ findMany: vi.fn().mockResolvedValue([]) });
    const service = new SmartRecommendationService({
      organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) },
      address: { findFirst: vi.fn().mockResolvedValue({ id: "address", cityId: "city", city: { nameRu: "City" } }) },
      recommendationDecision: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      product: { findFirst: vi.fn().mockResolvedValue({ id: "product", canonicalName: "Product", categories: [], variants: [{ supplierOffers: [offer] }] }) },
      supplierTrustSnapshot: empty(), deliveryPerformanceEvent: { groupBy: vi.fn().mockResolvedValue([]) }, promotion: empty(), supplierOrderItem: empty(), productGapIncident: empty(), deliveryRule: empty(),
      featureFlag: { findUnique: vi.fn().mockResolvedValue(null) }, auditLog: { create: vi.fn() }, $transaction: vi.fn().mockResolvedValue([]),
    } as never);
    const result = await service.recommend({ buyerOrganizationId: "buyer", destinationAddressId: "address", productId: "product", idempotencyKey: "fresh", mode: "BALANCED", quantity: 1 } as never, { actorId: "actor", organizationId: "buyer" });
    expect(result).toMatchObject({ scenarios: [], promoted: [] }); expect(readPrices).not.toHaveBeenCalled();
  });
});
