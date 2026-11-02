import { updateCartItemSchema } from "../../../packages/schemas/src/index";
import { checkQuantityText, createCartQuantityDrafts } from "./cart-quantity-draft";
import { createReadController } from "./read-controller";
import type { MobileReadClient, ReadScope } from "./read-controller";
import { savedCart, savedPage, cartId, buyerId, failedCartId } from "./test-fixtures/carts";
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: buyerId, generation: 1 };
it.each(["1", "2.5", "2,500", "0.000001", "1e-6", "1000000", "0001.0000000"])("checks quantity text %s using the actual numeric/version schema", text => {
  expect(updateCartItemSchema.safeParse({ quantity: Number(text.replace(",", ".")), expectedVersion: 2 }).success).toBe(true);
  expect(checkQuantityText(text, 2)).toBeNull();
});
it.each(["", " ", "0", "-1", "1000001", "0.0000001", "NaN", "Infinity", "1,2,3", "0x10", "1_000"])("rejects invalid/unsupported editor quantity %s without a command payload", text => { expect(checkQuantityText(text, 2)).not.toBeNull(); });
it("gets limits/step from real schema issues and refuses a conversion that changes the decimal value", () => {
  expect(checkQuantityText("1000001", 2)).toEqual({ kind: "maximum", maximum: "1000000" });
  expect(checkQuantityText("0.0000001", 2)).toEqual({ kind: "step", step: "0.000001" });
  expect(updateCartItemSchema.safeParse({ quantity: Number("1.0000000000000000001"), expectedVersion: 2 }).success).toBe(true);
  expect(checkQuantityText("1.0000000000000000001", 2)).toEqual({ kind: "precision" });
  expect(checkQuantityText("2", 0)).toEqual({ kind: "version" });
});
it("keeps original quantities/financial snapshots immutable and isolates multiple item drafts/cancellation", () => {
  const cart = savedCart(); cart.items.push({ ...cart.items[0]!, id: "00000000-0000-4000-8000-000000000042" }); const before = JSON.stringify(cart);
  const store = createCartQuantityDrafts(scope); store.syncCurrent(cart); const a = cart.items[0]!, b = cart.items[1]!;
  expect(store.begin(cart, a)).toBe(true); expect(store.getLine(cart, a)?.text).toBe(a.quantity);
  store.change(cart, a, "2,5"); expect(store.check(cart, a)).toBe(true);
  store.begin(cart, b); store.change(cart, b, ""); expect(store.check(cart, b)).toBe(false);
  store.cancel(cart, a); expect(store.getLine(cart, a)).toBeNull(); expect(store.getLine(cart, b)?.text).toBe("");
  store.cancelAll(); expect(Object.keys(store.getSnapshot().entries)).toHaveLength(0); expect(JSON.stringify(cart)).toBe(before);
});
it("preserves drafts on a same-source refresh but drops all on version change and rejects old callbacks", () => {
  const cart = savedCart(), line = cart.items[0]!, store = createCartQuantityDrafts(scope); store.syncCurrent(cart); store.begin(cart, line); store.change(cart, line, "2.5");
  const refreshed = savedCart(); store.syncCurrent(refreshed); expect(store.getLine(refreshed, refreshed.items[0]!)?.text).toBe("2.5");
  const newer = savedCart(cartId, 2); store.syncCurrent(newer); expect(store.getSnapshot().discarded).toBe(true); expect(store.getLine(newer, newer.items[0]!)).toBeNull();
  store.begin(newer, newer.items[0]!); store.change(cart, line, "999"); store.cancel(cart, line);
  expect(store.getLine(newer, newer.items[0]!)?.text).toBe(newer.items[0]!.quantity);
});
it("drops only changed/removed item baselines even if a server projection incorrectly retains its version", () => {
  const cart = savedCart(); cart.items.push({ ...cart.items[0]!, id: failedCartId }); const store = createCartQuantityDrafts(scope); store.syncCurrent(cart);
  for (const item of cart.items) { store.begin(cart, item); store.change(cart, item, "3"); }
  const changed = structuredClone(cart); changed.items[0]!.quantity = "9"; store.syncCurrent(changed);
  expect(store.getLine(changed, changed.items[0]!)).toBeNull(); expect(store.getLine(changed, changed.items[1]!)?.text).toBe("3");
  changed.items = [changed.items[0]!]; store.syncCurrent(changed); expect(Object.keys(store.getSnapshot().entries)).toHaveLength(0);
});
it.each(["cart", "buyer", "status", "checkout", "version", "missing"] as const)("discards or disables draft when current %s context is replaced", variant => {
  const cart = savedCart(), store = createCartQuantityDrafts(scope); store.syncCurrent(cart); store.begin(cart, cart.items[0]!); store.change(cart, cart.items[0]!, "4");
  const next = savedCart();
  if (variant === "cart") { next.id = failedCartId; next.items[0]!.cartId = failedCartId; }
  if (variant === "buyer") next.buyerOrganizationId = failedCartId;
  if (variant === "status") next.status = "FUTURE_STATE";
  if (variant === "checkout") next.checkout = { id: failedCartId, status: "PROCESSING" };
  if (variant === "version") next.version = 0;
  store.syncCurrent(variant === "missing" ? null : next); expect(Object.keys(store.getSnapshot().entries)).toHaveLength(0); expect(store.getLine(cart, cart.items[0]!)).toBeNull();
});
it("never lets a closed controller's retained handlers populate another session's draft store", async () => {
  const cart = savedCart(); const api = { workspaceCarts: async () => savedPage(cart, []) } as Pick<MobileReadClient, "workspaceCarts">;
  // Unused ports are present but deliberately cannot be used by this local model.
  const client: MobileReadClient = { ...api, searchCatalog: async () => { throw new Error("unused"); }, compareOffers: async () => { throw new Error("unused"); }, workspaceOrders: async () => { throw new Error("unused"); }, getOrderWorkflow: async () => { throw new Error("unused"); } };
  const old = createReadController({ scope, client }); await old.load({ kind: "workspace-carts", input: { limit: 1 } }); old.quantityDrafts.begin(cart, cart.items[0]!); old.quantityDrafts.change(cart, cart.items[0]!, "5"); old.dispose();
  const next = createReadController({ scope: { ...scope, userId: failedCartId, generation: 2 }, client }); await next.load({ kind: "workspace-carts", input: { limit: 1 } });
  old.quantityDrafts.change(cart, cart.items[0]!, "99"); expect(old.quantityDrafts.getSnapshot().source).toBeNull(); expect(Object.keys(next.quantityDrafts.getSnapshot().entries)).toHaveLength(0);
});
