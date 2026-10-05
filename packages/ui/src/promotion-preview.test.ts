import { describe, expect, it } from "vitest";
import type { PromotionTerms } from "@marketplace/schemas";
import { promotionPreviewPrice, promotionDiscountFromPrice } from "./promotion-preview";
describe("promotion price preview", () => {
  it("uses integer minor-unit rounding, including large amounts", () => {
    expect(promotionPreviewPrice({ kind: "PERCENTAGE", percentageBasisPoints: 1000 } as PromotionTerms, "1999")).toBe("1800");
    expect(promotionPreviewPrice({ kind: "FIXED_AMOUNT", fixedAmountMinor: "1" } as PromotionTerms, "99999999999999999999")).toBe("99999999999999999998");
  });
  it("does not invent prices for invalid drafts or free offers", () => {
    expect(promotionPreviewPrice({ kind: "PERCENTAGE", percentageBasisPoints: NaN } as PromotionTerms, "1999")).toBeNull();
    expect(promotionPreviewPrice({ kind: "FIXED_AMOUNT", fixedAmountMinor: "2000" } as PromotionTerms, "1999")).toBeNull();
    expect(promotionPreviewPrice({ kind: "PERCENTAGE", percentageBasisPoints: 1000 } as PromotionTerms, null)).toBeNull();
  });
  it("derives discount from a lower entered sale price without floating point", () => {
    expect(promotionDiscountFromPrice("10,01", "1500")).toBe("499");
    expect(promotionDiscountFromPrice("15", "1500")).toBeNull();
    expect(promotionDiscountFromPrice("0", "1500")).toBeNull();
    expect(promotionDiscountFromPrice("10.001", "1500")).toBeNull();
  });
});
