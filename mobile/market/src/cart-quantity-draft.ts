import { cartVersionSchema, updateCartItemSchema } from "../../../packages/schemas/src/index";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { ReadScope } from "../../../contracts/mobile-read/read-adapter";

type Item = CartResponse["items"][number];
export type QuantityDraftIssue = { kind: "required" | "number" | "positive" | "precision" | "version" | "quantity" } | { kind: "maximum"; maximum: string } | { kind: "step"; step: string };
export type QuantityDraft = Readonly<{ text: string; checked: boolean; issue: QuantityDraftIssue | null }>;
type Source = Readonly<{ id: string; buyer: string; version: number; lines: Readonly<Record<string, Readonly<{ quantity: string; offerId: string }>>> }>;
export type QuantityDraftSnapshot = Readonly<{ source: Source | null; entries: Readonly<Record<string, QuantityDraft>>; discarded: boolean }>;

/** Decimal text identity for conversion checking only, never quantity/money arithmetic. */
export function decimalIdentity(text: string): string | null {
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) return null;
  const fraction = match[3] ?? match[4] ?? "";
  const digits = ((match[2] ?? "") + fraction).replace(/^0+/, "");
  if (!digits) return "0";
  const significant = digits.replace(/0+$/, "");
  return `${match[1] === "-" ? "-" : ""}${significant}e${Number(match[5] ?? 0) - fraction.length + digits.length - significant.length}`;
}
/** Parses an editor representation into the existing numeric schema; returns no command payload. */
export function checkQuantityText(text: string, expectedVersion: number): QuantityDraftIssue | null {
  if (!cartVersionSchema.safeParse({ expectedVersion }).success) return { kind: "version" };
  const normalized = text.trim().replace(",", ".");
  if (!normalized) return { kind: "required" };
  const identity = decimalIdentity(normalized);
  if (identity === null) return { kind: "number" };
  const parsed = updateCartItemSchema.safeParse({ expectedVersion, quantity: Number(normalized) });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "expectedVersion") return { kind: "version" };
      if (issue.code === "too_small") return { kind: "positive" };
      if (issue.code === "too_big") return { kind: "maximum", maximum: String(issue.maximum) };
      if (issue.code === "not_multiple_of") return { kind: "step", step: String(issue.divisor) };
      if (issue.code === "invalid_type") return { kind: "number" };
    }
    return { kind: "quantity" };
  }
  // Do not silently turn e.g. 1.0000000000000000001 into the different quantity 1.
  return decimalIdentity(String(parsed.data.quantity)) === identity ? null : { kind: "precision" };
}

export function createCartQuantityDrafts(scope: ReadScope) {
  const owner = Object.freeze({ ...scope });
  let active = true;
  let snapshot: QuantityDraftSnapshot = { source: null, entries: Object.freeze({}), discarded: false };
  const listeners = new Set<() => void>();
  const emit = (next: QuantityDraftSnapshot) => { snapshot = Object.freeze(next); listeners.forEach(listener => listener()); };
  const matches = (cart: CartResponse, item: Item) => active && cart.status === "ACTIVE" && cart.checkout === null
    && cart.buyerOrganizationId === owner.organizationId && snapshot.source?.id === cart.id && snapshot.source.buyer === cart.buyerOrganizationId && snapshot.source.version === cart.version
    && item.cartId === cart.id && snapshot.source.lines[item.id]?.quantity === item.quantity && snapshot.source.lines[item.id]?.offerId === item.offerId;
  const put = (id: string, entry: QuantityDraft) => emit({ ...snapshot, entries: Object.freeze({ ...snapshot.entries, [id]: Object.freeze(entry) }), discarded: false });
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() { active = true; },
    close() { active = false; emit({ source: null, entries: Object.freeze({}), discarded: false }); },
    clear() { if (snapshot.source || Object.keys(snapshot.entries).length) emit({ source: null, entries: Object.freeze({}), discarded: Object.keys(snapshot.entries).length > 0 }); },
    syncCurrent(cart: CartResponse | null) {
      if (!active) return;
      if (!cart || cart.buyerOrganizationId !== owner.organizationId || cart.status !== "ACTIVE" || cart.checkout !== null || !cartVersionSchema.safeParse({ expectedVersion: cart.version }).success || new Set(cart.items.map(item => item.id)).size !== cart.items.length) {
        this.clear(); return;
      }
      const lines = Object.fromEntries(cart.items.map(item => [item.id, Object.freeze({ quantity: item.quantity, offerId: item.offerId })]));
      const previous = snapshot.source;
      const same = previous?.id === cart.id && previous.buyer === cart.buyerOrganizationId && previous.version === cart.version;
      const entries = Object.fromEntries(Object.entries(snapshot.entries).filter(([id]) => same && previous.lines[id]?.quantity === lines[id]?.quantity && previous.lines[id]?.offerId === lines[id]?.offerId && lines[id] !== undefined));
      const discarded = Object.keys(entries).length < Object.keys(snapshot.entries).length;
      const source = Object.freeze({ id: cart.id, buyer: cart.buyerOrganizationId, version: cart.version, lines: Object.freeze(lines) });
      if (same && JSON.stringify(previous.lines) === JSON.stringify(lines) && !discarded) return;
      emit({ source, entries: Object.freeze(entries), discarded: discarded || snapshot.discarded });
    },
    canEdit: matches,
    getLine(cart: CartResponse, item: Item): QuantityDraft | null { return matches(cart, item) ? snapshot.entries[item.id] ?? null : null; },
    begin(cart: CartResponse, item: Item): boolean {
      if (!matches(cart, item)) return false;
      if (!snapshot.entries[item.id]) put(item.id, { text: item.quantity, checked: false, issue: null });
      return true;
    },
    change(cart: CartResponse, item: Item, text: string) {
      if (matches(cart, item) && snapshot.entries[item.id]) put(item.id, { text, checked: false, issue: null });
    },
    check(cart: CartResponse, item: Item): boolean {
      const draft = this.getLine(cart, item); if (!draft) return false;
      const issue = checkQuantityText(draft.text, cart.version); put(item.id, { ...draft, checked: true, issue }); return issue === null;
    },
    cancel(cart: CartResponse, item: Item) {
      if (!matches(cart, item) || !snapshot.entries[item.id]) return;
      const entries = { ...snapshot.entries }; delete entries[item.id]; emit({ ...snapshot, entries: Object.freeze(entries), discarded: false });
    },
    cancelAll() { if (active && Object.keys(snapshot.entries).length) emit({ ...snapshot, entries: Object.freeze({}), discarded: false }); },
  };
}
export type CartQuantityDrafts = ReturnType<typeof createCartQuantityDrafts>;
