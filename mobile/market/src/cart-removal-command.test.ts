import type { CartResponse } from "../../../packages/schemas/src/core-api";
import { cartVersionSchema } from "../../../packages/schemas/src/index";
import { createCartQuantityCommands, type CartCommandFixture, type CartVersionInput } from "./cart-command-fixture";
import { createCartQuantityDrafts } from "./cart-quantity-draft";
import { cartCommandScope, cartCommandAuthorization, commandCart, removedCartResult, cartCommandError } from "./test-fixtures/cart-commands";
import { supportId } from "./test-fixtures/support";
function setup() {
 let current: CartResponse | null = commandCart(), next: CartResponse | null | undefined = current; const source = current, item = source.items[0]!, drafts = createCartQuantityDrafts(cartCommandScope); drafts.syncCurrent(source); drafts.begin(source, item);
 const remove = jest.fn(async (_scope: typeof cartCommandScope, _cartId: string, id: string, input: CartVersionInput): Promise<unknown> => removedCartResult(source, id, input));
 const update = jest.fn(async (): Promise<unknown> => { throw new Error("Quantity port must not be called by removal"); });
 const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), removeCartItem: remove, updateCartItem: update };
 const read = jest.fn(async () => { current = next ?? (next === null ? null : current); if (current) drafts.syncCurrent(current); return next; });
 const model = createCartQuantityCommands(cartCommandScope, fixture, drafts, () => current, read);
 return { source, item, drafts, remove, update, fixture, read, model, setCurrent: (value: CartResponse | null) => { current = value; }, setNext: (value: CartResponse | null | undefined) => { next = value; }, current: () => current };
}
it("opens and cancels a separate confirmation without issuing a mutation or converting invalid quantity into deletion", async () => {
 const s = setup(); s.drafts.change(s.source, s.item, "0"); await s.model.submit(s.source, s.item); expect(s.update).not.toHaveBeenCalled(); s.model.beginRemove(s.source, s.item); expect(s.model.stateFor(s.source.id)).toMatchObject({ phase: "confirm-remove", operation: "remove", sourceQuantity: "2", input: { expectedVersion: 1 } }); expect(s.remove).not.toHaveBeenCalled(); s.model.cancelRemove(s.source.id, s.item.id); expect(s.model.stateFor(s.source.id).phase).toBe("idle"); expect(s.drafts.getLine(s.source, s.item)?.text).toBe("0"); expect(s.remove).not.toHaveBeenCalled();
});
it("requires confirmation, sends only strict expectedVersion and consumes the actual empty response", async () => {
 const s = setup(); await s.model.confirmRemove(s.source.id, s.item.id); expect(s.remove).not.toHaveBeenCalled(); s.model.beginRemove(s.source, s.item); await s.model.confirmRemove(s.source.id, s.item.id);
 const [scope, cartId, itemId, input] = s.remove.mock.calls[0]!; expect(scope).toEqual(cartCommandScope); expect(cartId).toBe(s.source.id); expect(itemId).toBe(s.item.id); expect(input).toEqual(cartVersionSchema.parse({ expectedVersion: 1 })); expect(Object.keys(input)).toEqual(["expectedVersion"]); expect(input).not.toHaveProperty("idempotencyKey"); expect(input).not.toHaveProperty("quantity"); expect(Object.isFrozen(input)).toBe(true);
 expect(s.model.stateFor(cartId)).toMatchObject({ phase: "success", operation: "remove", result: { version: 2, items: [] } }); expect(s.source.items).toHaveLength(1); expect(s.update).not.toHaveBeenCalled();
});
it("accepts a same-version already-absent source no-op response without inventing a new version", async () => {
 const s = setup(); s.remove.mockResolvedValueOnce(removedCartResult(s.source, s.item.id, { expectedVersion: 1 }, 1)); s.model.beginRemove(s.source, s.item); await s.model.confirmRemove(s.source.id, s.item.id); expect(s.model.stateFor(s.source.id)).toMatchObject({ phase: "success", result: { version: 1, items: [] } });
});
it.each(["absent", "permission", "organizationId", "userId", "environment", "generation"])("does not offer or execute deletion without a matching explicit source context: %s", async field => {
 const s = setup(); if (field === "absent") delete s.fixture.removeCartItem; else if (field === "permission") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; else s.fixture.authorization = { ...s.fixture.authorization, scope: { ...cartCommandScope, [field]: field === "generation" ? 99 : field === "environment" ? "other" : supportId(99) } };
 s.model.beginRemove(s.source, s.item); await s.model.confirmRemove(s.source.id, s.item.id); expect(s.remove).not.toHaveBeenCalled(); expect(s.model.stateFor(s.source.id).phase).toBe("idle");
});
it.each(["cart", "version", "checkout", "status"])("rejects an old confirmation after its %s changes, without rewriting the payload", async changed => {
 const s = setup(); s.model.beginRemove(s.source, s.item); const input = s.model.stateFor(s.source.id).input; const current = changed === "checkout" || changed === "status" ? s.source : commandCart(2); if (changed === "cart") { current.id = supportId(99); current.items[0]!.cartId = current.id; } else if (changed === "checkout") current.checkout = { id: supportId(99) }; else if (changed === "status") current.status = "SUBMITTED"; s.setCurrent(current);
 await s.model.confirmRemove(s.source.id, s.item.id); expect(s.remove).not.toHaveBeenCalled(); expect(input?.expectedVersion).toBe(1); expect(s.model.canConfirmRemove(s.source.id, s.item.id)).toBe(false);
});
it("serializes confirmation/double clicks and blocks quantity writes while removal is pending", async () => {
 const s = setup(); let finish!: (body: unknown) => void; s.remove.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); s.model.beginRemove(s.source, s.item); s.model.beginRemove(s.source, s.item); const first = s.model.confirmRemove(s.source.id, s.item.id); await s.model.confirmRemove(s.source.id, s.item.id); await s.model.submit(s.source, s.item); expect(s.remove).toHaveBeenCalledTimes(1); expect(s.update).not.toHaveBeenCalled(); s.model.cancelRemove(s.source.id, s.item.id); expect(s.model.stateFor(s.source.id).phase).toBe("pending"); finish(removedCartResult(s.source, s.item.id, { expectedVersion: 1 })); await first; expect(s.model.stateFor(s.source.id).phase).toBe("success");
});
it.each([403, 404, 409])("keeps rejected removal %s unconfirmed and never automatically retries", async status => {
 const s = setup(); s.remove.mockRejectedValueOnce(cartCommandError(status)); s.model.beginRemove(s.source, s.item); await s.model.confirmRemove(s.source.id, s.item.id); expect(s.model.stateFor(s.source.id).phase).toBe(status === 409 ? "conflict" : "rejected"); await s.model.confirmRemove(s.source.id, s.item.id); s.model.beginRemove(s.source, s.item); expect(s.remove).toHaveBeenCalledTimes(1);
});
it("requires a fresh read plus a new explicit confirmation after409, with no automatic version change/resend", async () => {
 const s = setup(); s.remove.mockRejectedValueOnce(cartCommandError(409)); s.model.beginRemove(s.source, s.item); await s.model.confirmRemove(s.source.id, s.item.id); const firstInput = s.remove.mock.calls[0]![3]; s.setNext(commandCart(2, "4")); await s.model.readCurrent(s.source.id, s.item.id); expect(s.model.stateFor(s.source.id)).toMatchObject({ phase: "review", input: { expectedVersion: 1 }, latest: { version: 2 } }); expect(s.remove).toHaveBeenCalledTimes(1);
 s.model.review(s.source.id, s.item.id); expect(s.model.stateFor(s.source.id)).toMatchObject({ phase: "confirm-remove", input: { expectedVersion: 2 }, sourceQuantity: "4" }); expect(s.remove).toHaveBeenCalledTimes(1); await s.model.confirmRemove(s.source.id, s.item.id); expect(s.remove).toHaveBeenCalledTimes(2); expect(s.remove.mock.calls[1]![3]).toEqual({ expectedVersion: 2 }); expect(firstInput.expectedVersion).toBe(1);
});
it("treats absence after a lost reply as current facts, not proof this operation deleted the item", async () => {
 const s = setup(); s.remove.mockRejectedValueOnce(new Error("SYNTHETIC lost DELETE response")); s.model.beginRemove(s.source, s.item); await s.model.confirmRemove(s.source.id, s.item.id); expect(s.model.stateFor(s.source.id).phase).toBe("unknown"); await s.model.confirmRemove(s.source.id, s.item.id); expect(s.remove).toHaveBeenCalledTimes(1);
 s.setNext(removedCartResult(s.source, s.item.id, { expectedVersion: 1 })); await s.model.readCurrent(s.source.id, s.item.id); expect(s.model.stateFor(s.source.id)).toMatchObject({ phase: "review", priorUnknown: true, latest: { items: [] } }); expect(s.model.stateFor(s.source.id).result).toBeUndefined(); expect(s.model.canReview(s.source.id, s.item.id)).toBe(false); s.model.review(s.source.id, s.item.id); expect(s.remove).toHaveBeenCalledTimes(1); expect(s.model.closeRead(s.source.id, s.item.id)).toBe(true); expect(s.model.stateFor(s.source.id).phase).toBe("observed");
});
it.each(["cart", "owner", "retained-item", "future-version", "item-cart"])("does not accept a wrong remove response: %s", async field => {
 const s = setup(), value = removedCartResult(s.source, s.item.id, { expectedVersion: 1 });
 if (field === "cart") value.id = supportId(99); else if (field === "owner") value.buyerOrganizationId = supportId(99); else if (field === "retained-item") value.items = [...s.source.items]; else if (field === "future-version") value.version = 99; else value.items = [{ ...s.item, id: supportId(90), cartId: supportId(99) }];
 s.remove.mockResolvedValueOnce(value); s.model.beginRemove(s.source, s.item); await s.model.confirmRemove(s.source.id, s.item.id); expect(s.model.stateFor(s.source.id).phase).toBe("unknown");
});
it.each(["dispose", "cart-pointer", "version", "grant", "item-binding", "currency"])("does not decode late removal results after %s changes", async field => {
 const s = setup(); let finish!: (body: unknown) => void; s.remove.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); s.model.beginRemove(s.source, s.item); const first = s.model.confirmRemove(s.source.id, s.item.id);
 if (field === "dispose") s.model.dispose(); else if (field === "grant") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; else if (field === "item-binding") s.item.cartId = supportId(99); else if (field === "currency") s.item.currency = s.item.currency === "KZT" ? "USD" : "KZT"; else { const current = commandCart(2); if (field === "cart-pointer") { current.id = supportId(99); current.items[0]!.cartId = current.id; } s.setCurrent(current); }
 const hidden = jest.fn(() => { throw new Error("Late deletion result decoded"); }), value = {}; Object.defineProperty(value, "id", { get: hidden }); finish(value); await first; expect(hidden).not.toHaveBeenCalled(); expect(s.model.stateFor(s.source.id).phase).not.toBe("success");
});

