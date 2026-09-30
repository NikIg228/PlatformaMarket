import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";
describe("exact minor-unit presentation", () => {
  it("retains tiyn above Number precision", () => expect(formatMoney("9007199254740993").replace(/[\s\u00a0]/g, "")).toBe("90071992547409,93₸"));
  it("retains sub-unit and negative values", () => { expect(formatMoney("1")).toContain("0,01"); expect(formatMoney("-50")).toContain("−0,50"); });
  it("never guesses unsafe numeric inputs", () => expect(formatMoney(9007199254740993)).toBe("Сумма недоступна"));
});
