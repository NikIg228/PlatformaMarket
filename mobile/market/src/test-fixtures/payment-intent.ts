import { checkoutResponseSchema } from "../../../../packages/schemas/src/core-api";
import { savedCheckout, checkoutId } from "./carts";
import { listDraftId, listDraftScope } from "./list-draft";
export const intentId = listDraftId(910), providerId = listDraftId(911), intentScope = listDraftScope;
export const intentTarget = { paymentIntentId: intentId, checkoutId };
type RawIntentFixture = { id: string; checkoutId: string; buyerOrganizationId: string; providerId: string; status: string; totalAmountMinor: string; currency: string; provider: { id: string; code: string; name: string }; createdAt: string; updatedAt: string; expiresAt: string | null };
export function paymentIntentFixture(overrides: Partial<RawIntentFixture> = {}): RawIntentFixture {
  return { id: intentId, checkoutId, buyerOrganizationId: intentScope.organizationId, providerId, status: "PENDING", totalAmountMinor: "90071992547409931234", currency: "KZT", provider: { id: providerId, code: "MOCK", name: "SYNTHETIC MOCK provider" }, createdAt: "2026-10-28T01:02:03.000Z", updatedAt: "2026-10-29T01:02:03.000Z", expiresAt: null, ...overrides };
}
export function intentCheckout(...input: [] | [unknown]) {
  const raw = input.length ? input[0] : { id: intentId, checkoutId, buyerOrganizationId: intentScope.organizationId, status: "CAPTURED" };
  const checkout = savedCheckout(); checkout.status = "COMPLETED"; checkout.cart.status = "CHECKED_OUT";
  return checkoutResponseSchema.parse({ ...checkout, paymentIntent: raw });
}
