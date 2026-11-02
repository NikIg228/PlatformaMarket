import { createCartSchema } from "../../../packages/schemas/src/index";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { createCartWorkspaceCommands } from "./cart-workspace-command-fixture";
import { createCartQuantityCommands, type CartCommandFixture, type CartCreateInput } from "./cart-command-fixture";
import { createCartQuantityDrafts } from "./cart-quantity-draft";
import { cartCommandAuthorization, cartCommandError, cartCommandScope, createdCartResult } from "./test-fixtures/cart-commands";
import { savedPage } from "./test-fixtures/carts";
import { supportId } from "./test-fixtures/support";

function setup() {
  let page: WorkspaceCartPage | null = savedPage(null, []), next: WorkspaceCartPage | undefined = page, otherLocked = false;
  const original = page;
  const create = jest.fn(async (_scope: typeof cartCommandScope, _buyer: string, _input: CartCreateInput): Promise<unknown> => createdCartResult());
  const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), createCart: create };
  const read = jest.fn(async () => { if (next) page = next; return next; });
  const model = createCartWorkspaceCommands(cartCommandScope, fixture, () => page, read, () => otherLocked);
  return { model, original, fixture, create, read, current: () => page, setPage: (value: WorkspaceCartPage | null) => { page = value; }, setNext: (value: WorkspaceCartPage | undefined) => { next = value; }, lockOther: (value: boolean) => { otherLocked = value; } };
}

it("uses exact source-default KZT with no version/key and accepts an existing cart with items and a different creator", async () => {
  const s = setup(); await s.model.start(s.original);
  expect(s.create.mock.calls[0]).toEqual([cartCommandScope, cartCommandScope.organizationId, createCartSchema.parse({})]);
  const input = s.create.mock.calls[0]![2]; expect(Object.keys(input)).toEqual(["currency"]); expect(Object.isFrozen(input)).toBe(true);
  expect(s.model.getSnapshot()).toMatchObject({ phase: "result", result: { version: 7, currency: "KZT", createdById: supportId(98), items: [{ quantity: "3.000001", unitPriceMinor: "90071992547409931234" }] } });
  expect(s.original.current).toBeNull(); expect(s.model.resultCart()).toBe(s.model.getSnapshot().result);
});

it("does not assume that an existing ACTIVE cart has no checkout or is new/empty", async () => {
  const s = setup(), response = createdCartResult(); response.checkout = { id: supportId(75), status: "PENDING" };
  s.create.mockResolvedValueOnce(response); await s.model.start(s.original);
  expect(s.model.getSnapshot()).toMatchObject({ phase: "result", result: { checkout: { id: supportId(75) }, items: [{ quantity: "3.000001" }] } });
});

it("preserves an explicitly selected offer currency across unknown read/review/new submission instead of falling back to KZT", async () => {
  const s = setup(); s.create.mockRejectedValueOnce(new Error("SYNTHETIC USD response lost")); await s.model.start(s.original, "USD");
  expect(s.create.mock.calls[0]![2]).toEqual({ currency: "USD" });
  s.setNext(savedPage(null, [])); await s.model.readCurrent(); s.model.prepareNew(); expect(s.model.getSnapshot().input).toEqual({ currency: "USD" });
  const result = createdCartResult(); result.currency = "USD"; result.items.forEach(item => { item.currency = "USD"; }); s.create.mockResolvedValueOnce(result);
  await s.model.submitPrepared(); expect(s.create.mock.calls[1]![2]).toEqual({ currency: "USD" }); expect(s.model.getSnapshot()).toMatchObject({ phase: "result", priorUnknown: true, result: { currency: "USD" } });
});

it.each(["usd", "USDx", "EU"])("does not send a currency outside the actual create schema: %s", async currency => {
  const s = setup(); await s.model.start(s.original, currency); expect(s.create).not.toHaveBeenCalled(); expect(s.model.getSnapshot().phase).toBe("idle");
});

it.each(["absent", "permission", "organizationId", "userId", "environment", "generation", "product"])("does not create without the exact synthetic source context: %s", async field => {
  const s = setup();
  if (field === "absent") delete s.fixture.createCart;
  else if (field === "permission") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
  else s.fixture.authorization = { ...s.fixture.authorization, scope: { ...cartCommandScope, [field]: field === "generation" ? 99 : field === "environment" ? "other" : supportId(99) } };
  await s.model.start(s.original); expect(s.create).not.toHaveBeenCalled(); expect(s.model.getSnapshot().phase).toBe("idle");
});

