import { repriceCartSchema } from "../../../packages/schemas/src/index";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { createCartReprice, type CartReprice } from "./cart-reprice-fixture";
import { createCartValidation } from "./cart-validation-fixture";
import type { CartCommandFixture, CartRepriceInput } from "./cart-command-fixture";
import { cartCommandScope, cartCommandAuthorization, cartCommandError, commandCart } from "./test-fixtures/cart-commands";
import { savedPage } from "./test-fixtures/carts";
import { repriceValidation, repriceResult } from "./test-fixtures/cart-reprice";
import { bindMarketReads } from "./market-transport";
function setup() {
 const cart = commandCart(3); let page: WorkspaceCartPage | null = { ...savedPage(null, []), current: cart }, next: WorkspaceCartPage | undefined = page, locked = false, workspace = true;
 const quote = jest.fn(async (): Promise<unknown> => repriceValidation(page!.current!));
 const send = jest.fn(async (_scope: typeof cartCommandScope, _id: string, input: CartRepriceInput): Promise<unknown> => repriceResult(cart, input));
 const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), validateCart: quote, repriceCart: send };
 let model: CartReprice;
 const validation = createCartValidation(cartCommandScope, fixture, () => page, () => locked || !!model?.blocksOtherMutations());
 const reload = jest.fn(async () => { page = next ?? null; return next; });
 model = createCartReprice(cartCommandScope, fixture, validation, () => page, reload, () => locked || validation.blocksOtherMutations(), () => workspace);
 return { model, validation, fixture, cart, page: page!, quote, send, reload, setPage: (value: WorkspaceCartPage | null) => { page = value; }, setNext: (value: WorkspaceCartPage | undefined) => { next = value; }, currentPage: () => page, lock: (value: boolean) => { locked = value; }, workspace: (value: boolean) => { workspace = value; }, prepare: async () => { await validation.validate(page!); return model.prepare(page!); } };
}
it("prepares only an actual fresh validation; freezes exact full snapshots and sends only after explicit confirmation", async () => {
 const s = setup(), before = JSON.stringify(s.cart); expect(s.model.prepare(s.page)).toBe(false); expect(s.send).not.toHaveBeenCalled(); expect(await s.prepare()).toBe(true);
 const state = s.model.getSnapshot(), input = state.input!; expect(input).toEqual(repriceCartSchema.parse({ expectedVersion: 3, acceptedItems: repriceValidation(s.cart).items.flatMap(item => item.current ? [{ cartItemId: item.cartItemId, snapshot: item.current }] : []) }));
 expect(Object.keys(input).sort()).toEqual(["acceptedItems", "expectedVersion"]); expect(input).not.toHaveProperty("idempotencyKey"); expect(s.send).not.toHaveBeenCalled();
 expect(Object.isFrozen(input.acceptedItems)).toBe(true); expect(Object.isFrozen(input.acceptedItems![0]!.snapshot.tax!.declaration.profile)).toBe(true); expect(Object.isFrozen(input.acceptedItems![0]!.snapshot.promotion!.gift)).toBe(true);
 expect(Object.isFrozen(state.validation!.items[0]!.previous)).toBe(true); expect(state.validation).not.toBe(s.validation.getSnapshot().result);
 expect(s.model.canConfirm()).toBe(true); await s.model.confirm(); expect(s.send.mock.calls).toEqual([[cartCommandScope, s.cart.id, input]]); expect(s.model.getSnapshot()).toMatchObject({ phase: "result", result: { version: 4 } }); expect(JSON.stringify(s.cart)).toBe(before);
});
it("cancels preparation without sending and allows another explicit preparation from the still-current quote", async () => {
 const s = setup(); await s.prepare(); expect(s.model.cancelPreparation()).toBe(true); expect(s.model.getSnapshot().phase).toBe("observed"); expect(s.model.canPrepare(s.page)).toBe(true); await s.model.confirm(); expect(s.send).not.toHaveBeenCalled();
});
it.each(["port", "permission", "provenance", "organizationId", "userId", "environment", "generation"])("requires explicit synthetic reprice permission/scope: %s", async field => {
 const s = setup(); await s.validation.validate(s.page);
 if (field === "port") s.fixture.repriceCart = undefined; else if (field === "permission") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; else if (field === "provenance") s.fixture.authorization = { ...s.fixture.authorization, provenance: "production" } as never; else s.fixture.authorization = { ...s.fixture.authorization, scope: { ...cartCommandScope, [field]: field === "generation" ? 99 : "other" } };
 expect(s.model.prepare(s.page)).toBe(false); await s.model.confirm(); expect(s.send).not.toHaveBeenCalled();
});
it.each(["page", "cart", "version", "quantity", "price", "currency", "checkout", "owner", "other-operation", "revalidation"])("does not confirm stale %s preparation or silently replace its input", async change => {
 const s = setup(); await s.prepare(); const input = s.model.getSnapshot().input!;
 if (change === "page") s.setPage({ ...s.page }); if (change === "cart") s.setPage({ ...s.page, current: commandCart(3) }); if (change === "version") s.cart.version++;
 if (change === "quantity") s.cart.items[0]!.quantity = "4"; if (change === "price") s.cart.items[0]!.unitPriceMinor = "1"; if (change === "currency") s.cart.currency = "EUR";
 if (change === "checkout") s.cart.checkout = { id: "00000000-0000-4000-8000-000000000939", status: "COMPLETED" }; if (change === "owner") s.cart.buyerOrganizationId = "00000000-0000-4000-8000-000000000939";
 if (change === "other-operation") s.lock(true); if (change === "revalidation") s.validation.dispose();
 expect(s.model.canConfirm()).toBe(false); await s.model.confirm(); expect(s.send).not.toHaveBeenCalled(); expect(input.expectedVersion).toBe(3); expect(input.acceptedItems![0]!.snapshot.quantity).toBe("2"); expect(s.model.cancelPreparation()).toBe(true);
});
it("retains actual schema500 limit and never silently slices accepted current snapshots", async () => {
 const s = setup(); s.cart.items = Array.from({ length: 501 }, (_, index) => ({ ...s.cart.items[0]!, id: `00000000-0000-4000-8000-${String(10000+index).padStart(12,"0")}`, offerId: `00000000-0000-4000-8000-${String(20000+index).padStart(12,"0")}` }));
 await s.validation.validate(s.page); expect(s.validation.resultFor(s.page)?.items).toHaveLength(501); expect(s.model.preparationUnsupported(s.page)).toBe(true); expect(s.model.prepare(s.page)).toBe(false); expect(s.send).not.toHaveBeenCalled();
});
it("excludes null current snapshots without deleting unavailable cart lines or assuming all terms became accepted", async () => {
 const s = setup(); const line = { ...s.cart.items[0]!, id: "00000000-0000-4000-8000-000000000939", offerId: "00000000-0000-4000-8000-000000000938" }; s.cart.items.push(line); const result = repriceValidation(s.cart); Object.assign(result.items[1]!, { current: null, status: "UNAVAILABLE", changes: ["AVAILABILITY"], canCheckout: false, requiresAcceptance: false }); s.quote.mockResolvedValueOnce(result);
 await s.prepare(); expect(s.model.getSnapshot().input!.acceptedItems).toHaveLength(1); await s.model.confirm(); expect(s.model.resultCart()?.items).toHaveLength(2); expect(s.cart.items).toHaveLength(2);
});
it.each(["unchanged", "all-unavailable"])("does not invent changed terms or remove %s rows", async kind => {
 const s = setup(), quote = repriceValidation(s.cart); if (kind === "unchanged") { quote.hasChanges = false; quote.requiresAcceptance = false; } else { quote.items[0]!.current = null; quote.items[0]!.status = "UNAVAILABLE"; quote.requiresAcceptance = false; }
 s.quote.mockResolvedValueOnce(quote); await s.validation.validate(s.page);
 if (kind === "unchanged") expect(s.model.canPrepare(s.page)).toBe(false); else { expect(s.model.prepare(s.page)).toBe(true); expect(s.model.getSnapshot().input).toEqual({ expectedVersion: 3, acceptedItems: [] }); }
 expect(s.send).not.toHaveBeenCalled();
});
it.each([4,7])("accepts returned version%i and subsequent changed/checked-out state without inventing exact+1 or frozen-line postconditions", async version => {
 const s = setup(); await s.prepare(); const result = commandCart(version, "17"); result.status = "CHECKED_OUT"; result.checkout = { id: "00000000-0000-4000-8000-000000000939", status: "COMPLETED" }; result.items = []; s.send.mockResolvedValueOnce(result); await s.model.confirm(); expect(s.model.resultCart()).toEqual(result); expect(s.cart.version).toBe(3); expect(s.cart.items).toHaveLength(1);
});
it.each(["root", "owner", "item", "duplicate", "version", "currency"])("rejects unverified %s reprice response without merging it into source", async field => {
 const s = setup(); await s.prepare(); const result = commandCart(4), privateContent = jest.fn(() => { throw new Error("foreign content must not be read"); });
 if (field === "root") result.id = "00000000-0000-4000-8000-000000000939"; if (field === "owner") result.buyerOrganizationId = "00000000-0000-4000-8000-000000000939";
 if (["root", "owner", "version", "currency"].includes(field)) Object.defineProperty(result, "items", { get: privateContent }); if (field === "item") result.items[0]!.cartId = "00000000-0000-4000-8000-000000000939"; if (field === "duplicate") result.items.push(result.items[0]!); if (field === "version") result.version = 3; if (field === "currency") result.currency = "EUR";
 s.send.mockResolvedValueOnce(result); await s.model.confirm(); expect(privateContent).not.toHaveBeenCalled(); expect(s.model.getSnapshot()).toMatchObject({ phase: "unknown", priorUnknown: true, issue: "invalid-result" }); expect(s.model.resultCart()).toBeNull(); expect(s.cart.version).toBe(3);
});
it("blocks duplicate pending and blind unknown replay; only fresh read/ack/new validation/new preparation can send again", async () => {
 const s = setup(); await s.prepare(); let reject!: (error: unknown) => void; s.send.mockImplementationOnce(() => new Promise((_yes,no) => { reject = no; })); const pending = s.model.confirm(); await s.model.confirm(); expect(s.send).toHaveBeenCalledTimes(1); reject(new Error("SYNTHETIC committed response lost")); await pending;
 const first = s.send.mock.calls[0]![2]; expect(s.model.getSnapshot()).toMatchObject({ phase: "unknown", priorUnknown: true }); await s.model.confirm(); expect(s.send).toHaveBeenCalledTimes(1); expect(s.model.prepare(s.page)).toBe(false);
 const next = { ...savedPage(null,[]), current: commandCart(4) }; s.setNext(next); await s.model.readCurrent(); expect(s.model.getSnapshot().phase).toBe("review"); expect(s.model.canPrepare(next)).toBe(false); expect(s.model.acknowledge()).toBe(true); expect(s.model.canPrepare(next)).toBe(false);
 await s.validation.validate(next); expect(s.model.prepare(next)).toBe(true); expect(s.send).toHaveBeenCalledTimes(1); s.send.mockResolvedValueOnce(repriceResult(next.current!,s.model.getSnapshot().input!)); await s.model.confirm(); expect(s.send).toHaveBeenCalledTimes(2); expect(s.send.mock.calls[1]![2].expectedVersion).toBe(4); expect(first.expectedVersion).toBe(3); expect(s.model.getSnapshot()).toMatchObject({ phase: "result", priorUnknown: true });
});
it.each(["different","none"])("observes a %s current cart after unknown without proving the former write", async kind => {
 const s = setup(); await s.prepare(); s.send.mockRejectedValueOnce(new Error("lost response")); await s.model.confirm(); const next = savedPage(kind === "none" ? null : commandCart(5), []); if (next.current) { next.current.id = "00000000-0000-4000-8000-000000000939"; next.current.items.forEach(item => { item.cartId = next.current!.id; }); }
 s.setNext(next); await s.model.readCurrent(); expect(s.model.acknowledge()).toBe(true); expect(s.model.getSnapshot()).toEqual({ phase:"observed",priorUnknown:true }); expect(s.model.blocksOtherMutations()).toBe(false); expect(s.send).toHaveBeenCalledTimes(1);
});
it.each([[400,"validation","SYNTHETIC"],[401,"authentication","SYNTHETIC"],[403,"denied","SYNTHETIC"],[404,"not-found","SYNTHETIC"],[409,"version","CART_VERSION_CONFLICT"],[409,"revalidation","CART_REVALIDATION_REQUIRED"],[409,"conflict","OTHER_CONFLICT"]] as const)("handles %i/%s as a known HTTP rejection response, with fresh metadata not auto-replacement", async (status,issue,code) => {
 const s = setup(); await s.prepare(); const input = s.model.getSnapshot().input; s.send.mockRejectedValueOnce(cartCommandError(status,code)); await s.model.confirm(); expect(s.model.getSnapshot()).toMatchObject({ phase:"rejected",issue,input }); expect(s.model.getSnapshot().priorUnknown === true).toBe(status === 403 || status === 404); expect(s.model.canRead()).toBe(![401,403].includes(status)); expect(s.send).toHaveBeenCalledTimes(1); expect(s.reload).not.toHaveBeenCalled();
});
it.each(["page","version","line","owner","grant","dispose"])("guards late %s completion before reading response body", async change => {
 const s = setup(); await s.prepare(); let finish!: (body:unknown)=>void; s.send.mockImplementationOnce(()=>new Promise(yes=>{finish=yes;})); const pending=s.model.confirm();
 if(change==="page")s.setPage({...s.page});if(change==="version")s.cart.version++;if(change==="line")s.cart.items[0]!.quantity="4";if(change==="owner")s.cart.buyerOrganizationId="00000000-0000-4000-8000-000000000939";if(change==="grant")s.fixture.authorization={...s.fixture.authorization,permissions:[]};if(change==="dispose")s.model.dispose();
 const content=jest.fn(()=>{throw new Error("must not decode stale response");});finish(Object.defineProperty({},"id",{get:content}));await pending;expect(content).not.toHaveBeenCalled();expect(s.model.resultCart()).toBeNull();expect(s.send).toHaveBeenCalledTimes(1);
});
it("keeps review acknowledgment bound to exact latest page and allows explicit reread after stale/error", async () => {
 const s=setup();await s.prepare();s.send.mockRejectedValueOnce(new Error("timeout"));await s.model.confirm();s.setNext(undefined);await s.model.readCurrent();expect(s.model.getSnapshot().phase).toBe("read-error");
 const next=savedPage(commandCart(4),[]);s.setNext(next);await s.model.readCurrent();s.setPage({...next});expect(s.model.canAcknowledge()).toBe(false);expect(s.model.acknowledge()).toBe(false);s.setNext(savedPage(commandCart(5),[]));await s.model.readCurrent();expect(s.model.acknowledge()).toBe(true);expect(s.send).toHaveBeenCalledTimes(1);
});
it("does not bind a default native reprice operation or derive a port from BUYER reads",()=>{
 const request=jest.fn(async(_path:string):Promise<unknown>=>null),client=bindMarketReads(request,cartCommandScope.organizationId),validation=createCartValidation(cartCommandScope,client.cartCommandFixture,()=>null),model=createCartReprice(cartCommandScope,client.cartCommandFixture,validation,()=>null,async()=>undefined);
 expect(model.isAvailable()).toBe(false);expect(client.cartCommandFixture).toBeUndefined();expect(request).not.toHaveBeenCalled();
});

