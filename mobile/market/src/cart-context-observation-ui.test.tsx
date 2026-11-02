import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import type { MobileReadClient } from "./read-controller";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { CartCommandFixture, CartQuantityInput } from "./cart-command-fixture";
import { cartCommandCopy } from "./CartCommandUi";
import { cartWorkspaceCommandCopy } from "./CartWorkspaceCommandUi";
import { cartCommandScope, cartCommandAuthorization, commandCart, quantityCartResult } from "./test-fixtures/cart-commands";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { savedPage } from "./test-fixtures/carts";
import { copy } from "./i18n";

function setup(initialUnknown = true) {
  const original = commandCart(); let current: CartResponse | null = original;
  const update = jest.fn(async (_scope: typeof cartCommandScope, cartId: string, itemId: string, input: CartQuantityInput): Promise<unknown> => {
    const cart = quantityCartResult(input); cart.id = cartId; cart.items[0]!.cartId = cartId; cart.items[0]!.id = itemId; current = cart; return cart;
  });
  if (initialUnknown) update.mockRejectedValueOnce(new Error("SYNTHETIC old-cart response lost"));
  const create = jest.fn(async (): Promise<unknown> => commandCart());
  const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), updateCartItem: update, createCart: create };
  const read = jest.fn(async (_input: unknown) => savedPage(current, []));
  const originalRead = jest.fn(async (_cartId: string): Promise<unknown> => original);
  const client: MobileReadClient = { searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => listDraftPayload("comparison-exact-offer"), workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"), workspaceCarts: read, workspaceCart: originalRead, cartCommandFixture: fixture };
  return { original, update, create, fixture, client, read, originalRead, setCurrent: (cart: CartResponse | null) => { current = cart; } };
}
const session = (client: MobileReadClient) => ({ client, scope: cartCommandScope, organizationName: "SYNTHETIC" });
async function editor(s: ReturnType<typeof setup>, locale: "ru" | "kk" = "ru") {
  const t = copy[locale]; const view = await render(<App session={session(s.client)} locale={locale} />);
  await fireEvent.press(screen.getByRole("tab", { name: t.cart })); await screen.findByRole("button", { name: `${t.draftOpen}: ${t.cartItem} 1` });
  await fireEvent.press(screen.getByRole("button", { name: `${t.draftOpen}: ${t.cartItem} 1` })); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), " 3,5 ");
  return view;
}

async function unknown(s: ReturnType<typeof setup>, locale: "ru" | "kk" = "ru") {
 const view = await editor(s, locale); await fireEvent.press(screen.getByRole("button", { name: cartCommandCopy[locale].save })); await screen.findByText(cartCommandCopy[locale].unknownBody); return view;
}
function nextCart() { const cart = commandCart(7); cart.id = "00000000-0000-4000-8000-000000000900"; cart.items[0]!.cartId = cart.id; cart.items[0]!.id = "00000000-0000-4000-8000-000000000901"; return cart; }

