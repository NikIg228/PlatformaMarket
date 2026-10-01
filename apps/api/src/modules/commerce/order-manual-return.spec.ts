import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { returnedLineAmount } from "./order-manual-return";
const d = (n: string) => new Prisma.Decimal(n);
describe("partial return amounts", () => {
  it("retains exact amounts above Number precision", () => {
    expect(returnedLineAmount(d("9007199254740994"), d("2"), d("0"), d("1")).toString()).toBe("4503599627370497");
  });
  it("allocates rounding cumulatively so repeated returns never exceed the original", () => {
    const amounts = ["0", "1", "2"].map(previous => returnedLineAmount(d("100"), d("3"), d(previous), d("1")));
    expect(amounts.map(value => value.toString())).toEqual(["33", "34", "33"]);
  });
  it("preserves the smallest quantity at the maximum money boundary", () => {
    expect(returnedLineAmount(d("99999999999999999999"), d("999999999999.999999"), d("0"), d("0.000001")).toString()).toBe("100");
  });
});
