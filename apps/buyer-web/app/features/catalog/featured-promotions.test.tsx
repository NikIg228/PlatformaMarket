import React from "react";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PublicPromotion } from "@marketplace/schemas";
import { FeaturedPromotions } from "./featured-promotions";

it("renders real promotion mechanics, seller, dates and product destinations", () => {
  const item: PublicPromotion = { id: "promotion", supplierOrganizationId: "supplier", supplierName: "Поставщик", offerName: "Композит A2", productId: "product", giftName: "Адгезив", temporalStatus: "ACTIVE", unitPriceMinor: "80000", baseAmountMinor: "100000", currency: "KZT", terms: { offerId: "offer", name: "Композиты со скидкой", description: "", kind: "PERCENTAGE", percentageBasisPoints: 2000, fixedAmountMinor: null, buyQuantity: null, giftOfferId: null, giftQuantity: null, minimumQuantity: "2", quantityLimit: "100", startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-10-31T00:00:00.000Z" } };
  const html = renderToStaticMarkup(<FeaturedPromotions page={{ items: [item, { ...item, id: "gift", terms: { ...item.terms, kind: "BUY_X_GET_Y", buyQuantity: "5", giftQuantity: "1" } }], total: 2, offset: 0, limit: 5 }} loading={false} error={null} onRetry={() => {}} />);
  expect(html).toContain("−20%"); expect(html).toContain("5 + 1"); expect(html).toContain("Подарок: Адгезив"); expect(html).toContain("От 2"); expect(html).toContain("/products/product"); expect(html).toContain("Поставщик"); expect(html).not.toContain("Все акции");
});
