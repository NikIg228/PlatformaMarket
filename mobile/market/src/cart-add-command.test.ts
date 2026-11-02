import type { OfferComparisonResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { createCartAddCommands } from "./cart-add-command-fixture";
import { createLocalListDraft } from "./local-list-draft";
import type { CartAddInput, CartCommandFixture } from "./cart-command-fixture";
import { cartCommandScope, cartCommandAuthorization, cartCommandError, cartAddComparison, addCommandCart, addCartItemResult } from "./test-fixtures/cart-commands";
import { savedPage } from "./test-fixtures/carts";
import { supportId } from "./test-fixtures/support";

function setup(withOffer = true) {
  const comparison = cartAddComparison(), list = createLocalListDraft(cartCommandScope); list.syncComparison(comparison);
  const target = list.begin(comparison, comparison.offers[0]!.offerId)!; list.setText(target, "quantityText", " 3,5 "); list.setText(target, "noteText", "SYNTHETIC private note"); list.setName("SYNTHETIC private list name");
  let currentComparison: OfferComparisonResponse | null = comparison, page: WorkspaceCartPage | null = savedPage(addCommandCart(1, "2", withOffer), []), next: WorkspaceCartPage | undefined = page, otherLocked = false;
  const original = page, cart = page.current!;
  const add = jest.fn(async (_scope: typeof cartCommandScope, _id: string, input: CartAddInput): Promise<unknown> => addCartItemResult(cart, input));
  const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), addCartItem: add };
  const read = jest.fn(async () => { if (next) page = next; return next; });
  const model = createCartAddCommands(cartCommandScope, fixture, list, () => currentComparison, () => page, read, () => otherLocked);
  const choose = () => model.select(target, comparison);
  return { model, list, comparison, target, original, cart, add, fixture, read, choose, setComparison: (value: OfferComparisonResponse | null) => { currentComparison = value; }, setPage: (value: WorkspaceCartPage | null) => { page = value; }, setNext: (value: WorkspaceCartPage | undefined) => { next = value; }, current: () => page, lockOther: (value: boolean) => { otherLocked = value; } };
}

it("selects only intent, preserves original list fields and sends only exact offerId/quantity on explicit cart action", async () => {
  const s = setup(), before = JSON.stringify(s.list.getSnapshot()); expect(s.choose()).toBe("selected"); expect(s.add).not.toHaveBeenCalled();
  expect(JSON.stringify(s.model.getSnapshot())).not.toContain("SYNTHETIC private note"); expect(JSON.stringify(s.model.getSnapshot())).not.toContain("SYNTHETIC private list name");
  await s.model.submit(s.original); expect(s.add.mock.calls[0]).toEqual([cartCommandScope, s.cart.id, { offerId: s.target.offerId, quantity: 3.5 }]);
  const input = s.add.mock.calls[0]![2]; expect(Object.keys(input).sort()).toEqual(["offerId", "quantity"]); expect(Object.isFrozen(input)).toBe(true);
  expect(s.model.getSnapshot()).toMatchObject({ phase: "result", sourceVersion: 1, result: { quantity: "3.5", unitPriceMinor: "90071992547409939998", totalPriceMinor: "90071992547409939999" } });
  expect(s.cart.version).toBe(1); expect(s.cart.items[0]!.quantity).toBe("2"); expect(JSON.stringify(s.list.getSnapshot())).toBe(before);
});

it("adds a previously absent offer without appending locally or guessing a new root version", async () => {
  const s = setup(false); s.choose(); await s.model.submit(s.original);
  expect(s.model.getSnapshot()).toMatchObject({ phase: "result", result: { offerId: s.target.offerId } }); expect(s.cart.items).toHaveLength(1); expect(s.cart.items[0]!.offerId).not.toBe(s.target.offerId); expect(s.cart.version).toBe(1);
});

it("accepts a new upsert line UUID for the same cart/offer instead of inventing an item-ID precondition", async () => {
  const s = setup(); s.choose(); const result = addCartItemResult(s.cart, { offerId: s.target.offerId, quantity: 3.5 }); result.id = supportId(899); s.add.mockResolvedValueOnce(result);
  await s.model.submit(s.original); expect(s.model.getSnapshot()).toMatchObject({ phase: "result", result: { id: supportId(899) } });
});