it.each((["ru", "kk"] as const).flatMap(locale => (["none", "different"] as const).map(kind => ({ locale, kind }))))("continues only after explicit observation: $locale/$kind", async ({ locale, kind }) => {
  const s = setup(); await unknown(s, locale); const t = copy[locale], c = cartCommandCopy[locale], current = nextCart();
  s.setCurrent(kind === "none" ? null : current); await fireEvent.press(screen.getByRole("button", { name: t.refresh }));
  await fireEvent.press(screen.getByRole("button", { name: c.observeCurrent }));
  await screen.findByText(kind === "none" ? t.noCurrentCart : t.currentCart);
  expect(screen.getByText(c.retainedUnknown)).toBeOnTheScreen(); expect(s.update).toHaveBeenCalledTimes(1); expect(s.create).not.toHaveBeenCalled();
  if (kind === "none") expect(screen.getByRole("button", { name: cartWorkspaceCommandCopy[locale].start })).toBeEnabled();
  else {
   await fireEvent.press(screen.getByRole("button", { name: `${t.draftOpen}: ${t.cartItem} 1` })); await screen.findByLabelText(t.draftQuantity);
   await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), "4"); await fireEvent.press(screen.getByRole("button", { name: c.save })); await screen.findByText(c.received);
   expect(s.update).toHaveBeenCalledTimes(2); expect(s.update.mock.calls[1]!.slice(1)).toEqual([current.id, current.items[0]!.id, { expectedVersion: 7, quantity: 4 }]);
   expect(s.update.mock.calls[0]![3]).toEqual({ expectedVersion: 1, quantity: 3.5 });
  }
});
it.each(["ru", "kk"] as const)("inspects the original cart by explicit independent GET and retains unknown after observing no current: %s", async locale => {
 const s = setup(); await unknown(s, locale); const t = copy[locale], c = cartCommandCopy[locale]; s.setCurrent(null); await fireEvent.press(screen.getByRole("button", { name: t.refresh }));
 expect(s.originalRead).not.toHaveBeenCalled(); await fireEvent.press(screen.getByRole("button", { name: c.inspectOriginal })); await screen.findByText(c.independent);
 expect(screen.getByText(c.independentBody)).toBeOnTheScreen(); expect(screen.getByText(c.retainedUnknown)).toBeOnTheScreen(); expect(s.originalRead).toHaveBeenCalledWith(s.original.id); expect(s.update).toHaveBeenCalledTimes(1);
 await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByRole("button", { name: c.observeCurrent }); await fireEvent.press(screen.getByRole("button", { name: c.observeCurrent }));
 await screen.findByText(t.noCurrentCart); expect(screen.getByText(c.retainedUnknown)).toBeOnTheScreen();
 await fireEvent.press(screen.getByRole("button", { name: `${c.inspectOriginal}: ${s.original.id}` })); await screen.findByText(c.independent); expect(s.originalRead).toHaveBeenCalledTimes(2); expect(s.update).toHaveBeenCalledTimes(1);
});
it("exposes the old attempt after returning to root, even when its item and cart are no longer current", async () => {
 const s = setup(); await unknown(s); await fireEvent.press(screen.getByRole("button", { name: copy.ru.draftBack })); await screen.findByText(copy.ru.currentCart);
 s.setCurrent(nextCart()); await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); expect(screen.getByText(cartCommandCopy.ru.retainedUnknown)).toBeOnTheScreen();
 await fireEvent.press(screen.getByRole("button", { name: `${cartCommandCopy.ru.resumeAttempt}: ${s.original.id}` })); await screen.findByText(copy.ru.draftSourceChanged);
 expect(screen.getByRole("button", { name: cartCommandCopy.ru.observeCurrent })).toBeOnTheScreen(); await fireEvent.press(screen.getByRole("button", { name: cartCommandCopy.ru.observeCurrent })); await screen.findByText(copy.ru.currentCart);
 expect(s.update).toHaveBeenCalledTimes(1); expect(s.originalRead).not.toHaveBeenCalled();
});
it("can resume and cancel an unsent removal from root after current cart changes, without granting old-cart inspection", async () => {
 const s = setup(); s.fixture.removeCartItem = jest.fn(); await editor(s); const c = cartCommandCopy.ru, t = copy.ru;
 await fireEvent.press(screen.getByRole("button", { name: c.removeStart })); await fireEvent.press(screen.getByRole("button", { name: t.draftBack })); s.setCurrent(nextCart()); await fireEvent.press(screen.getByRole("button", { name: t.refresh }));
 expect(screen.queryByRole("button", { name: `${c.inspectOriginal}: ${s.original.id}` })).toBeNull();
 await fireEvent.press(screen.getByRole("button", { name: `${c.resumeAttempt}: ${s.original.id}` })); expect(screen.getByRole("button", { name: c.removeConfirm })).toBeDisabled();
 await fireEvent.press(screen.getByRole("button", { name: c.removeCancel })); await fireEvent.press(screen.getByRole("button", { name: t.draftBack })); await screen.findByText(t.currentCart);
 await fireEvent.press(screen.getByRole("button", { name: `${t.draftOpen}: ${t.cartItem} 1` })); expect(screen.getByRole("button", { name: c.save })).toBeOnTheScreen();
 expect(s.fixture.removeCartItem).not.toHaveBeenCalled(); expect(s.update).not.toHaveBeenCalled(); expect(s.originalRead).not.toHaveBeenCalled();
});
it.each(["id", "owner"])("rejects an original-cart GET with wrong %s and hides its content without sending anything", async mismatch => {
 const s = setup(); await unknown(s); const privateCart = commandCart(); if (mismatch === "id") privateCart.id = nextCart().id; else privateCart.buyerOrganizationId = nextCart().id;
 privateCart.items[0]!.quantity = "654321"; s.originalRead.mockResolvedValueOnce(privateCart); await fireEvent.press(screen.getByRole("button", { name: cartCommandCopy.ru.inspectOriginal })); await screen.findByText(copy.ru.contract);
 expect(screen.queryByText("654321", { exact: false })).toBeNull(); expect(screen.queryByText(cartCommandCopy.ru.independent)).toBeNull(); expect(s.update).toHaveBeenCalledTimes(1); expect(s.create).not.toHaveBeenCalled();
});
it("does not offer observation or a new-cart write while the old mutation is pending; a late untrusted body is ignored after navigation", async () => {
 const s = setup(false); let resolve!: (body: unknown) => void; s.update.mockImplementationOnce(() => new Promise(yes => { resolve = yes; })); await editor(s); const c = cartCommandCopy.ru, t = copy.ru;
 await fireEvent.press(screen.getByRole("button", { name: c.save })); s.setCurrent(null); await fireEvent.press(screen.getByRole("button", { name: t.refresh }));
 expect(screen.queryByRole("button", { name: c.observeCurrent })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: c.inspectOriginal })); await screen.findByText(c.independent);
 const poison = Object.defineProperty({}, "id", { get: () => { throw new Error("must not decode old body"); } }); await act(async () => { resolve(poison); });
 await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByRole("button", { name: c.observeCurrent }); await fireEvent.press(screen.getByRole("button", { name: c.observeCurrent })); await screen.findByText(t.noCurrentCart);
 expect(screen.getByText(c.retainedUnknown)).toBeOnTheScreen(); expect(s.update).toHaveBeenCalledTimes(1);
});
