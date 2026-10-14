import { expect, it } from "vitest";
import type { CartLineSnapshotResponse } from "@marketplace/schemas";
import { cartCommercialChanges } from "./cart-commercial-changes";
import { calculateVatLine, type VatPriceSnapshot } from "@marketplace/schemas";

const snapshot: CartLineSnapshotResponse = {
  resolvedAt: "2026-09-30T00:00:00.000Z", offerVersion: 1, source: "BASE", ruleId: "price",
  unitPriceMinor: "10000", quantity: "1", totalPriceMinor: "10000", currency: "KZT",
  minimumOrderQuantity: "1", orderIncrement: "1", availableQuantity: "10", fulfillmentStatus: "AVAILABLE",
  commercialTerms: { saleUnitId: null, saleUnitName: "штука", packagingId: null, packagingName: null,
    baseUnitsPerSaleUnit: "1", packagingUnitId: null, packagingQuantity: null, includesVat: true, vatRate: "12" },
};
it("shows material old and new terms before acceptance, even when the price is unchanged", () => {
  const changes = cartCommercialChanges(snapshot, { ...snapshot, minimumOrderQuantity: "2", commercialTerms: {
    ...snapshot.commercialTerms!, baseUnitsPerSaleUnit: "10", vatRate: "16",
  } });
  expect(changes).toContain("Базовых единиц в единице продажи: 1 → 10");
  expect(changes).toContain("НДС: включён, ставка 12% → включён, ставка 16%");
  expect(changes).toContain("Минимальное количество: 1 → 2");
});
it("explains newly supplied historical terms without inventing previous VAT", () => {
  expect(cartCommercialChanges({ ...snapshot, commercialTerms: undefined }, snapshot)).toContain("НДС: не указан → включён, ставка 12%");
});
it("has no terms diff when only stock changed", () => {
  expect(cartCommercialChanges(snapshot, { ...snapshot, availableQuantity: "8" })).toEqual([]);
});
it("shows tax mode and basis changes at an identical gross amount", () => {
  const declaration = { selection: { mode: "TAXABLE", rate: "16", basis: null }, profile: { version: 1 }, ruleId: "standard" } as VatPriceSnapshot;
  const previous = { ...snapshot, tax: calculateVatLine("10000", declaration) };
  const current = { ...snapshot, tax: calculateVatLine("10000", { ...declaration, selection: { mode: "EXEMPT", rate: null, basis: "Перечень освобождения" } }) };
  const changes = cartCommercialChanges(previous, current);
  expect(changes).toContain("Налоговые условия: Включая НДС 16% → Освобождено от НДС");
  expect(changes).toContain("Основание НДС: не указано → Перечень освобождения");
  expect(cartCommercialChanges(previous, { ...previous, tax: { ...previous.tax, declaration: { ...declaration, declaredAt: "2026-10-15T00:00:00Z" } } })).toEqual([]);
});
