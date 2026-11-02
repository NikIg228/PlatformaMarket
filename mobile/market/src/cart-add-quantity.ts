import { addCartItemSchema } from "../../../packages/schemas/src/index";
import { decimalIdentity, type QuantityDraftIssue } from "./cart-quantity-draft";

export type CartAddQuantityIssue = QuantityDraftIssue | { kind: "offer-minimum"; minimum: string } | { kind: "offer-step"; minimum: string; step: string };

export function checkCartAddQuantity(raw: string): CartAddQuantityIssue | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return { kind: "required" };
  const identity = decimalIdentity(normalized);
  if (identity === null) return { kind: "number" };
  const value = addCartItemSchema.shape.quantity.safeParse(Number(normalized));
  if (!value.success) {
    const issue = value.error.issues[0];
    if (issue?.code === "too_small") return { kind: "positive" };
    if (issue?.code === "too_big") return { kind: "maximum", maximum: String(issue.maximum) };
    return { kind: "number" };
  }
  if (decimalIdentity(String(value.data)) !== identity) return { kind: "precision" };
  // CartItem stores Decimal(18,6); do not silently round a numeric wire value
  // which the more permissive add schema itself would accept.
  if (identity !== "0" && Number(identity.slice(identity.lastIndexOf("e") + 1)) < -6) return { kind: "step", step: "0.000001" };
  return null;
}

export function usableOfferQuantityRules(minimum: string, increment: string): boolean {
  return [minimum, increment].every(raw => Number.isFinite(Number(raw)) && Number(raw) > 0 && decimalIdentity(String(Number(raw))) === decimalIdentity(raw));
}

export function checkCartAddOfferQuantity(raw: string, minimum: string, increment: string): CartAddQuantityIssue | null {
  const issue = checkCartAddQuantity(raw); if (issue) return issue;
  const quantity = Number(raw.trim().replace(",", ".")), delta = quantity - Number(minimum);
  // Match the actual API quantityMatchesOffer predicate, including its shifted
  // minimum and tolerance. Do not copy legacy web quantity/increment semantics.
  if (delta < -1e-9) return { kind: "offer-minimum", minimum };
  const steps = delta / Number(increment);
  return Math.abs(steps - Math.round(steps)) < 1e-9 ? null : { kind: "offer-step", minimum, step: increment };
}
