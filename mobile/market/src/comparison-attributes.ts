import { z } from "zod";
import { offerComparisonResponseSchema, catalogVariantSchema } from "../../../packages/schemas/src/core-api";
const root = offerComparisonResponseSchema.pick({ selectedVariantId: true }).strip().extend({ product: offerComparisonResponseSchema.shape.product.pick({ id: true }).strip() });
const variants = z.array(catalogVariantSchema.pick({ id: true }).strip());
const association = offerComparisonResponseSchema.shape.comparisonAttributes.element.pick({ scope: true, variantId: true }).strip();
const content = offerComparisonResponseSchema.shape.comparisonAttributes.element.pick({ code: true, name: true, value: true }).strip();
const selected = catalogVariantSchema.pick({ id: true, label: true, attributes: true, sku: true }).strip();
const identity = offerComparisonResponseSchema.shape.product.pick({ brand: true, manufacturer: true }).strip();
export type AttributeValue = Readonly<{ kind: "text" | "number"; text: string } | { kind: "boolean"; value: boolean } | { kind: "unknown" }>;
export type AttributeRow = Readonly<{ key: string; name: string; value: AttributeValue }>;
export type ComparisonAttributes = Readonly<{ state: "unavailable" } | { state: "ready"; variantLabel: string; identity: Readonly<{ brand: string | null; manufacturer: string | null; sku: string | null }>; product: readonly AttributeRow[]; variant: readonly AttributeRow[]; unboundVariant: boolean }>;
const unavailable: ComparisonAttributes = Object.freeze({ state: "unavailable" });
function valueOf(value: unknown): AttributeValue {
 if (typeof value === "string") return Object.freeze({ kind: "text", text: value });
 if (typeof value === "boolean") return Object.freeze({ kind: "boolean", value });
 if (typeof value === "number" && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) return Object.freeze({ kind: "number", text: Object.is(value, -0) ? "-0" : String(value) });
 return Object.freeze({ kind: "unknown" });
}
/** Private read projection only; source values never create required-category, eligibility or commercial rules. */
export function projectComparisonAttributes(body: unknown, productId: string, variantId: string): ComparisonAttributes {
 const context = root.safeParse(body); if (!context.success || context.data.product.id !== productId || context.data.selectedVariantId !== variantId) return unavailable;
 const raw = body as { product: unknown; variants: object[]; comparisonAttributes: unknown[] }, ids = variants.safeParse(raw.variants);
 if (!ids.success || new Set(ids.data.map(item => item.id)).size !== ids.data.length) return unavailable;
 const index = ids.data.findIndex(item => item.id === variantId); if (index < 0) return unavailable;
 const bindings = z.array(association).safeParse(raw.comparisonAttributes); if (!bindings.success) return unavailable;
 const current = selected.safeParse(raw.variants[index]), productIdentity = identity.safeParse(raw.product); if (!current.success || current.data.id !== variantId || !productIdentity.success) return unavailable;
 const product: AttributeRow[] = [], variant: AttributeRow[] = []; let unboundVariant = false;
 for (const [i, binding] of bindings.data.entries()) {
  if (binding.scope === "VARIANT" && binding.variantId !== variantId) { if (!binding.variantId || !ids.data.some(item => item.id === binding.variantId)) unboundVariant = true; continue; }
  const parsed = content.safeParse(raw.comparisonAttributes[i]); if (!parsed.success) return unavailable;
  const row = Object.freeze({ key: `${binding.scope}:${parsed.data.code}:${i}`, name: parsed.data.name, value: valueOf(parsed.data.value) });
  (binding.scope === "PRODUCT" ? product : variant).push(row);
 }
 const labels = new Set(variant.map(row => row.name));
 for (const [name, value] of Object.entries(current.data.attributes)) if (!labels.has(name)) variant.push(Object.freeze({ key: `selected:${name}`, name, value: valueOf(value) }));
 return Object.freeze({ state: "ready", variantLabel: current.data.label, identity: Object.freeze({ ...productIdentity.data, sku: current.data.sku }), product: Object.freeze(product), variant: Object.freeze(variant), unboundVariant });
}