it("keeps remaining line minorstrings exactly as returned without recomputing a cart total", async () => {
 const s = setup(); s.source.items.push({ ...s.item, id: supportId(701), offerId: supportId(702), quantity: "8", unitPriceMinor: "90071992547409931234", totalPriceMinor: "720575940379279449872" }); s.drafts.syncCurrent(s.source); s.model.beginRemove(s.source, s.item); await s.model.confirmRemove(s.source.id, s.item.id); expect(s.model.stateFor(s.source.id)).toMatchObject({ phase: "success", result: { items: [{ id: supportId(701), unitPriceMinor: "90071992547409931234", totalPriceMinor: "720575940379279449872" }] } }); expect(s.source.items).toHaveLength(2);
});

it("can reread a stale review after leaving and returning without reusing the old cart frame", async () => {
 const s = setup(); s.remove.mockRejectedValueOnce(new Error("SYNTHETIC response lost")); s.model.beginRemove(s.source, s.item); await s.model.confirmRemove(s.source.id, s.item.id);
 s.setNext(commandCart(2)); await s.model.readCurrent(s.source.id, s.item.id); s.setCurrent(commandCart(2));
 expect(s.model.canReview(s.source.id, s.item.id)).toBe(false); expect(s.model.canRead(s.source.id, s.item.id)).toBe(true);
 s.setNext(commandCart(3)); await s.model.readCurrent(s.source.id, s.item.id); expect(s.model.canReview(s.source.id, s.item.id)).toBe(true); expect(s.remove).toHaveBeenCalledTimes(1);
});
