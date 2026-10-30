import type { OfferComparisonResponse } from "@marketplace/schemas";

export const productId = "a88f8867-9a19-4703-aadf-e40ca4487b9b";
export const organizationId = "11111111-1111-4111-8111-111111111111";
export const cityId = "33333333-3333-4333-8333-333333333333";
export const secondCity = "66666666-6666-4666-8666-666666666666";
export const variantA = "44444444-4444-4444-8444-444444444444";
export const variantB = "55555555-5555-4555-8555-555555555555";
export const offer = (id: string, name: string, amount: string, variantId = variantA, size = "4"): OfferComparisonResponse["offers"][number] => ({
  offerId: id, variantId, supplier: { organizationId, name }, supplierSku: `SKU-${id}`,
  price: { amountMinor: amount, currency: "KZT", source: "BASE", normalizedPriceMinor: "320000", baseUnits: size, normalizedUnit: "г" },
  packaging: { name: "Шприц", quantityInBaseUnit: size, unit: "г" }, minimumOrderQuantity: "2", orderIncrement: "2",
  availability: [{ warehouseId: organizationId, warehouse: "Склад", cityId, quantityAvailable: "24", updatedAt: null, freshnessExpiresAt: null }],
  delivery: [{ method: "CARRIER", priceType: "FIXED", fixedAmountMinor: "150000", minLeadTimeHours: 24, maxLeadTimeHours: 48, temperatureControlled: false, installationRequired: false }],
  markers: { verifiedDocuments: true, complianceRisk: null, officialDistributor: true, supplierWarranty: true, requiresConfirmation: false },
});
export const comparison: OfferComparisonResponse = {
  product: { id: productId, name: "Filtek Ultimate", brand: "Solventum", manufacturer: "Solventum Corporation", baseUnit: null },
  reviewSummary: { count: 0, averageRating: null },
  variants: [{ id: variantA, label: "A2", sku: "A2-4", gtin: null, attributes: { "Оттенок": "A2" } }, { id: variantB, label: "A3", sku: "A3-4", gtin: null, attributes: { "Оттенок": "A3" } }],
  selectedVariantId: variantA, comparisonAttributes: [{ scope: "PRODUCT", code: "type", name: "Тип материала", value: "Светоотверждаемый композит" }],
  offers: [offer("offer-b", "DentalPro", "1450000"), offer("offer-a", "MedDent", "1280000"), offer("offer-small", "Малая фасовка", "500000", variantA, "2"), offer("offer-a3", "Поставщик A3", "1350000", variantB)],
};
