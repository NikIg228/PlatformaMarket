import { describe, expect, it } from "vitest";
import { initialQuantity, validQuantity } from "./supplier-quantity";

describe("supplier quantity selection", () => {
  it("accepts 1 through 100 and rejects empty, non-finite, zero and excessive input", () => {
    for (const value of ["1", "10", "99", "100"]) expect(validQuantity(value, {})).toBe(true);
    for (const value of ["", " ", "0", "-1", "101", "1000000", "NaN", "Infinity", "1.5"]) expect(validQuantity(value, {})).toBe(false);
  });
  it("retains supplier minimum and increments within the limit", () => {
    const offer = { minimumOrderQuantity: "3", orderIncrement: "2" };
    expect(initialQuantity(offer)).toBe("4");
    expect(validQuantity("2", offer)).toBe(false);
    expect(validQuantity("3", offer)).toBe(false);
    expect(validQuantity("100", offer)).toBe(true);
    expect(validQuantity("102", offer)).toBe(false);
    expect(validQuantity("0.25", { minimumOrderQuantity: "0.25", orderIncrement: "0.25" })).toBe(true);
    expect(validQuantity(initialQuantity({ minimumOrderQuantity: "101" }), { minimumOrderQuantity: "101" })).toBe(false);
  });
});
