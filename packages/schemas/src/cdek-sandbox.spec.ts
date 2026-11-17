import { describe, expect, it } from "vitest";
import { cdekCityQuerySchema, cdekSandboxQuoteInputSchema, cdekSandboxQuoteSchema } from "./cdek-sandbox";
describe("CDEK public contract", () => {
  const input = { fromCityCode: 4756, toCityCode: 7669, packages: [{ weight: 1000, length: 20, width: 20, height: 10 }] };
  it("accepts explicit parcel units and rejects server configuration injection", () => {
    expect(cdekSandboxQuoteInputSchema.safeParse(input).success).toBe(true);
    expect(cdekSandboxQuoteInputSchema.safeParse({ ...input, baseUrl: "https://api.cdek.ru" }).success).toBe(false);
  });
  it.each([0, -1, 0.5, 100001, Infinity])("rejects invalid gram weight %s", weight => {
    expect(cdekSandboxQuoteInputSchema.safeParse({ ...input, packages: [{ ...input.packages[0], weight }] }).success).toBe(false);
  });
  it("bounds empty and oversized searches", () => {
    expect(cdekCityQuerySchema.safeParse({ city: " " }).success).toBe(false);
    expect(cdekCityQuerySchema.safeParse({ city: "a".repeat(101) }).success).toBe(false);
  });
  it("cannot represent a payable sandbox result", () => {
    const result = { mode: "sandbox", payable: false, currency: "KZT", calculatedAt: new Date().toISOString(), tariffs: [] };
    expect(cdekSandboxQuoteSchema.safeParse(result).success).toBe(true);
    expect(cdekSandboxQuoteSchema.safeParse({ ...result, payable: true }).success).toBe(false);
  });
});
