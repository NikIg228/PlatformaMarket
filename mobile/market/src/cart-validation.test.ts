import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { createReadController } from "./read-controller";
import { createCartValidation } from "./cart-validation-fixture";
import { bindMarketReads } from "./market-transport";
import { cartCommandScope, cartCommandAuthorization, cartCommandError, commandCart } from "./test-fixtures/cart-commands";
import type { CartCommandFixture } from "./cart-command-fixture";
import { cartValidationResult } from "./test-fixtures/cart-validation";
import { savedPage } from "./test-fixtures/carts";
import { listDraftPayload } from "./test-fixtures/list-draft";
function setup() {
 const cart = commandCart(3); let page: WorkspaceCartPage | null = { ...savedPage(null, []), current: cart }, locked = false;
 const read = jest.fn(async (_scope: typeof cartCommandScope, _id: string): Promise<unknown> => cartValidationResult(cart));
 const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), validateCart: read };
 const model = createCartValidation(cartCommandScope, fixture, () => page, () => locked);
 return { model, fixture, cart, page: page!, read, setPage: (value: WorkspaceCartPage | null) => { page = value; }, lock: (value: boolean) => { locked = value; } };
}
it.each(["unchanged", "changed", "unavailable"] as const)("decodes actual %s response and exact strings without editing cart, calculating amounts or inventing checkout", async kind => {
 const s = setup(), before = JSON.stringify(s.cart), result = cartValidationResult(s.cart, kind); s.read.mockResolvedValueOnce(result); await s.model.validate(s.page);
 expect(s.read.mock.calls).toEqual([[cartCommandScope, s.cart.id]]); expect(s.read.mock.calls[0]).toHaveLength(2); expect(s.model.resultFor(s.page)).toEqual(result); expect(JSON.stringify(s.cart)).toBe(before);
 expect(s.model.getSnapshot().phase).toBe("ready"); expect(s.model.blocksOtherMutations()).toBe(false);
 if (kind === "changed") expect(s.model.resultFor(s.page)?.items[0]!.current).toMatchObject({ unitPriceMinor: "90071992547409939998", totalPriceMinor: "90071992547409939999", availableQuantity: "1.500001" });
});
it("preserves empty validation with source canCheckout false, rather than treating zero rows as an order", async () => {
 const s = setup(); s.cart.items = []; s.read.mockResolvedValueOnce(cartValidationResult(s.cart)); await s.model.validate(s.page);
 expect(s.model.resultFor(s.page)).toMatchObject({ canCheckout: false, hasChanges: false, items: [] });
});
it.each(["port", "permission", "provenance", "organizationId", "userId", "environment", "generation"])("requires explicit synthetic exact-scope order.create validation authority: %s", async field => {
 const s = setup(); if (field === "port") s.fixture.validateCart = undefined; else if (field === "permission") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; else if (field === "provenance") s.fixture.authorization = { ...s.fixture.authorization, provenance: "production" } as never; else s.fixture.authorization = { ...s.fixture.authorization, scope: { ...cartCommandScope, [field]: field === "generation" ? 99 : "other" } };
 await s.model.validate(s.page); expect(s.read).not.toHaveBeenCalled(); expect(s.model.isAvailable()).toBe(false);
});
it.each(["not-current", "no-current", "foreign", "foreign-row", "inactive", "checkout", "version", "line-binding", "duplicate-line", "other-operation"])("does not validate inadmissible current source: %s", async invalid => {
 const s = setup(); if (invalid === "not-current") s.setPage({ ...s.page }); if (invalid === "no-current") s.page.current = null;
 if (invalid === "foreign") s.cart.buyerOrganizationId = "00000000-0000-4000-8000-000000000999";
 if (invalid === "foreign-row") { const row = commandCart(); row.buyerOrganizationId = "00000000-0000-4000-8000-000000000999"; s.page.items = [row]; }
 if (invalid === "inactive") s.cart.status = "ABANDONED"; if (invalid === "checkout") s.cart.checkout = { id: "00000000-0000-4000-8000-000000000998", status: "FAILED" };
 if (invalid === "version") s.cart.version = 0; if (invalid === "line-binding") s.cart.items[0]!.cartId = "00000000-0000-4000-8000-000000000998";
 if (invalid === "duplicate-line") s.cart.items.push({ ...s.cart.items[0]! }); if (invalid === "other-operation") s.lock(true);
 expect(s.model.canValidate(s.page)).toBe(false); await s.model.validate(s.page); expect(s.read).not.toHaveBeenCalled();
});
it.each(["cartId", "cartVersion"])("checks response %s before reading any item snapshot", async field => {
 const s = setup(), result = { ...cartValidationResult(s.cart), [field]: field === "cartId" ? "00000000-0000-4000-8000-000000000998" : 4 };
 const content = jest.fn(() => { throw new Error("foreign private content must not be read"); }); Object.defineProperty(result, "items", { get: content }); s.read.mockResolvedValueOnce(result); await s.model.validate(s.page);
 expect(content).not.toHaveBeenCalled(); expect(s.model.getSnapshot()).toMatchObject({ phase: "error", issue: "invalid-result" });
});
it.each(["cartItemId", "offerId", "missing", "duplicate"])("checks complete unique %s identities before previous/current/message content", async field => {
 const s = setup(), result = cartValidationResult(s.cart), content = jest.fn(() => { throw new Error("private snapshot must not be decoded"); }); const item = result.items[0]!;
 if (field === "cartItemId" || field === "offerId") item[field] = "00000000-0000-4000-8000-000000000998"; if (field === "missing") result.items = []; if (field === "duplicate") result.items.push(item);
 Object.defineProperty(item, "previous", { get: content }); Object.defineProperty(item, "current", { get: content }); Object.defineProperty(item, "message", { get: content }); s.read.mockResolvedValueOnce(result); await s.model.validate(s.page);
 expect(content).not.toHaveBeenCalled(); expect(s.model.getSnapshot()).toMatchObject({ phase: "error", issue: "invalid-result" });
});
it.each(["previous-quantity", "previous-unit", "previous-total", "previous-currency", "current-quantity", "current-currency", "invalid-status", "invalid-flag"])("rejects incompatible or malformed %s without a cart merge", async field => {
 const s = setup(), result = cartValidationResult(s.cart, "changed"), row = result.items[0]!;
 if (field === "previous-quantity") row.previous.quantity = "4"; if (field === "previous-unit") row.previous.unitPriceMinor = "1"; if (field === "previous-total") row.previous.totalPriceMinor = "1";
 if (field === "previous-currency") row.previous.currency = "EUR"; if (field === "current-quantity") row.current!.quantity = "4"; if (field === "current-currency") row.current!.currency = "EUR";
 if (field === "invalid-status") row.status = "READY" as never; if (field === "invalid-flag") result.canCheckout = "true" as never;
 s.read.mockResolvedValueOnce(result); await s.model.validate(s.page); expect(s.model.getSnapshot()).toMatchObject({ phase: "error", issue: "invalid-result" }); expect(s.model.resultFor(s.page)).toBeNull(); expect(s.cart.items[0]!.unitPriceMinor).toBe("90071992547409931234");
});
it.each(["page", "cart", "version", "quantity", "offer", "unit", "total", "currency", "line-count", "owner", "status", "checkout", "line-id", "line-currency", "other-operation", "scope", "disposed"])("drops late %s response before decoding its body", async change => {
 const s = setup(); let finish!: (body: unknown) => void; s.read.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const pending = s.model.validate(s.page);
 if (change === "page") s.setPage({ ...s.page }); if (change === "cart") s.setPage({ ...s.page, current: commandCart(3) }); if (change === "version") s.cart.version++;
 if (change === "quantity") s.cart.items[0]!.quantity = "4"; if (change === "offer") s.cart.items[0]!.offerId = "00000000-0000-4000-8000-000000000998";
 if (change === "owner") s.cart.buyerOrganizationId = "00000000-0000-4000-8000-000000000998"; if (change === "status") s.cart.status = "ABANDONED"; if (change === "checkout") s.cart.checkout = { id: "00000000-0000-4000-8000-000000000998", status: "FAILED" }; if (change === "line-id") s.cart.items[0]!.id = "00000000-0000-4000-8000-000000000998"; if (change === "line-currency") s.cart.items[0]!.currency = "EUR";
 if (change === "unit") s.cart.items[0]!.unitPriceMinor = "1"; if (change === "total") s.cart.items[0]!.totalPriceMinor = "1"; if (change === "currency") s.cart.currency = "EUR";
 if (change === "line-count") s.cart.items.push({ ...s.cart.items[0]!, id: "00000000-0000-4000-8000-000000000998" }); if (change === "other-operation") s.lock(true);
 if (change === "scope") s.fixture.authorization = { ...s.fixture.authorization, scope: { ...cartCommandScope, generation: 9 } }; if (change === "disposed") s.model.dispose();
 const content = jest.fn(() => { throw new Error("stale body must not be decoded"); }); finish(Object.defineProperty({}, "cartId", { get: content })); await pending; expect(content).not.toHaveBeenCalled(); expect(s.model.resultFor(s.page)).toBeNull(); expect(s.read).toHaveBeenCalledTimes(1); expect(s.model.blocksOtherMutations()).toBe(false);
});
it("serializes pending validation, requires an explicit subsequent check, and does not claim a mutation-unknown on network failure", async () => {
 const s = setup(); let reject!: (error: unknown) => void; s.read.mockImplementationOnce(() => new Promise((_yes, no) => { reject = no; })); const pending = s.model.validate(s.page); await s.model.validate(s.page);
 expect(s.model.blocksOtherMutations()).toBe(true); expect(s.read).toHaveBeenCalledTimes(1); reject(new Error("SYNTHETIC read timeout")); await pending; expect(s.model.getSnapshot()).toMatchObject({ phase: "error", issue: "read-error" }); expect(s.model.getSnapshot()).not.toHaveProperty("priorUnknown");
 expect(s.model.canValidate(s.page)).toBe(true); await s.model.validate(s.page); expect(s.read).toHaveBeenCalledTimes(2); expect(s.model.resultFor(s.page)).not.toBeNull();
});
it.each([[400,"validation"],[401,"authentication"],[403,"denied"],[404,"not-found"],[409,"conflict"],[500,"read-error"]] as const)("maps structured %i as %s without copying server error content", async (status, issue) => {
 const s = setup(); s.read.mockRejectedValueOnce(cartCommandError(status)); await s.model.validate(s.page); expect(s.model.getSnapshot()).toMatchObject({ phase: "error", issue }); expect(JSON.stringify(s.model.getSnapshot())).not.toContain("private");
 expect(s.model.canValidate(s.page)).toBe(![401,403].includes(status));
});
it("invalidates a successful validation on new read reference/other mutation without auto-running it", async () => {
 const s = setup(); await s.model.validate(s.page); s.lock(true); expect(s.model.resultFor(s.page)).toBeNull(); s.lock(false); expect(s.model.resultFor(s.page)).not.toBeNull();
 s.setPage({ ...s.page }); expect(s.model.resultFor(s.page)).toBeNull(); expect(s.read).toHaveBeenCalledTimes(1);
});
it("does not bind a default native validation POST or infer authority from BUYER reads", async () => {
 const request = jest.fn(async (_path: string): Promise<unknown> => null), client = bindMarketReads(request, cartCommandScope.organizationId), model = createCartValidation(cartCommandScope, client.cartCommandFixture, () => null);
 expect(client.cartCommandFixture).toBeUndefined(); expect(model.isAvailable()).toBe(false); expect(request).not.toHaveBeenCalled();
});
it("shares pending validation exclusion with quantity/removal and releases it after a read-only result", async () => {
 const cart = commandCart(), page = savedPage(cart, []); let finish!: (body: unknown) => void;
 const validate = jest.fn(() => new Promise<unknown>(yes => { finish = yes; })), update = jest.fn(), remove = jest.fn();
 const controller = createReadController({ scope: cartCommandScope, client: { searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => listDraftPayload("comparison-exact-offer"), workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"), workspaceCarts: async () => page, cartCommandFixture: { authorization: cartCommandAuthorization(), validateCart: validate, updateCartItem: update, removeCartItem: remove } } });
 await controller.load({ kind: "workspace-carts", input: { limit: 1 } }); const state = controller.getSnapshot().state; if (!("read" in state) || state.read.kind !== "workspace-carts") throw new Error("expected actual typed current page");
 const actual = state.read.value, current = actual.current!, item = current.items[0]!; controller.quantityDrafts.begin(current, item); controller.quantityDrafts.change(current, item, "3.5"); const pending = controller.cartValidation.validate(actual);
 expect(controller.cartQuantityCommands.canSubmit(current, item)).toBe(false); expect(controller.cartQuantityCommands.canBeginRemove(current, item)).toBe(false); await controller.cartQuantityCommands.submit(current, item); expect(update).not.toHaveBeenCalled();
 finish(cartValidationResult(current)); await pending; expect(controller.cartQuantityCommands.canSubmit(current, item)).toBe(true); expect(controller.cartValidation.resultFor(actual)).not.toBeNull(); controller.dispose();
});