it.each(["permission", "organizationId", "userId", "environment", "generation", "absent-port"])("does not select or send without exact authority: %s", async field => {
  const s = setup(); if (field === "absent-port") delete s.fixture.addCartItem; else if (field === "permission") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; else s.fixture.authorization = { ...s.fixture.authorization, scope: { ...cartCommandScope, [field]: field === "generation" ? 99 : field === "environment" ? "other" : supportId(99) } };
  expect(s.choose()).toBe("unavailable"); await s.model.submit(s.original); expect(s.add).not.toHaveBeenCalled();
});

it.each(["retained-comparison", "clone-target", "different-product", "different-variant", "missing-offer", "no-availability", "rules"] as const)("rejects invalid selected source: %s", kind => {
  const s = setup();
  if (kind === "retained-comparison") s.setComparison(cartAddComparison());
  if (kind === "different-product") s.comparison.product.id = supportId(99); if (kind === "different-variant") s.comparison.selectedVariantId = supportId(99); if (kind === "missing-offer") s.comparison.offers = [];
  if (kind === "no-availability") s.comparison.offers[0]!.availability = []; if (kind === "rules") s.comparison.offers[0]!.orderIncrement = "0";
  expect(kind === "clone-target" ? s.model.select({ ...s.target }, s.comparison) : s.choose()).toBe("unavailable"); expect(s.add).not.toHaveBeenCalled();
});

it.each([["0", "positive"], ["2", "offer-step"], ["1", "offer-minimum"], ["3.500000000000000001", "precision"], ["3.5000001", "step"], ["1000001", "maximum"]] as const)("retains invalid raw%s and exposes the actual quantity issue%s without list name/note validation", (raw, kind) => {
  const s = setup(); s.list.setName(""); s.list.setText(s.target, "quantityText", raw); expect(s.choose()).toBe("quantity"); expect(s.model.getSnapshot().quantityIssue?.kind).toBe(kind); expect(s.list.entryFor(s.target)?.quantityText).toBe(raw); expect(s.list.getSnapshot().nameIssue).toBeNull(); expect(s.list.entryFor(s.target)?.noteIssue).toBeNull();
});

it.each(["retained-page", "owner", "status", "checkout", "currency", "duplicate-offer", "duplicate-item", "item-cart", "quantity-edited", "source-removed", "other-mutation"] as const)("refuses a cart send after %s changes", async kind => {
  const s = setup(); s.choose();
  if (kind === "retained-page") s.setPage(savedPage(addCommandCart(), [])); if (kind === "owner") s.cart.buyerOrganizationId = supportId(99); if (kind === "status") s.cart.status = "CHECKED_OUT"; if (kind === "checkout") s.cart.checkout = { id: supportId(99) }; if (kind === "currency") s.cart.currency = s.cart.currency === "KZT" ? "USD" : "KZT";
  if (kind === "duplicate-offer") s.cart.items.push({ ...s.cart.items[0]!, id: supportId(97) }); if (kind === "duplicate-item") s.cart.items.push({ ...s.cart.items[0]!, offerId: supportId(97) }); if (kind === "item-cart") s.cart.items[0]!.cartId = supportId(99);
  if (kind === "quantity-edited") s.list.setText(s.target, "quantityText", "4.5"); if (kind === "source-removed") s.list.cancelEntry(s.target); if (kind === "other-mutation") s.lockOther(true);
  await s.model.submit(s.original); expect(s.add).not.toHaveBeenCalled();
});

it("blocks duplicates and selection replacement while pending but keeps unrelated note/name fields independent", async () => {
  const s = setup(); s.choose(); let finish!: (value: unknown) => void; s.add.mockImplementationOnce(() => new Promise(done => { finish = done; })); const pending = s.model.submit(s.original);
  await s.model.submit(s.original); expect(s.choose()).toBe("unavailable"); s.model.discard(); s.list.setText(s.target, "noteText", "changed note"); s.list.setName("changed name");
  finish(addCartItemResult(s.cart, s.add.mock.calls[0]![2])); await pending; expect(s.add).toHaveBeenCalledTimes(1); expect(s.model.getSnapshot().phase).toBe("result"); expect(s.list.entryFor(s.target)?.noteText).toBe("changed note");
});

