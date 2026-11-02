import { cartResponseSchema, type CartResponse } from "../../../../packages/schemas/src/core-api";
import type { CartRepriceInput } from "../cart-command-fixture";
import { cartValidationResult } from "./cart-validation";
export function repriceValidation(cart: CartResponse) {
 const quote = cartValidationResult(cart, "changed"), snapshot = quote.items[0]?.current;
 if (snapshot) {
  snapshot.unitPriceMinor = "5800000000000000000"; snapshot.totalPriceMinor = "11600000000000000000";
  snapshot.tax = { declaration: { selection: { mode: "TAXABLE", rate: "16", basis: null }, ruleId: "SYNTHETIC_TAX_RULE", profile: { revisionId: "00000000-0000-4000-8000-000000000931", version: 5, organizationVersion: 7, taxPeriodId: "00000000-0000-4000-8000-000000000932", status: "VAT_PAYER", effectiveFrom: "2026-01-01", effectiveTo: null }, declaredAt: "2026-10-30T01:02:03.000Z", declaredById: "00000000-0000-4000-8000-000000000933", source: "EXPLICIT", defaultVersion: null }, calculationVersion: "GROSS_LINE_HALF_UP_V1", grossMinor: "11600000000000000000", baseMinor: "10000000000000000000", vatMinor: "1600000000000000000" };
  snapshot.promotion = { promotionId: "00000000-0000-4000-8000-000000000934", revision: 8, name: "SYNTHETIC exact promotion", kind: "BUY_X_GET_Y", baseUnitPriceMinor: "5800000000000000000", unitPriceMinor: "5800000000000000000", discountMinor: "0", endsAt: "2099-01-01T00:00:00.000Z", buyQuantity: "1.5", giftPerGroup: "0.500001", gift: { offerId: "00000000-0000-4000-8000-000000000935", name: "SYNTHETIC exact gift", quantity: "0.500001" } };
 }
 return quote;
}
export function repriceResult(cart: CartResponse, input: CartRepriceInput, version = input.expectedVersion! + 1): CartResponse {
 const result = cartResponseSchema.parse(cart); result.version = version;
 for (const item of result.items) { const accepted = input.acceptedItems?.find(line => line.cartItemId === item.id)?.snapshot; if (accepted) { item.unitPriceMinor = accepted.unitPriceMinor; item.totalPriceMinor = accepted.totalPriceMinor; item.currency = accepted.currency; item.pricingSnapshot = accepted; } }
 return result;
}
