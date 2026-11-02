import { createSavedListSchema, upsertSavedListItemSchema } from "../../../packages/schemas/src/commercial";
import type { OfferComparisonResponse } from "../../../packages/schemas/src/core-api";
import { selectComparedOffer, type ReadScope } from "../../../contracts/mobile-read/read-adapter";
import { decimalIdentity } from "./cart-quantity-draft";
import type { z } from "zod";

export type ListTextIssue = { kind: "minimum" | "maximum"; count: string } | { kind: "format" };
export type ListQuantityIssue = { kind: "required" | "number" | "positive" | "precision" | "quantity" };
export function checkListText(field: "name" | "note", text: string): ListTextIssue | null {
  const schema: z.ZodType = field === "name" ? createSavedListSchema.shape.name : upsertSavedListItemSchema.shape.note;
  const parsed = schema.safeParse(text); if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  return Object.freeze(issue?.code === "too_small" ? { kind: "minimum", count: String(issue.minimum) } : issue?.code === "too_big" ? { kind: "maximum", count: String(issue.maximum) } : { kind: "format" });
}
export function checkListQuantity(text: string): ListQuantityIssue | null {
  const normalized = text.trim().replace(",", "."); if (!normalized) return { kind: "required" };
  const identity = decimalIdentity(normalized); if (identity === null) return { kind: "number" };
  const parsed = upsertSavedListItemSchema.shape.quantity.safeParse(Number(normalized));
  if (!parsed.success) return { kind: parsed.error.issues.some(issue => issue.code === "too_small") ? "positive" : "number" };
  return decimalIdentity(String(parsed.data)) === identity ? null : { kind: "precision" };
}
export type LocalListTarget = Readonly<{ productId: string; variantId: string; offerId: string }>;
export type LocalListEntry = Readonly<{ target: LocalListTarget; quantityText: string; noteText: string; checked: boolean; quantityIssue: ListQuantityIssue | null; noteIssue: ListTextIssue | null }>;
export type LocalListSnapshot = Readonly<{ started: boolean; name: string; nameChecked: boolean; nameIssue: ListTextIssue | null; entries: Readonly<Record<string, LocalListEntry>>; discarded: boolean }>;
const sameSource = (a: LocalListTarget, b: LocalListTarget) => a.productId === b.productId && a.variantId === b.variantId && a.offerId === b.offerId;
export function createLocalListDraft(scope: ReadScope) {
  const owner = Object.freeze({ ...scope });
  let active = true, known: Record<string, LocalListTarget> = {};
  const blank = (): LocalListSnapshot => ({ started: false, name: "", nameChecked: false, nameIssue: null, entries: Object.freeze({}), discarded: false });
  let snapshot = Object.freeze(blank()); const listeners = new Set<() => void>();
  const emit = (value: LocalListSnapshot) => { snapshot = Object.freeze(value); listeners.forEach(listener => listener()); };
  const current = (target: LocalListTarget) => active && known[target.offerId] === target && snapshot.entries[target.offerId]?.target === target ? snapshot.entries[target.offerId]! : null;
  const put = (entry: LocalListEntry) => emit({ ...snapshot, entries: Object.freeze({ ...snapshot.entries, [entry.target.offerId]: Object.freeze(entry) }) });
  const removeKnown = (ids: readonly string[]) => {
    if (!ids.length) return;
    const entries = { ...snapshot.entries }; let discarded = false;
    for (const id of ids) { delete known[id]; if (entries[id]) { delete entries[id]; discarded = true; } }
    if (discarded) emit({ ...snapshot, entries: Object.freeze(entries), discarded: true });
  };
  const canSelect = (comparison: OfferComparisonResponse, offerId: string) => {
    const target = known[offerId];
    return active && upsertSavedListItemSchema.shape.offerId.safeParse(offerId).success && target !== undefined && comparison.product.id === target.productId && comparison.selectedVariantId === target.variantId && selectComparedOffer(comparison, target.variantId, offerId) !== null;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() { active = true; },
    close() { active = false; known = {}; emit(blank()); },
    clear() { known = {}; if (snapshot.started || snapshot.name || Object.keys(snapshot.entries).length) emit(blank()); },
    invalidateComparison(productId: string, variantId: string | null) { if (active) removeKnown(Object.keys(known).filter(id => known[id]!.productId === productId && (variantId === null || known[id]!.variantId === variantId))); },
    syncComparison(comparison: OfferComparisonResponse) {
      if (!active) return;
      const productId = comparison.product.id, variantId = comparison.selectedVariantId;
      const offers = comparison.offers.filter(offer => offer.variantId === variantId);
      if (!variantId || !comparison.variants.some(variant => variant.id === variantId) || new Set(offers.map(offer => offer.offerId)).size !== offers.length) { this.invalidateComparison(productId, variantId); return; }
      const ids = new Set(offers.map(offer => offer.offerId));
      removeKnown(Object.keys(known).filter(id => known[id]!.productId === productId && known[id]!.variantId === variantId && !ids.has(id)));
      for (const offer of offers) {
        const source = Object.freeze({ productId, variantId, offerId: offer.offerId }), previous = known[offer.offerId];
        if (previous && !sameSource(previous, source)) { removeKnown([offer.offerId]); continue; }
        if (!previous && upsertSavedListItemSchema.shape.offerId.safeParse(offer.offerId).success) known[offer.offerId] = source;
      }
    },
    canSelect,
    begin(comparison: OfferComparisonResponse, offerId: string): LocalListTarget | null {
      if (!canSelect(comparison, offerId)) return null;
      const target = known[offerId]!;
      if (!snapshot.entries[offerId]) {
        const entry: LocalListEntry = Object.freeze({ target, quantityText: String(upsertSavedListItemSchema.shape.quantity.parse(undefined)), noteText: "", checked: false, quantityIssue: null, noteIssue: null });
        emit({ ...snapshot, started: true, entries: Object.freeze({ ...snapshot.entries, [offerId]: entry }), discarded: false });
      }
      return target;
    },
    entryFor: current,
    setName(text: string) { if (active && snapshot.started && typeof text === "string") emit({ ...snapshot, name: text, nameChecked: false, nameIssue: null }); },
    setText(target: LocalListTarget, field: "quantityText" | "noteText", text: string): boolean {
      const entry = current(target); if (!entry || (field !== "quantityText" && field !== "noteText") || typeof text !== "string") return false;
      put({ ...entry, [field]: text, checked: false, quantityIssue: field === "quantityText" ? null : entry.quantityIssue, noteIssue: field === "noteText" ? null : entry.noteIssue }); return true;
    },
    checkEntry(target: LocalListTarget): { valid: boolean; first: "name" | "quantityText" | "noteText" | null } {
      const entry = current(target); if (!entry) return { valid: false, first: null };
      const nameIssue = checkListText("name", snapshot.name), quantityIssue = checkListQuantity(entry.quantityText), noteIssue = checkListText("note", entry.noteText);
      emit({ ...snapshot, nameChecked: true, nameIssue, entries: Object.freeze({ ...snapshot.entries, [target.offerId]: Object.freeze({ ...entry, checked: true, quantityIssue, noteIssue }) }) });
      const first = nameIssue ? "name" : quantityIssue ? "quantityText" : noteIssue ? "noteText" : null; return { valid: first === null, first };
    },
    checkAll(): boolean {
      if (!active || !snapshot.started) return false;
      const nameIssue = checkListText("name", snapshot.name);
      const entries = Object.fromEntries(Object.values(snapshot.entries).map(entry => [entry.target.offerId, Object.freeze({ ...entry, checked: true, quantityIssue: checkListQuantity(entry.quantityText), noteIssue: checkListText("note", entry.noteText) })]));
      emit({ ...snapshot, nameChecked: true, nameIssue, entries: Object.freeze(entries) }); return !nameIssue && Object.values(entries).every(entry => !entry.quantityIssue && !entry.noteIssue);
    },
    cancelEntry(target: LocalListTarget) { if (!current(target)) return; const entries = { ...snapshot.entries }; delete entries[target.offerId]; known[target.offerId] = Object.freeze({ ...target }); emit({ ...snapshot, entries: Object.freeze(entries) }); },
    cancelAll() { if (active) { known = Object.fromEntries(Object.entries(known).map(([id, target]) => [id, Object.freeze({ ...target })])); emit(blank()); } },
    // Full actor/environment/generation binding is the enclosing keyed controller
    // lifetime; no user-supplied context, copied terms or command DTO is stored.
    context: owner,
  };
}
export type LocalListDraft = ReturnType<typeof createLocalListDraft>;
