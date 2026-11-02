import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { createCartQuantityCommands, type CartCommandFixture, type CartQuantityInput, type CartVersionInput } from "./cart-command-fixture";
import { createCartQuantityDrafts } from "./cart-quantity-draft";
import { cartCommandScope, cartCommandAuthorization, commandCart, cartCommandError } from "./test-fixtures/cart-commands";
import { savedPage } from "./test-fixtures/carts";

function differentCart() {
 const cart = commandCart(7); cart.id = "00000000-0000-4000-8000-000000000900";
 cart.items[0]!.cartId = cart.id; cart.items[0]!.id = "00000000-0000-4000-8000-000000000901"; return cart;
}
function setup(kind: "quantity" | "remove" = "quantity", provider = true) {
 const original = commandCart(), item = original.items[0]!, drafts = createCartQuantityDrafts(cartCommandScope);
 let page: WorkspaceCartPage | null = savedPage(original, []), current: CartResponse | null = page.current;
 // Use the captured original as the actual current reference, as the public reader does.
 page = { ...page, current: original }; current = original; drafts.syncCurrent(original); drafts.begin(original, item); drafts.change(original, item, " 3,5 ");
 const update = jest.fn(async (_scope: typeof cartCommandScope, _cartId: string, _itemId: string, _input: CartQuantityInput): Promise<unknown> => { throw new Error("SYNTHETIC response lost"); });
 const remove = jest.fn(async (_scope: typeof cartCommandScope, _cartId: string, _itemId: string, _input: CartVersionInput): Promise<unknown> => { throw new Error("SYNTHETIC response lost"); });
 const reload = jest.fn(async (): Promise<CartResponse | null | undefined> => current);
 const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), updateCartItem: update, removeCartItem: remove };
 const model = createCartQuantityCommands(cartCommandScope, fixture, drafts, () => current, reload, () => false, provider ? () => page : undefined);
 const send = async () => { if (kind === "quantity") await model.submit(original, item); else { model.beginRemove(original, item); await model.confirmRemove(original.id, item.id); } };
 return { model, fixture, original, item, drafts, update, remove, reload, send, setPage: (value: WorkspaceCartPage | null) => { page = value; current = value?.current ?? null; }, setCurrent: (value: CartResponse | null) => { current = value; } };
}

