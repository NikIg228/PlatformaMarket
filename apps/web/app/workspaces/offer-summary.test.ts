import { describe, expect, it } from "vitest";
import type { WorkspaceOffer } from "@marketplace/schemas";
import { offerAttention, totalAvailable } from "./offer-summary";
function offer(values: string[] = []) {
  return { prices: [{ status: "ACTIVE", freshnessExpiresAt: null }], publication: null,
    inventoryBalances: values.map(quantityAvailable => ({ quantityAvailable, freshnessStatus: "FRESH", freshnessExpiresAt: null })),
  } as WorkspaceOffer;
}
describe("compact offer summary", () => {
  it("preserves decimal quantities and large totals exactly", () => {
    expect(totalAvailable(offer(["0.1", "0.2"]))).toBe("0.3");
    expect(totalAvailable(offer(["99999999999999.999999", "0.000001"]))).toBe("100000000000000");
    expect(totalAvailable(offer(["0.000", "0"]))).toBe("0");
  });
  it("distinguishes expired confirmations from no expiration and missing values", () => {
    const value = offer(["1"]);
    expect(offerAttention(value, 1000).needsAttention).toBe(false);
    value.prices[0]!.freshnessExpiresAt = "1970-01-01T00:00:01.000Z";
    expect(offerAttention(value, 1000).priceWarning).toBe("Подтвердите цену");
    value.inventoryBalances[0]!.freshnessStatus = "STALE";
    expect(offerAttention(value).stockWarning).toBe("Обновите остаток");
    expect(offerAttention({ ...value, prices: [], inventoryBalances: [] })).toMatchObject({ priceWarning: "Укажите цену", stockWarning: "Укажите остаток" });
  });
});
