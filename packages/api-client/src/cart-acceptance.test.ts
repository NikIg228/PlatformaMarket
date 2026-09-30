import { afterEach, expect, it, vi } from "vitest";
import { repriceCartSchema, cartLineSnapshotSchema } from "@marketplace/schemas";
import { MarketplaceApiClient } from "./index.js";

afterEach(() => vi.unstubAllGlobals());
it("sends only the failed cart identity and expected version for recovery", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", fetcher);
  await new MarketplaceApiClient("http://localhost/api", {}).recoverCart("source-cart", { expectedVersion: 4 });
  expect(String(fetcher.mock.calls[0][0])).toBe("http://localhost/api/carts/source-cart/recover");
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ expectedVersion: 4 });
});
const snapshot = {
  resolvedAt: "2026-09-30T00:00:00.000Z", offerVersion: 1, source: "BASE", ruleId: null,
  unitPriceMinor: "9007199254740993", quantity: "1", totalPriceMinor: "9007199254740993", currency: "KZT",
  minimumOrderQuantity: "1", orderIncrement: "1", availableQuantity: "10", fulfillmentStatus: "AVAILABLE" as const,
  commercialTerms: { saleUnitId: null, saleUnitName: null, packagingId: null, packagingName: null,
    baseUnitsPerSaleUnit: "1", packagingUnitId: null, packagingQuantity: null, includesVat: true, vatRate: "12" },
};
const acceptedItems = [{ cartItemId: "11111111-1111-4111-8111-111111111111", snapshot }];
it("transports the displayed commercial snapshot without losing exact monetary values", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", fetcher);
  const input = repriceCartSchema.parse({ expectedVersion: 7, acceptedItems });
  await new MarketplaceApiClient("http://localhost/api", {}).repriceCart("cart", input);
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual(input);
  expect(cartLineSnapshotSchema.parse(snapshot).commercialTerms?.vatRate).toBe("12");
});
it("rejects ambiguous duplicate consent and preserves reading historical snapshots", () => {
  expect(repriceCartSchema.safeParse({ acceptedItems: [...acceptedItems, ...acceptedItems] }).success).toBe(false);
  expect(cartLineSnapshotSchema.safeParse({ ...snapshot, commercialTerms: undefined }).success).toBe(true);
});