it.each(["retained-page", "current-cart", "foreign-page", "other-mutation"] as const)("refuses a new create request for %s", async field => {
  const s = setup();
  if (field === "retained-page") s.setPage(savedPage(null, []));
  if (field === "current-cart") s.original.current = createdCartResult();
  if (field === "foreign-page") { const cart = createdCartResult(); cart.buyerOrganizationId = supportId(99); s.original.items = [cart]; }
  if (field === "other-mutation") s.lockOther(true);
  await s.model.start(s.original); expect(s.create).not.toHaveBeenCalled();
});

it("blocks duplicate/new starts while pending and locks item quantity/removal until fresh read acknowledgement", async () => {
  const s = setup(); let finish!: (value: unknown) => void; s.create.mockImplementationOnce(() => new Promise(done => { finish = done; }));
  const pending = s.model.start(s.original); await s.model.start(s.original); expect(s.create).toHaveBeenCalledTimes(1);
  const cart = createdCartResult(), item = cart.items[0]!, drafts = createCartQuantityDrafts(cartCommandScope); drafts.syncCurrent(cart); drafts.begin(cart, item);
  const update = jest.fn(async (): Promise<unknown> => cart), remove = jest.fn(async (): Promise<unknown> => cart);
  const quantity = createCartQuantityCommands(cartCommandScope, { authorization: cartCommandAuthorization(), updateCartItem: update, removeCartItem: remove }, drafts, () => cart, async () => cart, () => s.model.blocksOtherMutations());
  await quantity.submit(cart, item); quantity.beginRemove(cart, item); await quantity.confirmRemove(cart.id, item.id);
  expect(update).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
  finish(cart); await pending; expect(s.model.blocksOtherMutations()).toBe(true);
  s.setNext(savedPage(cart, [])); await s.model.readCurrent(); expect(s.model.acknowledge()).toBe(true); expect(s.model.blocksOtherMutations()).toBe(false);
  expect(quantity.canSubmit(cart, item)).toBe(true);
});

it.each([400, 401, 403, 404, 409] as const)("treats source rejection%s as no result and never resends without a separate read and new attempt", async status => {
  const s = setup(); s.create.mockRejectedValueOnce(cartCommandError(status)); await s.model.start(s.original);
  expect(s.model.getSnapshot().phase).toBe("rejected"); await s.model.start(s.original); await s.model.submitPrepared(); expect(s.create).toHaveBeenCalledTimes(1);
});

it("requires explicit fresh read/preparation/new submission after409 and retains the immutable original input", async () => {
  const s = setup(); s.create.mockRejectedValueOnce(cartCommandError(409)); await s.model.start(s.original); const old = s.create.mock.calls[0]![2];
  s.setNext(savedPage(null, [])); await s.model.readCurrent(); expect(s.model.getSnapshot().phase).toBe("review");
  s.model.prepareNew(); expect(s.model.getSnapshot().phase).toBe("prepared"); expect(s.create).toHaveBeenCalledTimes(1);
  s.model.returnToReview(); expect(s.model.getSnapshot().phase).toBe("review"); s.model.prepareNew(); await s.model.submitPrepared();
  expect(s.create).toHaveBeenCalledTimes(2); expect(s.create.mock.calls[1]![2]).toEqual(old); expect(s.create.mock.calls[1]![2]).not.toBe(old);
});

it.each(["timeout", "5xx", "malformed-error", "wrong-owner", "wrong-currency", "wrong-status", "wrong-line"] as const)("keeps %s unknown and offers no blind replay", async field => {
  const s = setup();
  if (field === "timeout") s.create.mockRejectedValueOnce(new Error("SYNTHETIC private timeout"));
  else if (field === "5xx") s.create.mockRejectedValueOnce(cartCommandError(503));
  else if (field === "malformed-error") s.create.mockRejectedValueOnce({ status: 403, payload: { statusCode: 500 } });
  else { const cart = createdCartResult(); if (field === "wrong-owner") cart.buyerOrganizationId = supportId(99); if (field === "wrong-currency") cart.currency = "USD"; if (field === "wrong-status") cart.status = "CHECKED_OUT"; if (field === "wrong-line") cart.items[0]!.cartId = supportId(99); s.create.mockResolvedValueOnce(cart); }
  await s.model.start(s.original); expect(s.model.getSnapshot()).toMatchObject({ phase: "unknown", priorUnknown: true });
  await s.model.start(s.original); await s.model.submitPrepared(); expect(s.create).toHaveBeenCalledTimes(1); expect(s.model.resultCart()).toBeNull();
});

it("does not prove lost creation from a later current cart or allow a new create while that cart exists", async () => {
  const s = setup(); s.create.mockRejectedValueOnce(new Error("SYNTHETIC committed but reply lost")); await s.model.start(s.original);
  s.setNext(savedPage(createdCartResult(), [])); await s.model.readCurrent(); expect(s.model.getSnapshot()).toMatchObject({ phase: "review", priorUnknown: true });
  expect(s.model.getSnapshot().result).toBeUndefined(); expect(s.model.canPrepare()).toBe(false); s.model.prepareNew(); expect(s.create).toHaveBeenCalledTimes(1);
  s.model.acknowledge(); expect(s.model.getSnapshot()).toEqual({ phase: "observed", priorUnknown: true }); expect(s.model.canStart(s.current()!)).toBe(false);
});