it.each(["quantity", "remove"] as const)("preserves unknown %s while explicitly observing a different cart and enabling a separate new operation", async kind => {
 const s = setup(kind); await s.send(); const first = (kind === "quantity" ? s.update.mock.calls[0]![3] : s.remove.mock.calls[0]![3]); const next = differentCart(); s.setPage({ ...savedPage(null, []), current: next });
 s.drafts.syncCurrent(next); s.drafts.begin(next, next.items[0]!); s.drafts.change(next, next.items[0]!, "4");
 expect(s.model.canSubmit(next, next.items[0]!)).toBe(false); expect(s.model.canBeginRemove(next, next.items[0]!)).toBe(false);
 const observation = s.model.workspaceObservation(s.original.id, s.item.id)!; expect(observation.current).toBe(next); expect(s.model.canRead(s.original.id, s.item.id)).toBe(false);
 expect(s.model.observeWorkspace(s.original.id, s.item.id, observation)).toBe(true);
 expect(s.model.stateFor(s.original.id)).toMatchObject({ phase: "observed", priorUnknown: true, operation: kind });
 expect(s.model.isLocked(s.original.id)).toBe(false); expect(s.model.canSubmit(next, next.items[0]!)).toBe(true); expect(s.model.canBeginRemove(next, next.items[0]!)).toBe(true);
 expect(first).toEqual(kind === "quantity" ? { expectedVersion: 1, quantity: 3.5 } : { expectedVersion: 1 }); expect(Object.isFrozen(first)).toBe(true);
 expect(s.update).toHaveBeenCalledTimes(kind === "quantity" ? 1 : 0); expect(s.remove).toHaveBeenCalledTimes(kind === "remove" ? 1 : 0); expect(s.reload).not.toHaveBeenCalled();
 expect(s.model.observeWorkspace(s.original.id, s.item.id, observation)).toBe(false); expect(s.model.attemptTarget(s.original.id)).toBeNull(); expect(s.model.canReadOriginal(s.original.id)).toBe(true);
});
it.each(["quantity", "remove"] as const)("accepts only an actual nullable-current workspace page for old %s, without inventing an old receipt", async kind => {
 const s = setup(kind); await s.send(); s.setPage(savedPage(null, [])); const proof = s.model.workspaceObservation(s.original.id, s.item.id)!;
 expect(proof.current).toBeNull(); expect(s.model.observeWorkspace(s.original.id, s.item.id, proof)).toBe(true);
 expect(s.model.stateFor(s.original.id)).toEqual({ phase: "observed", operation: kind, itemId: s.item.id, priorUnknown: true });
 expect(s.model.stateFor(s.original.id).result).toBeUndefined(); expect(s.model.cancelLocal(s.original.id, s.item.id)).toBe(true);
 expect(s.model.stateFor(s.original.id)).toMatchObject({ phase: "idle", priorUnknown: true }); expect(s.model.canReadOriginal(s.original.id)).toBe(true);
});
it.each(["provider-absent", "page-absent", "same-cart", "foreign-current", "foreign-row", "checkout", "inactive", "invalid-version", "mismatched-current"])("does not treat %s as authority to unlock an old attempt", async invalid => {
 const s = setup("quantity", invalid !== "provider-absent"); await s.send(); const next = differentCart(), page = { ...savedPage(null, []), current: next };
 if (invalid === "same-cart") page.current = commandCart(2);
 if (invalid === "foreign-current") next.buyerOrganizationId = "00000000-0000-4000-8000-000000000999";
 if (invalid === "foreign-row") { const row = commandCart(); row.buyerOrganizationId = "00000000-0000-4000-8000-000000000999"; page.items = [row]; }
 if (invalid === "checkout") next.checkout = { id: "00000000-0000-4000-8000-000000000998", status: "COMPLETED" };
 if (invalid === "inactive") next.status = "ABANDONED";
 if (invalid === "invalid-version") next.version = 0;
 s.setPage(invalid === "page-absent" ? null : page); if (invalid === "mismatched-current") s.setCurrent(differentCart());
 expect(s.model.workspaceObservation(s.original.id, s.item.id)).toBeNull(); expect(s.model.isLocked(s.original.id)).toBe(true); expect(s.update).toHaveBeenCalledTimes(1);
});
it.each(["page", "current", "item", "cart"])("rejects stale or substituted %s observation witnesses", async change => {
 const s = setup(); await s.send(); const next = differentCart(), page = { ...savedPage(null, []), current: next }; s.setPage(page);
 const proof = s.model.workspaceObservation(s.original.id, s.item.id)!;
 if (change === "page") s.setPage({ ...page }); if (change === "current") s.setPage({ ...page, current: differentCart() });
 expect(s.model.observeWorkspace(change === "cart" ? next.id : s.original.id, change === "item" ? next.items[0]!.id : s.item.id, proof)).toBe(false);
 expect(s.model.stateFor(s.original.id).phase).toBe("unknown");
});
it.each(["quantity", "remove"] as const)("never observes away pending %s writes or permits another cart write", async kind => {
 const s = setup(kind); let reject!: (error: unknown) => void;
 if (kind === "quantity") s.update.mockImplementationOnce(() => new Promise((_yes, no) => { reject = no; })); else s.remove.mockImplementationOnce(() => new Promise((_yes, no) => { reject = no; }));
 const work = s.send(), next = differentCart(); s.setPage({ ...savedPage(null, []), current: next }); s.drafts.syncCurrent(next); s.drafts.begin(next, next.items[0]!);
 expect(s.model.stateFor(s.original.id).phase).toBe("pending"); expect(s.model.workspaceObservation(s.original.id, s.item.id)).toBeNull(); expect(s.model.canSubmit(next, next.items[0]!)).toBe(false);
 reject(new Error("SYNTHETIC response lost")); await work; expect(s.model.stateFor(s.original.id)).toMatchObject({ phase: "source-changed", priorUnknown: true }); expect(s.model.workspaceObservation(s.original.id, s.item.id)).not.toBeNull();
});
it.each([401, 403])("cannot use a later read as a new mutation grant after structured %s", async status => {
 const s = setup(); s.update.mockRejectedValueOnce(cartCommandError(status)); await s.send(); s.setPage(savedPage(null, []));
 expect(s.model.workspaceObservation(s.original.id, s.item.id)).toBeNull(); expect(s.model.canReadOriginal(s.original.id)).toBe(false); expect(s.model.attemptTarget(s.original.id)).toBeNull();
});
it.each(["permission", "scope", "denied", "disposed"])("invalidates original-cart inspection and observation when %s changes", async invalid => {
 const s = setup(); await s.send(); s.setPage(savedPage(null, [])); const proof = s.model.workspaceObservation(s.original.id, s.item.id)!;
 if (invalid === "permission") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
 if (invalid === "scope") s.fixture.authorization = { ...s.fixture.authorization, scope: { ...cartCommandScope, generation: 99 } };
 if (invalid === "denied") s.model.denyAll(); if (invalid === "disposed") s.model.dispose();
 expect(s.model.canReadOriginal(s.original.id)).toBe(false); expect(s.model.workspaceObservation(s.original.id, s.item.id)).toBeNull(); expect(s.model.observeWorkspace(s.original.id, s.item.id, proof)).toBe(false);
});
it("does not grant inspection for an unsent or cancelled removal confirmation or arbitrary cart ID", () => {
 const s = setup("remove"); expect(s.model.canReadOriginal(s.original.id)).toBe(false); s.model.beginRemove(s.original, s.item); expect(s.model.canReadOriginal(s.original.id)).toBe(false);
 expect(s.model.attemptTarget(s.original.id)).toEqual({ cartId: s.original.id, itemId: s.item.id, expectedVersion: 1 }); s.model.cancelRemove(s.original.id, s.item.id); expect(s.model.canReadOriginal(s.original.id)).toBe(false); expect(s.model.canReadOriginal(differentCart().id)).toBe(false);
});
it("invalidates a superseded metadata read without decoding its late untrusted body or replaying the old write", async () => {
 const s = setup(); await s.send(); let complete!: (value: CartResponse | null | undefined) => void;
 s.reload.mockImplementationOnce(() => new Promise(yes => { complete = yes; })); const reading = s.model.readCurrent(s.original.id, s.item.id); expect(s.model.stateFor(s.original.id).phase).toBe("reading");
 s.setPage(savedPage(null, [])); const proof = s.model.workspaceObservation(s.original.id, s.item.id)!; expect(s.model.observeWorkspace(s.original.id, s.item.id, proof)).toBe(true);
 const poisoned = Object.defineProperty({}, "id", { get: () => { throw new Error("must not decode stale read"); } }); complete(poisoned as CartResponse); await reading;
 expect(s.model.stateFor(s.original.id)).toMatchObject({ phase: "observed", priorUnknown: true }); expect(s.update).toHaveBeenCalledTimes(1); expect(s.reload).toHaveBeenCalledTimes(1);
});

it("keeps a reviewed but unsent older-cart preparation distinct from a new cart operation until explicit observation", async () => {
 const s = setup(); await s.send(); const refreshed = commandCart(2); s.setPage({ ...savedPage(null, []), current: refreshed });
 await s.model.readCurrent(s.original.id, s.item.id); s.model.review(s.original.id, s.item.id); expect(s.model.stateFor(s.original.id).phase).toBe("prepared");
 const next = differentCart(); s.setPage({ ...savedPage(null, []), current: next }); s.drafts.syncCurrent(next); s.drafts.begin(next, next.items[0]!);
 expect(s.model.canSubmit(next, next.items[0]!)).toBe(false); const proof = s.model.workspaceObservation(s.original.id, s.item.id)!; expect(s.model.observeWorkspace(s.original.id, s.item.id, proof)).toBe(true);
 expect(s.model.canSubmit(next, next.items[0]!)).toBe(true); expect(s.update).toHaveBeenCalledTimes(1); expect(s.update.mock.calls[0]![3]).toEqual({ expectedVersion: 1, quantity: 3.5 });
});
