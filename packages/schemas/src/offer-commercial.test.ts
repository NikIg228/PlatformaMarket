import { describe, expect, it } from "vitest";
import { saveOfferCommercialSchema, saveOfferStockSchema, saveOfferPriceSchema } from "./offer-commercial";
const valid = { warehouseId: "11111111-1111-4111-8111-111111111111", expectedOfferVersion: 3, expectedBalanceVersion: 2,
  idempotencyKey: "commercial-save-1", amountMinor: "9007199254740993", currency: "KZT", includesVat: true, vatRate: 16, quantityOnHand: 10 };
describe("atomic offer commercial request", () => {
  it("keeps separate commands strict so stock cannot carry price and price cannot carry stock", () => {
    const { amountMinor, currency, includesVat, vatRate, ...stock } = valid;
    expect(saveOfferStockSchema.parse(stock).quantityOnHand).toBe(10);
    expect(saveOfferStockSchema.safeParse(valid).success).toBe(false);
    expect(saveOfferStockSchema.safeParse({ ...stock, quantityOnHand: -1 }).success).toBe(false);
    const { quantityOnHand: _quantity, ...price } = valid;
    expect(saveOfferPriceSchema.parse(price)).toMatchObject({ amountMinor, currency, includesVat, vatRate });
    expect(saveOfferPriceSchema.safeParse(valid).success).toBe(false);
  });
  it("keeps exact minor units beyond Number.MAX_SAFE_INTEGER", () => {
    expect(saveOfferCommercialSchema.parse(valid).amountMinor).toBe("9007199254740993");
  });
  it("requires an explicit new-balance expectation and both version fields", () => {
    expect(saveOfferCommercialSchema.safeParse({ ...valid, expectedBalanceVersion: null }).success).toBe(true);
    expect(saveOfferCommercialSchema.safeParse({ ...valid, expectedBalanceVersion: undefined }).success).toBe(false);
    expect(saveOfferCommercialSchema.safeParse({ ...valid, expectedOfferVersion: undefined }).success).toBe(false);
  });
  it.each([{ amountMinor: 1200 }, { amountMinor: "1.5" }, { amountMinor: "-1" }, { quantityOnHand: -1 }, { vatRate: 101 }])("rejects invalid terms %j", changes => {
    expect(saveOfferCommercialSchema.safeParse({ ...valid, ...changes }).success).toBe(false);
  });
});