it("does not merge newer local quantity text into the immutable sent request/receipt", async () => {
  const s = setup(); s.choose(); let finish!: (value: unknown) => void; s.add.mockImplementationOnce(() => new Promise(done => { finish = done; })); const pending = s.model.submit(s.original); s.list.setText(s.target, "quantityText", "4.5");
  finish(addCartItemResult(s.cart, s.add.mock.calls[0]![2])); await pending; expect(s.model.getSnapshot()).toMatchObject({ phase: "result", input: { quantity: 3.5 }, result: { quantity: "3.5" } }); expect(s.list.entryFor(s.target)?.quantityText).toBe("4.5");
});

it.each([400, 401, 403, 404, 409] as const)("has no automatic repeat or local success after source rejection%s", async status => {
  const s = setup(); s.choose(); s.add.mockRejectedValueOnce(cartCommandError(status)); await s.model.submit(s.original);
  expect(s.model.getSnapshot().phase).toBe("rejected"); await s.model.submit(s.original); await s.model.submitPrepared(); expect(s.add).toHaveBeenCalledTimes(1);
});

it.each(["timeout", "5xx", "malformed-error", "wrong-cart", "wrong-offer", "wrong-quantity", "wrong-currency"] as const)("keeps%s unknown without inventing an idempotency/replay contract", async kind => {
  const s = setup(); s.choose();
  if (kind === "timeout") s.add.mockRejectedValueOnce(new Error("SYNTHETIC private timeout")); else if (kind === "5xx") s.add.mockRejectedValueOnce(cartCommandError(503)); else if (kind === "malformed-error") s.add.mockRejectedValueOnce({ status: 403, payload: { statusCode: 500 } });
  else { const result = addCartItemResult(s.cart, { offerId: s.target.offerId, quantity: 3.5 }); if (kind === "wrong-cart") result.cartId = supportId(99); if (kind === "wrong-offer") result.offerId = supportId(99); if (kind === "wrong-quantity") result.quantity = "9"; if (kind === "wrong-currency") result.currency = result.currency === "KZT" ? "USD" : "KZT"; s.add.mockResolvedValueOnce(result); }
  await s.model.submit(s.original); expect(s.model.getSnapshot()).toMatchObject({ phase: "unknown", priorUnknown: true }); await s.model.submit(s.original); await s.model.submitPrepared(); s.model.discard(); expect(s.add).toHaveBeenCalledTimes(1); expect(s.model.getSnapshot().phase).toBe("unknown");
});

it.each(["wrong-cart", "wrong-offer"] as const)("checks result%s binding before reading quantity or private pricing", async kind => {
  const s = setup(); s.choose(); const result = { id: supportId(77), cartId: kind === "wrong-cart" ? supportId(99) : s.cart.id, offerId: kind === "wrong-offer" ? supportId(99) : s.target.offerId };
  const decoded = jest.fn(() => { throw new Error("Wrong line pricing decoded"); }); Object.defineProperty(result, "pricingSnapshot", { get: decoded }); s.add.mockResolvedValueOnce(result); await s.model.submit(s.original);
  expect(decoded).not.toHaveBeenCalled(); expect(s.model.getSnapshot().phase).toBe("unknown");
});

it("requires fresh read and a separate prepared send after409 with no wire expectedVersion or optimistic root update", async () => {
  const s = setup(); s.choose(); s.add.mockRejectedValueOnce(cartCommandError(409)); await s.model.submit(s.original); const original = s.add.mock.calls[0]![2];
  s.setNext(savedPage(addCommandCart(9, "5"), [])); await s.model.readCurrent(); expect(s.model.getSnapshot()).toMatchObject({ phase: "review", sourceVersion: 1 }); s.model.prepareNew(); expect(s.model.getSnapshot()).toMatchObject({ phase: "prepared", sourceVersion: 9 }); expect(s.add).toHaveBeenCalledTimes(1);
  s.model.returnToReview(); expect(s.model.getSnapshot().sourceVersion).toBe(1); s.model.prepareNew(); await s.model.submitPrepared(); expect(s.add).toHaveBeenCalledTimes(2); expect(s.add.mock.calls[1]![2]).toEqual(original); expect(s.add.mock.calls[1]![2]).not.toBe(original); expect(s.add.mock.calls[1]![2]).not.toHaveProperty("expectedVersion");
});

