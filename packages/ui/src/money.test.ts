import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyInput, moneyInputValue } from "./money";
describe("exact minor-unit presentation", () => {
  it("retains tiyn above Number precision", () => expect(formatMoney("9007199254740993").replace(/[\s\u00a0]/g, "")).toBe("90071992547409,93₸"));
  it("retains sub-unit and negative values", () => { expect(formatMoney("1")).toContain("0,01"); expect(formatMoney("-50")).toContain("−0,50"); });
  it("never guesses unsafe numeric inputs", () => expect(formatMoney(9007199254740993)).toBe("Сумма недоступна"));
  it("parses exact major units including amounts beyond Number precision", () => {
    expect(parseMoneyInput("90071992547409,93")).toBe("9007199254740993");
    expect(parseMoneyInput("0.01")).toBe("1");
    expect(moneyInputValue("9007199254740993")).toBe("90071992547409.93");
  });
  it("rejects ambiguous, rounded, zero and overflowing inputs", () => {
    for (const value of ["", "0", "-1", "1e3", "1.001", "1,000.00", "1000000000000000000"]) expect(parseMoneyInput(value)).toBeNull();
  });
});
