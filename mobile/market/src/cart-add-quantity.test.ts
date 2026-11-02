import { addCartItemSchema } from "../../../packages/schemas/src/index";
import { checkCartAddOfferQuantity, checkCartAddQuantity, usableOfferQuantityRules } from "./cart-add-quantity";

it.each([" 3,500000 ", "1e-6", ".000001", "1000000", "+2.0000000"])("preserves exact numeric/storage quantity %s", raw => { expect(checkCartAddQuantity(raw)).toBeNull(); });
it.each([["", "required"], ["1,2,3", "number"], ["0", "positive"], ["-1", "positive"], ["1000001", "maximum"], ["1.0000000000000000001", "precision"], ["0.0000001", "step"]] as const)("refuses unsafe cart add quantity %s as %s", (raw, kind) => { expect(checkCartAddQuantity(raw)?.kind).toBe(kind); });
it("protects actual CartItem Decimal(18,6) without pretending addCartItemSchema itself restricts the quantum", () => {
  expect(addCartItemSchema.shape.quantity.safeParse(0.0000001).success).toBe(true);
  expect(checkCartAddQuantity("0.0000001")).toEqual({ kind: "step", step: "0.000001" });
});
it("matches the API's increment from minimum, including a nonmultiple minimum", () => {
  expect(checkCartAddOfferQuantity("2.5", "1.5", "1")).toBeNull();
  expect(checkCartAddOfferQuantity("2", "1.5", "1")).toEqual({ kind: "offer-step", minimum: "1.5", step: "1" });
  expect(checkCartAddOfferQuantity("1", "1.5", "1")).toEqual({ kind: "offer-minimum", minimum: "1.5" });
  expect(checkCartAddOfferQuantity("0.000003", "0.000001", "0.000001")).toBeNull();
});
it.each([["0", "1"], ["1", "0"], ["-1", "1"], ["1", "-1"], ["1000000000000000000000000000000000001", "1"], ["1", "0.10000000000000000001"]])( "refuses unsafe/unestablished source minimum %s / increment %s", (minimum, step) => { expect(usableOfferQuantityRules(minimum, step)).toBe(false); });
