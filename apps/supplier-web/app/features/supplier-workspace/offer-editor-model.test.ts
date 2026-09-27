import { describe, it, expect } from "vitest";
import { offerPriceMinor, offerQuantity } from "./offer-editor-model";
describe("manual offer values", () => {
  it("converts decimal KZT exactly, including comma input", () => {
    expect(offerPriceMinor("10000")).toBe(1000000);
    expect(offerPriceMinor("0,29")).toBe(29);
    expect(offerPriceMinor("1.01")).toBe(101);
    expect(offerPriceMinor("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
  });
  it("rejects imprecise, unsafe and nonpositive prices", () => {
    for (const value of ["", "0", "1.001", "-1", "Infinity", "1e6", "90071992547409.92"]) expect(() => offerPriceMinor(value)).toThrow();
  });
  it("allows zero stock but not a zero purchase increment", () => {
    expect(offerQuantity("0", true)).toBe(0);
    expect(offerQuantity("1,25")).toBe(1.25);
    for (const value of ["0", "-2", "1e3", "0.0000001"]) expect(() => offerQuantity(value)).toThrow();
  });
});
