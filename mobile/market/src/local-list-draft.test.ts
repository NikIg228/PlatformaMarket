import { createSavedListSchema, upsertSavedListItemSchema } from "../../../packages/schemas/src/commercial";
import { checkListQuantity, checkListText, createLocalListDraft } from "./local-list-draft";
import { listDraftComparison, listDraftId, listDraftScope } from "./test-fixtures/list-draft";
function started() { const comparison = listDraftComparison(true), store = createLocalListDraft(listDraftScope); store.syncComparison(comparison); const target = store.begin(comparison, comparison.offers[0]!.offerId)!; return { store, comparison, target }; }
it.each(["name", "note"] as const)("uses actual %s field boundaries without trimming or replacing original strings", field => {
  const schema = field === "name" ? createSavedListSchema.shape.name : upsertSavedListItemSchema.shape.note, max = field === "name" ? 120 : 500;
  for (const text of ["", " ", "a", "ab", "я".repeat(max - 1), "я".repeat(max), "я".repeat(max + 1), "😀".repeat(max), "😀".repeat(max + 1), "  " + "я".repeat(max) + "\n"]) {
    expect(checkListText(field, text) === null).toBe(schema.safeParse(text).success); const { store, target } = started(); store.setName(field === "name" ? text : "SYNTHETIC name"); if (field === "note") store.setText(target, "noteText", text); store.checkEntry(target); expect(field === "name" ? store.getSnapshot().name : store.entryFor(target)?.noteText).toBe(text);
  }
});
it.each(["1", "1.000001", "0.0000001", "1,25", "  +001.2500  ", "1e2", "0", "-1", "-0", "NaN", "Infinity", "1e309", "1e-999", "0x10", "", " ", "1,2,3"])("checks quantity representation %s against the real positive numeric field and preserves text", text => {
  const { store, target } = started(); store.setName("SYNTHETIC name"); store.setText(target, "quantityText", text); store.checkEntry(target); expect(store.entryFor(target)?.quantityText).toBe(text);
  if (["1", "1.000001", "0.0000001", "1,25", "  +001.2500  ", "1e2"].includes(text)) { expect(checkListQuantity(text)).toBeNull(); expect(upsertSavedListItemSchema.shape.quantity.safeParse(Number(text.trim().replace(",", "."))).success).toBe(true); } else expect(checkListQuantity(text)).not.toBeNull();
});
it.each(["1.0000000000000000001", "9007199254740993", "999999999999.999999"])("reports precision-changing conversion for %s without inventing cart step/max or financial rules", text => {
  expect(upsertSavedListItemSchema.shape.quantity.safeParse(Number(text)).success).toBe(true); expect(checkListQuantity(text)).toEqual({ kind: "precision" });
});
it("requires a separately decoded exact offer, uses actual default1 and never duplicates a selected offer or aggregates quantity", () => {
  const comparison = listDraftComparison(true), store = createLocalListDraft(listDraftScope), id = comparison.offers[0]!.offerId; expect(store.begin(comparison, id)).toBeNull(); store.syncComparison(comparison); expect(store.begin(comparison, listDraftId(999))).toBeNull();
  const target = store.begin(comparison, id)!; expect(store.entryFor(target)?.quantityText).toBe(String(upsertSavedListItemSchema.shape.quantity.parse(undefined))); store.setText(target, "quantityText", " 2,5 "); store.setText(target, "noteText", "  SYNTHETIC note\nraw  "); expect(store.begin(comparison, id)).toBe(target); expect(Object.keys(store.getSnapshot().entries)).toEqual([id]); expect(store.entryFor(target)?.quantityText).toBe(" 2,5 ");
  const second = store.begin(comparison, comparison.offers[1]!.offerId)!; expect(Object.keys(store.getSnapshot().entries)).toHaveLength(2); expect(store.entryFor(second)?.quantityText).toBe("1"); expect(JSON.stringify(store.getSnapshot())).not.toContain("price"); expect(JSON.stringify(store.getSnapshot())).not.toContain("SYNTHETIC supplier"); expect(store.getSnapshot()).not.toHaveProperty("listId"); expect(store.getSnapshot()).not.toHaveProperty("isDefault");
});
it("validates name and each position, clears only edited errors and checks an empty list without inventing a min-items rule", () => {
  const { store, target } = started(); store.setText(target, "quantityText", "0"); store.setText(target, "noteText", "я".repeat(501)); expect(store.checkEntry(target).first).toBe("name"); expect(store.entryFor(target)?.quantityIssue).toEqual({ kind: "positive" });
  store.setName("SYNTHETIC name"); store.setText(target, "quantityText", "1"); expect(store.entryFor(target)?.noteIssue).toEqual({ kind: "maximum", count: "500" }); store.setText(target, "noteText", ""); expect(store.checkAll()).toBe(true);
  store.cancelEntry(target); expect(store.checkAll()).toBe(true); expect(store.getSnapshot().entries).toEqual({}); expect(store.getSnapshot().name).toBe("SYNTHETIC name");
});
it("cancel item/all rotate local source handles, clear originals and allow fresh selection without reads", () => {
  const { store, comparison, target } = started(); store.setName("SYNTHETIC name"); store.setText(target, "quantityText", "2"); store.cancelEntry(target); const next = store.begin(comparison, target.offerId)!; expect(next).not.toBe(target); expect(store.setText(target, "quantityText", "99")).toBe(false); expect(store.entryFor(next)?.quantityText).toBe("1");
  store.cancelAll(); expect(store.getSnapshot()).toMatchObject({ started: false, name: "", entries: {} }); const fresh = store.begin(comparison, target.offerId)!; expect(fresh).not.toBe(next); expect(store.setText(next, "quantityText", "99")).toBe(false); expect(store.entryFor(fresh)?.quantityText).toBe("1");
});
it("preserves raw text on same-identity price/stock refresh but drops missing/ambiguous offers without copying their terms", () => {
  const { store, comparison, target } = started(); store.setName("SYNTHETIC name"); store.setText(target, "quantityText", " 2,5 "); const changed = listDraftComparison(true); changed.offers[0]!.price.amountMinor = "99"; changed.offers[0]!.availability = []; store.syncComparison(changed); expect(store.entryFor(target)?.quantityText).toBe(" 2,5 "); expect(JSON.stringify(store.getSnapshot())).not.toContain("availability");
  const missing = { ...comparison, offers: comparison.offers.slice(1) }; store.syncComparison(missing); expect(store.entryFor(target)).toBeNull(); expect(store.getSnapshot()).toMatchObject({ name: "SYNTHETIC name", discarded: true }); expect(store.begin(comparison, target.offerId)).toBeNull();
  store.syncComparison(comparison); const fresh = store.begin(comparison, target.offerId)!; expect(fresh).not.toBe(target); store.syncComparison({ ...comparison, offers: [comparison.offers[0]!, comparison.offers[0]!] }); expect(store.entryFor(fresh)).toBeNull(); expect(store.canSelect(comparison, target.offerId)).toBe(false);
});
it("rejects a reused offer ID in a different product/variant context instead of moving prior text", () => {
  const { store, comparison, target } = started(); store.setText(target, "noteText", "SYNTHETIC private prior note"); const mismatch = { ...comparison, product: { ...comparison.product, id: listDraftId(950) } }; store.syncComparison(mismatch); expect(store.entryFor(target)).toBeNull(); expect(store.begin(mismatch, target.offerId)).toBeNull(); expect(JSON.stringify(store.getSnapshot())).not.toContain("private prior");
});
it("loss of one comparison clears affected positions only; clear/close erase all and old callbacks stay inert", () => {
  const { store, comparison, target } = started(); const b = listDraftComparison(); b.product.id = listDraftId(950); b.variants[0]!.id = listDraftId(951); b.selectedVariantId = listDraftId(951); b.offers[0]!.variantId = listDraftId(951); b.offers[0]!.offerId = listDraftId(952); store.syncComparison(b); const other = store.begin(b, b.offers[0]!.offerId)!;
  store.invalidateComparison(comparison.product.id, comparison.selectedVariantId); expect(store.entryFor(target)).toBeNull(); expect(store.entryFor(other)).not.toBeNull(); store.clear(); expect(store.begin(b, other.offerId)).toBeNull(); store.syncComparison(b); const last = store.begin(b, other.offerId)!; store.close(); store.syncComparison(b); expect(store.begin(b, other.offerId)).toBeNull(); expect(store.setText(last, "noteText", "SYNTHETIC old session")).toBe(false); expect(store.getSnapshot().name).toBe(""); expect(Object.isFrozen(store.context)).toBe(true);
});