it("allows the actual500 snapshot boundary without truncating and does not require a PRICE flag for stock-only changes", async () => {
 const s = setup(); s.cart.items = Array.from({ length: 500 }, (_, index) => ({ ...s.cart.items[0]!, id: `00000000-0000-4000-8000-${String(10000 + index).padStart(12, "0")}`, offerId: `00000000-0000-4000-8000-${String(20000 + index).padStart(12, "0")}` }));
 const quote = repriceValidation(s.cart); quote.requiresAcceptance = false; quote.items.forEach(item => { item.changes = ["STOCK"]; item.requiresAcceptance = false; }); s.quote.mockResolvedValueOnce(quote);
 await s.validation.validate(s.page); expect(s.model.prepare(s.page)).toBe(true); expect(s.model.getSnapshot().input!.acceptedItems).toHaveLength(500); expect(s.send).not.toHaveBeenCalled();
});

it.each([403, 404])("does not claim rollback after a %i from the post-commit requireCart read", async status => {
 const s = setup(); await s.prepare(); let committed: CartResponse | null = null;
 s.send.mockImplementationOnce(async (_scope, _id, input) => { committed = repriceResult(s.cart, input); throw cartCommandError(status); });
 await s.model.confirm(); expect(committed).toMatchObject({ version: 4 }); expect(s.model.getSnapshot()).toMatchObject({ phase: "rejected", priorUnknown: true, issue: status === 403 ? "denied" : "not-found" }); expect(s.model.resultCart()).toBeNull(); expect(s.send).toHaveBeenCalledTimes(1); expect(s.cart.version).toBe(3);
});
