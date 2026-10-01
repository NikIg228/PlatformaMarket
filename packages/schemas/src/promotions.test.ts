import { describe, expect, it } from "vitest";
import { giftForPromotionQuantity, promotionTermsSchema, promotionListQuerySchema, orderItemPromotion, acceptedPromotionSchema, sameAcceptedPromotion } from "./promotions";

describe("offer promotion contracts", () => {
  it("compares accepted terms by value after PostgreSQL JSONB reorders object keys", () => {
    const promotion = acceptedPromotionSchema.parse({ promotionId: "10000000-0000-4000-8000-000000000001", revision: 1, name: "Test", kind: "BUY_X_GET_Y", baseUnitPriceMinor: "100", unitPriceMinor: "100", discountMinor: "0", endsAt: "2030-02-01", buyQuantity: "5", giftPerGroup: "1", gift: { offerId: "10000000-0000-4000-8000-000000000002", name: "Gift", quantity: "2" } });
    const reordered = Object.fromEntries(Object.entries(promotion).reverse()) as typeof promotion;
    reordered.gift = { quantity: "2", name: "Gift", offerId: promotion.gift!.offerId };
    expect(sameAcceptedPromotion(promotion, reordered)).toBe(true);
    expect(sameAcceptedPromotion(promotion, { ...reordered, gift: { ...reordered.gift, quantity: "1" } })).toBe(false);
    expect(sameAcceptedPromotion(promotion, null)).toBe(false);
  });
  it("calculates fractional groups exactly, with an accepted gift cap", () => {
    expect(giftForPromotionQuantity("0.3", "0.1", "0.1")).toBe("0.3");
    expect(giftForPromotionQuantity("9", "5", "2")).toBe("2");
    expect(giftForPromotionQuantity("10", "5", "2", "3")).toBe("3");
    expect(giftForPromotionQuantity("999999999999.999999", "0.000001", "0.000001")).toBe("999999999999.999999");
    expect(giftForPromotionQuantity("4", "5", "2")).toBe("0");
    expect(() => giftForPromotionQuantity("2", "0", "1")).toThrow();
  });
  it("rejects missing gift terms, zero limits and reversed dates", () => {
    const value = { offerId: "10000000-0000-4000-8000-000000000001", name: "Synthetic promotion", kind: "BUY_X_GET_Y", quantityLimit: "10", startsAt: "2030-01-01T00:00:00Z", endsAt: "2030-02-01T00:00:00Z" };
    expect(promotionTermsSchema.safeParse(value).success).toBe(false);
    const gift = { ...value, buyQuantity: "5", giftQuantity: "1", giftOfferId: value.offerId };
    expect(promotionTermsSchema.safeParse(gift).success).toBe(true);
    expect(promotionTermsSchema.safeParse({ ...gift, quantityLimit: "0.000000" }).success).toBe(false);
    expect(promotionTermsSchema.safeParse({ ...gift, endsAt: value.startsAt }).success).toBe(false);
  });
  it("does not treat the string false as a featured filter", () => {
    expect(promotionListQuerySchema.parse({ featured: "false" }).featured).toBe(false);
    expect(promotionListQuerySchema.parse({ featured: "true" }).featured).toBe(true);
    expect(promotionListQuerySchema.safeParse({ featured: "anything" }).success).toBe(false);
    expect(orderItemPromotion({ pricing: { promotion: { name: "Incomplete historical record" } } })).toBeNull();
  });
});
