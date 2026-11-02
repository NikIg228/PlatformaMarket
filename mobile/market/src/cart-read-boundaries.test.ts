import { createMobileReadSlot, type ReadScope } from "../../../contracts/mobile-read/read-adapter";
import { savedCart, savedCheckout, savedPage, cartId, failedCartId, checkoutId, buyerId } from "./test-fixtures/carts";
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: buyerId, organizationId: buyerId, generation: 1 };
it("accepts existing cart/checkout payloads only with the clicked parent identity", () => {
  const slot = createMobileReadSlot(scope);
  slot.complete(slot.begin({ kind: "cart", cartId }), { status: 200, body: savedCart() }); expect(slot.getState().phase).toBe("ready");
  slot.complete(slot.begin({ kind: "checkout", checkoutId, cartId: failedCartId }), { status: 200, body: savedCheckout() }); expect(slot.getState().phase).toBe("ready");
});
it.each(["root", "cart", "cartBuyer", "item", "orderBuyer", "orderCheckout"] as const)("rejects checkout %s identity mismatch", field => {
  const data = savedCheckout(), foreign = "00000000-0000-4000-8000-000000000099";
  if (field === "root") data.buyerOrganizationId = foreign;
  if (field === "cart") data.cart.id = foreign;
  if (field === "cartBuyer") data.cart.buyerOrganizationId = foreign;
  if (field === "item") data.cart.items[0]!.cartId = foreign;
  if (field === "orderBuyer") data.supplierOrders[0]!.buyerOrganizationId = foreign;
  if (field === "orderCheckout") data.supplierOrders[0]!.checkoutId = foreign;
  const slot = createMobileReadSlot(scope); slot.complete(slot.begin({ kind: "checkout", checkoutId, cartId: failedCartId }), { status: 200, body: data }); expect(slot.getState().phase).toBe("contract-error");
});
it("rejects a foreign cart item inside both page and detail and guards detail version per ID", () => {
  const slot = createMobileReadSlot(scope), bad = savedCart(); bad.items[0]!.cartId = failedCartId;
  slot.complete(slot.begin({ kind: "workspace-carts" }), { status: 200, body: savedPage(bad) }); expect(slot.getState().phase).toBe("contract-error");
  slot.complete(slot.begin({ kind: "cart", cartId }), { status: 200, body: bad }); expect(slot.getState().phase).toBe("contract-error");
  slot.complete(slot.begin({ kind: "cart", cartId }), { status: 200, body: savedCart(cartId, 5) });
  slot.complete(slot.begin({ kind: "cart", cartId }), { status: 200, body: savedCart(cartId, 2) });
  const state = slot.getState(); expect("read" in state && state.read.kind === "cart" && state.read.value.version).toBe(5);
  slot.complete(slot.begin({ kind: "cart", cartId: failedCartId }), { status: 200, body: savedCart(failedCartId, 1) }); expect(slot.getState().phase).toBe("ready");
});