it("does not prove lost addition from a matching current quantity and retains prior unknown after new explicit send", async () => {
  const s = setup(); s.choose(); s.add.mockRejectedValueOnce(new Error("SYNTHETIC committed response lost")); await s.model.submit(s.original); s.setNext(savedPage(addCommandCart(2, "3.500000"), [])); await s.model.readCurrent();
  expect(s.model.getSnapshot()).toMatchObject({ phase: "review", priorUnknown: true }); expect(s.model.getSnapshot().result).toBeUndefined(); s.model.prepareNew(); await s.model.submitPrepared(); expect(s.add).toHaveBeenCalledTimes(2); expect(s.model.getSnapshot()).toMatchObject({ phase: "result", priorUnknown: true });
});

it("prepares an explicitly shown new active cart only after fresh review, leaving original unknown separate", async () => {
  const s = setup(); s.choose(); s.add.mockRejectedValueOnce(new Error("SYNTHETIC lost reply")); await s.model.submit(s.original); const current = addCommandCart(1, "2"); current.id = supportId(95); current.items.forEach(item => { item.cartId = current.id; }); s.setNext(savedPage(current, [])); await s.model.readCurrent();
  s.model.prepareNew(); expect(s.model.getSnapshot().attemptedCartId).toBe(current.id); expect(s.add).toHaveBeenCalledTimes(1);
  s.add.mockImplementationOnce(async (_scope, _id, input) => addCartItemResult(current, input)); await s.model.submitPrepared(); expect(s.add.mock.calls[1]![1]).toBe(current.id); expect(s.model.getSnapshot().priorUnknown).toBe(true);
});

it.each(["dispose", "deny", "grant", "port", "page", "cart-owner", "cart-version", "checkout", "source-removed"] as const)("does not decode late item content after%s changes", async kind => {
  const s = setup(); s.choose(); let finish!: (value: unknown) => void; s.add.mockImplementationOnce(() => new Promise(done => { finish = done; })); const pending = s.model.submit(s.original);
  if (kind === "dispose") s.model.dispose(); if (kind === "deny") s.model.denyAll(); if (kind === "grant") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; if (kind === "port") delete s.fixture.addCartItem; if (kind === "page") s.setPage(savedPage(addCommandCart(), [])); if (kind === "cart-owner") s.cart.buyerOrganizationId = supportId(99); if (kind === "cart-version") s.cart.version++; if (kind === "checkout") s.cart.checkout = { id: supportId(99) }; if (kind === "source-removed") s.list.cancelEntry(s.target);
  const decoded = jest.fn(() => { throw new Error("Late item decoded"); }), result = {}; Object.defineProperty(result, "id", { get: decoded }); finish(result); await pending; expect(decoded).not.toHaveBeenCalled(); expect(s.model.getSnapshot().phase).not.toBe("result");
});

it("keeps failed refresh recoverable, can only observe a missing current cart and never clears the original list on acknowledgement/discard", async () => {
  const s = setup(), before = JSON.stringify(s.list.getSnapshot()); s.choose(); s.add.mockRejectedValueOnce(new Error("SYNTHETIC timeout")); await s.model.submit(s.original); s.setNext(undefined); await s.model.readCurrent(); expect(s.model.getSnapshot().phase).toBe("read-error");
  s.setNext(savedPage(null, [])); await s.model.readCurrent(); expect(s.model.canPrepare()).toBe(false); expect(s.model.acknowledge()).toBe(true); s.model.discard(); expect(JSON.stringify(s.list.getSnapshot())).toBe(before); expect(s.model.getSnapshot()).toEqual({ phase: "idle", priorUnknown: true });
});

it("can reread a stale review after leaving and returning, and discards an unsent preparation when reading again", async () => {
  const s = setup(); s.choose(); s.add.mockRejectedValueOnce(new Error("SYNTHETIC lost reply")); await s.model.submit(s.original);
  s.setNext(savedPage(addCommandCart(2, "3.5"), [])); await s.model.readCurrent();
  s.setPage(savedPage(addCommandCart(2, "3.5"), [])); expect(s.model.canPrepare()).toBe(false); expect(s.model.canRead()).toBe(true);
  s.setNext(savedPage(addCommandCart(3, "4.5"), [])); await s.model.readCurrent(); expect(s.model.canPrepare()).toBe(true);
  s.model.prepareNew(); expect(s.model.getSnapshot().sourceVersion).toBe(3);
  s.setNext(savedPage(addCommandCart(4, "5.5"), [])); await s.model.readCurrent(); expect(s.model.getSnapshot()).toMatchObject({ phase: "review", sourceVersion: 1 }); expect(s.add).toHaveBeenCalledTimes(1);
});