it("retains prior unknown after an explicitly reviewed new no-current attempt succeeds", async () => {
  const s = setup(); s.create.mockRejectedValueOnce(new Error("SYNTHETIC lost reply")); await s.model.start(s.original);
  s.setNext(savedPage(null, [])); await s.model.readCurrent(); s.model.prepareNew(); await s.model.submitPrepared();
  expect(s.create).toHaveBeenCalledTimes(2); expect(s.model.getSnapshot()).toMatchObject({ phase: "result", priorUnknown: true });
});

it.each(["retained-page", "current-cart", "other-mutation"] as const)("does not send a prepared new attempt after %s changes", async field => {
  const s = setup(); s.create.mockRejectedValueOnce(cartCommandError(409)); await s.model.start(s.original); s.setNext(savedPage(null, [])); await s.model.readCurrent(); s.model.prepareNew();
  if (field === "retained-page") s.setPage(savedPage(null, [])); if (field === "current-cart") s.current()!.current = createdCartResult(); if (field === "other-mutation") s.lockOther(true);
  await s.model.submitPrepared(); expect(s.create).toHaveBeenCalledTimes(1);
});

it.each(["dispose", "deny", "page", "grant", "current-cart"] as const)("drops the late response before decoding after %s changes", async field => {
  const s = setup(); let finish!: (value: unknown) => void; s.create.mockImplementationOnce(() => new Promise(done => { finish = done; })); const pending = s.model.start(s.original);
  if (field === "dispose") s.model.dispose(); if (field === "deny") s.model.denyAll(); if (field === "page") s.setPage(savedPage(null, [])); if (field === "grant") s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; if (field === "current-cart") s.original.current = createdCartResult();
  const decoded = jest.fn(() => { throw new Error("Late root decoded"); }), response = {}; Object.defineProperty(response, "id", { get: decoded }); finish(response); await pending;
  expect(decoded).not.toHaveBeenCalled(); expect(s.model.getSnapshot().phase).not.toBe("result");
});

it("checks result ownership before accessing private item content", async () => {
  const s = setup(), response = { id: supportId(71), buyerOrganizationId: supportId(99) };
  const decoded = jest.fn(() => { throw new Error("Foreign items decoded"); }); Object.defineProperty(response, "items", { get: decoded }); s.create.mockResolvedValueOnce(response);
  await s.model.start(s.original); expect(decoded).not.toHaveBeenCalled(); expect(s.model.getSnapshot().phase).toBe("unknown");
});

it("retains an unknown operation through recoverable read failure and rejects a foreign/current-stale read", async () => {
  const s = setup(); s.create.mockRejectedValueOnce(new Error("SYNTHETIC offline")); await s.model.start(s.original); s.setNext(undefined); await s.model.readCurrent();
  expect(s.model.getSnapshot()).toMatchObject({ phase: "read-error", priorUnknown: true });
  const cart = createdCartResult(); cart.buyerOrganizationId = supportId(99); s.setNext(savedPage(cart, [])); await s.model.readCurrent(); expect(s.model.getSnapshot().phase).toBe("read-error"); expect(s.model.canPrepare()).toBe(false);
});

it("invalidates late refresh, clears memory on dispose and supports the existing strict-mode activation lifecycle", async () => {
  const s = setup(); s.create.mockRejectedValueOnce(new Error("SYNTHETIC offline")); await s.model.start(s.original);
  let finish!: (value: WorkspaceCartPage | undefined) => void; s.read.mockImplementationOnce(() => new Promise(done => { finish = done; })); const pending = s.model.readCurrent(); s.model.dispose(); finish(savedPage(null, [])); await pending;
  expect(s.model.getSnapshot()).toEqual({ phase: "idle" }); expect(s.model.isAvailable()).toBe(false); s.model.activate(); expect(s.model.canStart(s.original)).toBe(true);
});

it("can reread a stale review after leaving and returning instead of locking workspace mutations forever", async () => {
  const s = setup(); s.create.mockRejectedValueOnce(new Error("SYNTHETIC lost reply")); await s.model.start(s.original);
  s.setNext(savedPage(null, [])); await s.model.readCurrent(); s.setPage(savedPage(null, []));
  expect(s.model.canPrepare()).toBe(false); expect(s.model.canRead()).toBe(true);
  s.setNext(savedPage(null, [])); await s.model.readCurrent(); expect(s.model.canPrepare()).toBe(true); expect(s.model.acknowledge()).toBe(true);
});
