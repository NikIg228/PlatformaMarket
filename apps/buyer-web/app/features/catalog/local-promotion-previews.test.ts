import { expect, it } from "vitest";
import { localPromotionPreviews } from "./local-promotion-previews";

it("keeps preview campaigns out of production and removes expired examples", () => {
  const now = Date.parse("2026-10-12T00:00:00Z");
  expect(localPromotionPreviews({}, "production", now)).toEqual([]);
  expect(localPromotionPreviews({}, "test", now)).toEqual([]);
  expect(localPromotionPreviews({}, "development", now)).toHaveLength(8);
  expect(localPromotionPreviews({}, "development", Date.parse("2026-10-31T18:59:59Z"))).toEqual([]);
});
it("filters preview campaigns without exposing another category or supplier", () => {
  const now = Date.parse("2026-10-12T00:00:00Z");
  expect(localPromotionPreviews({ q: "Перчатки", kind: "BUY_X_GET_Y" }, "development", now)).toHaveLength(1);
  expect(localPromotionPreviews({ categoryId: "real-category" }, "development", now)).toEqual([]);
  expect(localPromotionPreviews({ supplierOrganizationId: "real-supplier" }, "development", now)).toEqual([]);
});
