import type { CartResponse } from "../../../packages/schemas/src/core-api";
import { updateCartItemSchema } from "../../../packages/schemas/src/index";
import { createCartQuantityCommands, type CartCommandFixture, type CartQuantityInput } from "./cart-command-fixture";
import { createCartQuantityDrafts } from "./cart-quantity-draft";
import { cartCommandScope, cartCommandAuthorization, commandCart, quantityCartResult, cartCommandError } from "./test-fixtures/cart-commands";
import { supportId } from "./test-fixtures/support";
function setup(version = 1) {
  let current: CartResponse | null = commandCart(version), next: CartResponse | null | undefined = current;
  const original = current, item = original.items[0]!, drafts = createCartQuantityDrafts(cartCommandScope); drafts.syncCurrent(original); drafts.begin(original, item);
  const update = jest.fn(async (_scope: typeof cartCommandScope, _cartId: string, _itemId: string, input: CartQuantityInput): Promise<unknown> => quantityCartResult(input));
  const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), updateCartItem: update };
  const reload = jest.fn(async () => { current = next ?? (next === null ? null : current); if (current) drafts.syncCurrent(current); return next; });
  const model = createCartQuantityCommands(cartCommandScope, fixture, drafts, () => current, reload);
  return { original, item, drafts, update, fixture, model, reload, setCurrent: (value: CartResponse | null) => { current = value; }, setNext: (value: CartResponse | null | undefined) => { next = value; }, current: () => current, fill: (text = " 3,5 ") => drafts.change(original, item, text) };
}
it("preserves an edited unsent quantity when rereading the same cart version before new review", async () => {
  const s = setup(); s.fill(); s.update.mockRejectedValueOnce(new Error("SYNTHETIC response lost")); await s.model.submit(s.original, s.item); const sent = s.update.mock.calls[0]![3];
  s.setNext(commandCart(2, "4")); await s.model.readCurrent(s.original.id, s.item.id); s.model.review(s.original.id, s.item.id);
  const current = s.current()!, item = current.items[0]!; s.drafts.change(current, item, " 5,5 ");
  s.setNext(commandCart(2, "4")); await s.model.readCurrent(s.original.id, s.item.id); s.model.review(s.original.id, s.item.id);
  expect(s.drafts.getLine(s.current()!, s.current()!.items[0]!)?.text).toBe(" 5,5 ");
  expect(s.model.stateFor(s.original.id).input).toEqual({ expectedVersion: 2, quantity: 5.5 }); expect(sent.quantity).toBe(3.5); expect(s.update).toHaveBeenCalledTimes(1);
});
it.each(["permission", "organizationId", "userId", "environment", "generation", "provenance"])("requires explicit scoped synthetic order.create authority: %s", async field => {
  const s = setup(); s.fill(); if (field === "permission") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; else if (field === "provenance") s.fixture.authorization = { ...s.fixture.authorization, provenance: "production" } as never; else s.fixture.authorization = { ...s.fixture.authorization, scope: { ...cartCommandScope, [field]: field === "generation" ? 99 : field === "environment" ? "other" : supportId(99) } };
  await s.model.submit(s.original, s.item); expect(s.update).not.toHaveBeenCalled(); expect(s.model.isAvailable()).toBe(false);
});
it.each(["", "0", "-1", "1000001", "0.0000001", "1.0000000000000000001", "1,2,3"])("rejects invalid or rounded quantity text %j before any mutation", async text => { const s = setup(); s.fill(text); await s.model.submit(s.original, s.item); expect(s.update).not.toHaveBeenCalled(); expect(s.drafts.getLine(s.original, s.item)?.text).toBe(text); });
it("sends exactly numeric quantity and expectedVersion, freezes the actual input and keeps exact server minorstrings", async () => {
  const s = setup(); s.fill(); await s.model.submit(s.original, s.item); const [scope, cartId, itemId, input] = s.update.mock.calls[0]!;
  expect(scope).toEqual(cartCommandScope); expect(cartId).toBe(s.original.id); expect(itemId).toBe(s.item.id); expect(input).toEqual(updateCartItemSchema.parse({ expectedVersion: 1, quantity: 3.5 })); expect(Object.keys(input).sort()).toEqual(["expectedVersion", "quantity"]); expect(Object.isFrozen(input)).toBe(true); expect(input).not.toHaveProperty("idempotencyKey");
  expect(s.model.stateFor(cartId)).toMatchObject({ phase: "success", result: { version: 2, items: [{ unitPriceMinor: "90071992547409931234", totalPriceMinor: "90071992547409939999" }] } }); expect(s.item.quantity).toBe("2"); expect(s.original.version).toBe(1); expect(s.drafts.getLine(s.original, s.item)?.text).toBe(" 3,5 ");
});
it("accepts source no-op at the same version only for an already equal quantity", async () => {
  const s = setup(); s.fill(" 2,000000 "); s.update.mockResolvedValueOnce(commandCart(1, "2.000000")); await s.model.submit(s.original, s.item); expect(s.model.stateFor(s.original.id).phase).toBe("success"); expect(s.model.stateFor(s.original.id).result?.version).toBe(1);
  const other = setup(); other.fill(); other.update.mockResolvedValueOnce(commandCart(1, "3.5")); await other.model.submit(other.original, other.item); expect(other.model.stateFor(other.original.id).phase).toBe("unknown");
});
it("blocks duplicate pending clicks and does not blindly retry an unknown outcome", async () => {
  const s = setup(); s.fill(); let fail!: (error: unknown) => void; s.update.mockImplementationOnce(() => new Promise((_yes, no) => { fail = no; })); const pending = s.model.submit(s.original, s.item); await s.model.submit(s.original, s.item); expect(s.update).toHaveBeenCalledTimes(1); fail(new Error("timeout")); await pending;
  expect(s.model.stateFor(s.original.id)).toMatchObject({ phase: "unknown", rawText: " 3,5 ", input: { expectedVersion: 1 } }); await s.model.submit(s.original, s.item); expect(s.update).toHaveBeenCalledTimes(1); expect(s.reload).not.toHaveBeenCalled();
});
it("requires a real fresh read and explicit review after CART_VERSION_CONFLICT, without auto-version or resend", async () => {
  const s = setup(); s.fill(); s.update.mockRejectedValueOnce(cartCommandError(409)); await s.model.submit(s.original, s.item); const first = s.update.mock.calls[0]![3]; expect(s.model.stateFor(s.original.id).phase).toBe("conflict");
  s.setNext(commandCart(2, "4")); await s.model.readCurrent(s.original.id, s.item.id); expect(s.reload).toHaveBeenCalledTimes(1); expect(s.update).toHaveBeenCalledTimes(1); expect(s.model.stateFor(s.original.id)).toMatchObject({ phase: "review", input: { expectedVersion: 1 }, latest: { version: 2 } }); expect(first.expectedVersion).toBe(1);
  const fresh = s.current()!, freshItem = fresh.items[0]!; await s.model.submit(fresh, freshItem); expect(s.update).toHaveBeenCalledTimes(1); s.model.review(fresh.id, freshItem.id); expect(s.drafts.getLine(fresh, freshItem)?.text).toBe(" 3,5 "); expect(s.model.stateFor(fresh.id)).toMatchObject({ phase: "prepared", input: { expectedVersion: 2 } }); expect(s.update).toHaveBeenCalledTimes(1);
  await s.model.submit(fresh, freshItem); expect(s.update).toHaveBeenCalledTimes(2); expect(s.update.mock.calls[1]![3]).toEqual({ expectedVersion: 2, quantity: 3.5 }); expect(first.expectedVersion).toBe(1);
});
it("does not infer lost-operation authorship from a matching fresh quantity or invent a successful receipt", async () => {
  const s = setup(); s.fill(); s.update.mockRejectedValueOnce(new Error("SYNTHETIC committed response lost")); await s.model.submit(s.original, s.item); s.setNext(commandCart(2, "3.500000")); await s.model.readCurrent(s.original.id, s.item.id);
  expect(s.model.stateFor(s.original.id)).toMatchObject({ phase: "review", priorUnknown: true, latest: { version: 2 } }); expect(s.model.stateFor(s.original.id).result).toBeUndefined(); expect(s.update).toHaveBeenCalledTimes(1); expect(s.model.closeRead(s.original.id, s.item.id)).toBe(true); expect(s.model.stateFor(s.original.id).phase).toBe("observed"); expect(s.model.stateFor(s.original.id).result).toBeUndefined();
});
it.each([400, 401, 403, 404])("keeps raw input on definitive %s and never automatically reissues a command", async status => {
  const s = setup(); s.fill(); s.update.mockRejectedValueOnce(cartCommandError(status)); await s.model.submit(s.original, s.item); expect(s.model.stateFor(s.original.id).phase).toBe("rejected"); expect(s.model.stateFor(s.original.id).rawText).toBe(" 3,5 "); expect(s.drafts.getLine(s.original, s.item)?.text).toBe(" 3,5 "); expect(s.update).toHaveBeenCalledTimes(1);
  if (status !== 400) { await s.model.submit(s.original, s.item); expect(s.update).toHaveBeenCalledTimes(1); }
});
it.each(["cart", "owner", "item-cart", "duplicate-item"])("rejects response %s identity before public/minor/private content", async field => {
  const s = setup(); s.fill(); const value = quantityCartResult({ expectedVersion: 1, quantity: 3.5 }), hidden = jest.fn(() => { throw new Error("Unbound cart content read"); });
  if (field === "cart") value.id = supportId(99); else if (field === "owner") value.buyerOrganizationId = supportId(99); else if (field === "item-cart") value.items[0]!.cartId = supportId(99); else value.items.push(value.items[0]!);
  if (field === "cart" || field === "owner") Object.defineProperty(value, "items", { get: hidden }); else Object.defineProperty(value.items[0]!, "totalPriceMinor", { get: hidden }); s.update.mockResolvedValueOnce(value); await s.model.submit(s.original, s.item); expect(s.model.stateFor(s.original.id).phase).toBe("unknown"); expect(hidden).not.toHaveBeenCalled();
});
it.each(["item-missing", "offer", "quantity", "stale-version", "future-version", "checkout"])("does not accept a wrong/missing command result: %s", async field => {
  const s = setup(field === "stale-version" ? 2 : 1); s.fill(); const value = quantityCartResult({ expectedVersion: s.original.version, quantity: 3.5 });
  if (field === "item-missing") value.items = []; else if (field === "offer") value.items[0]!.offerId = supportId(99); else if (field === "quantity") value.items[0]!.quantity = "99"; else if (field === "stale-version") value.version = 1; else if (field === "future-version") value.version = 99; else value.checkout = { id: supportId(99) };
  s.update.mockResolvedValueOnce(value); await s.model.submit(s.original, s.item); expect(s.model.stateFor(s.original.id).phase).toBe("unknown");
});
it.each(["cart-pointer", "version", "dispose", "grant"])("discards a late result before decoding after %s changes", async source => {
  const s = setup(); s.fill(); let finish!: (body: unknown) => void; s.update.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const pending = s.model.submit(s.original, s.item);
  if (source === "dispose") s.model.dispose(); else if (source === "grant") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; else { const next = commandCart(2); if (source === "cart-pointer") { next.id = supportId(99); next.items.forEach(item => { item.cartId = next.id; }); } s.setCurrent(next); }
  const hidden = jest.fn(() => { throw new Error("Late result decoded"); }), value = {}; Object.defineProperty(value, "id", { get: hidden }); finish(value); await pending; expect(hidden).not.toHaveBeenCalled(); expect(s.model.stateFor(s.original.id).phase).not.toBe("success");
});
it("keeps reconciliation unconfirmed on failed, stale and missing reads, then permits only explicit review of a fresh source", async () => {
  const s = setup(2); s.fill(); s.update.mockRejectedValueOnce(new Error("timeout")); await s.model.submit(s.original, s.item); s.setNext(undefined); await s.model.readCurrent(s.original.id, s.item.id); expect(s.model.stateFor(s.original.id).phase).toBe("read-error");
  s.setNext(commandCart(1)); await s.model.readCurrent(s.original.id, s.item.id); expect(s.model.stateFor(s.original.id).phase).toBe("read-error"); expect(s.model.canReview(s.original.id, s.item.id)).toBe(false);
  s.setNext(null); await s.model.readCurrent(s.original.id, s.item.id); expect(s.model.stateFor(s.original.id).phase).toBe("source-changed"); expect(s.model.canRead(s.original.id, s.item.id)).toBe(false);
  s.setCurrent(commandCart(3)); s.setNext(s.current()); await s.model.readCurrent(s.original.id, s.item.id); expect(s.model.stateFor(s.original.id).phase).toBe("review"); s.model.review(s.original.id, s.item.id); expect(s.model.stateFor(s.original.id).phase).toBe("prepared"); s.model.returnToReview(s.original.id, s.item.id); expect(s.model.stateFor(s.original.id).phase).toBe("review"); expect(s.update).toHaveBeenCalledTimes(1);
});
it("keeps the old lost attempt unconfirmed even after a separately reviewed same-quantity no-op succeeds", async () => {
 const s = setup(); s.fill(); s.update.mockRejectedValueOnce(new Error("lost response")); await s.model.submit(s.original, s.item); const originalInput = s.update.mock.calls[0]![3]; s.setNext(commandCart(2, "3.500000")); await s.model.readCurrent(s.original.id, s.item.id); s.model.review(s.original.id, s.item.id);
 const fresh = s.current()!; s.update.mockResolvedValueOnce(commandCart(2, "3.500000")); await s.model.submit(fresh, fresh.items[0]!); expect(s.model.stateFor(fresh.id)).toMatchObject({ phase: "success", priorUnknown: true, result: { version: 2 } }); expect(s.update).toHaveBeenCalledTimes(2); expect(s.update.mock.calls[1]![3]).toEqual({ expectedVersion: 2, quantity: 3.5 }); expect(originalInput.expectedVersion).toBe(1);
});

it("does not label a different structured 409 as CART_VERSION_CONFLICT or silently retry it", async () => {
 const s = setup(); s.fill(); s.update.mockRejectedValueOnce(cartCommandError(409, "SYNTHETIC_OTHER_CONFLICT")); await s.model.submit(s.original, s.item); expect(s.model.stateFor(s.original.id)).toMatchObject({ phase: "rejected", issue: "conflict" }); await s.model.submit(s.original, s.item); expect(s.update).toHaveBeenCalledTimes(1); expect(s.model.canRead(s.original.id, s.item.id)).toBe(true);
});
