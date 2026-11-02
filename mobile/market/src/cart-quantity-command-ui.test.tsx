import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import type { MobileReadClient } from "./read-controller";
import type { CartCommandFixture, CartQuantityInput } from "./cart-command-fixture";
import { cartCommandCopy } from "./CartCommandUi";
import { cartCommandScope, cartCommandAuthorization, commandCart, quantityCartResult, cartCommandError } from "./test-fixtures/cart-commands";
import { savedPage } from "./test-fixtures/carts";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { copy } from "./i18n";
import { formatMinor } from "./format-wire";
function setup() {
 let current = commandCart(); const update = jest.fn(async (_scope: typeof cartCommandScope, _cart: string, _item: string, input: CartQuantityInput): Promise<unknown> => { current = quantityCartResult(input); return current; });
 const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), updateCartItem: update };
 const read = jest.fn(async () => savedPage(current, []));
 const client: MobileReadClient = { searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => listDraftPayload("comparison-exact-offer"), workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"), workspaceCarts: read, workspaceCart: async () => current, cartCommandFixture: fixture };
 return { client, fixture, update, read, setCurrent: (cart: typeof current) => { current = cart; } };
}
const session = (client: MobileReadClient, scope = cartCommandScope) => ({ client, scope, organizationName: "SYNTHETIC" });
async function open(client: MobileReadClient, locale: "ru" | "kk" = "ru") {
 const view = await render(<StrictMode><App session={session(client)} locale={locale} /></StrictMode>), t = copy[locale];
 await fireEvent.press(screen.getByRole("tab", { name: t.cart })); await screen.findByRole("button", { name: `${t.draftOpen}: ${t.cartItem} 1` }); await fireEvent.press(screen.getByRole("button", { name: `${t.draftOpen}: ${t.cartItem} 1` })); await screen.findByLabelText(t.draftQuantity); return view;
}
it.each(["absent", "permission"])("keeps quantity mutation unavailable without explicit injected order.create context: %s", async kind => {
 const s = setup(); if (kind === "absent") delete s.client.cartCommandFixture; else s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
 await open(s.client); expect(screen.queryByRole("button", { name: cartCommandCopy.ru.save })).toBeNull(); expect(s.update).not.toHaveBeenCalled();
});
it.each(["ru", "kk"] as const)("submits only on explicit action and shows exact server response totals in %s", async locale => {
 const s = setup(), t = copy[locale], c = cartCommandCopy[locale]; await open(s.client, locale); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), " 3,5 "); await fireEvent(screen.getByLabelText(t.draftQuantity), "submitEditing"); expect(s.update).not.toHaveBeenCalled(); await fireEvent.press(screen.getByRole("button", { name: c.save })); await screen.findByText(c.received);
 expect(s.update).toHaveBeenCalledTimes(1); expect(s.update.mock.calls[0]![3]).toEqual({ expectedVersion: 1, quantity: 3.5 }); expect(screen.getByText(`${c.total}: ${formatMinor("90071992547409939999", commandCart().currency, locale)}`)).toBeOnTheScreen(); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", " 3,5 "); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("editable", false);
 await fireEvent.press(screen.getByRole("button", { name: c.read })); await screen.findByText(c.review); expect(s.update).toHaveBeenCalledTimes(1); await fireEvent.press(screen.getByRole("button", { name: c.closeRead })); await screen.findByText(`${t.quantity}: 3.5`); expect(s.read).toHaveBeenCalledTimes(2);
});
it("accepts a same-version no-op response without fabricating a new version", async () => {
 const s = setup(), c = cartCommandCopy.ru; s.update.mockResolvedValueOnce(commandCart(1, "2.000000")); await open(s.client); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), "2,0"); await fireEvent.press(screen.getByRole("button", { name: c.save })); await screen.findByText(c.noOp); expect(screen.getByText(`${c.version}: 1`)).toBeOnTheScreen();
});
it("preserves input after 409 and requires fresh read then explicit recheck before using a new version", async () => {
 const s = setup(), c = cartCommandCopy.ru; s.update.mockRejectedValueOnce(cartCommandError(409)); await open(s.client); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), " 3,5 "); await fireEvent.press(screen.getByRole("button", { name: c.save })); await screen.findByText(c.conflict); expect(screen.queryByRole("button", { name: c.save })).toBeNull(); expect(s.read).toHaveBeenCalledTimes(1);
 s.setCurrent(commandCart(2, "4")); await fireEvent.press(screen.getByRole("button", { name: c.read })); await screen.findByText(c.review); expect(screen.getByText(`${c.expected}: 1`)).toBeOnTheScreen(); expect(s.update).toHaveBeenCalledTimes(1);
 await fireEvent.press(screen.getByRole("button", { name: c.checkNew })); await screen.findByLabelText(copy.ru.draftQuantity); expect(screen.getByLabelText(copy.ru.draftQuantity)).toHaveProp("value", " 3,5 "); expect(screen.getByText(`${c.expected}: 2`)).toBeOnTheScreen(); expect(s.update).toHaveBeenCalledTimes(1);
 await fireEvent.press(screen.getByRole("button", { name: c.save })); await screen.findByText(c.received); expect(s.update).toHaveBeenCalledTimes(2); expect(s.update.mock.calls[1]![3]).toEqual({ expectedVersion: 2, quantity: 3.5 });
});
it("keeps unknown outcome and matching read as unconfirmed facts, including after locale switch", async () => {
 const s = setup(), c = cartCommandCopy.ru; s.update.mockRejectedValueOnce(new Error("SYNTHETIC timeout")); const view = await open(s.client); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), " 3,5 "); await fireEvent.press(screen.getByRole("button", { name: c.save })); await screen.findByText(c.unknown); expect(screen.queryByRole("button", { name: c.save })).toBeNull(); s.setCurrent(commandCart(2, "3.500000")); await fireEvent.press(screen.getByRole("button", { name: c.read })); await screen.findByText(c.review);
 await view.rerender(<StrictMode><App session={session(s.client)} locale="kk" /></StrictMode>); const k = cartCommandCopy.kk; expect(screen.getByText(k.reviewBody)).toBeOnTheScreen(); expect(screen.queryByText(k.received)).toBeNull(); expect(s.update).toHaveBeenCalledTimes(1); await fireEvent.press(screen.getByRole("button", { name: k.closeRead })); await screen.findByText(`${copy.kk.quantity}: 3.500000`);
});
it("retains raw draft and selection after a definitive error without displaying server error text", async () => {
 const s = setup(), c = cartCommandCopy.ru; s.update.mockRejectedValueOnce(cartCommandError(400)); await open(s.client); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), " 3,5 "); await fireEvent(screen.getByLabelText(copy.ru.draftQuantity), "selectionChange", { nativeEvent: { selection: { start: 1, end: 3 } } }); await fireEvent.press(screen.getByRole("button", { name: c.save })); await screen.findByText(c.rejected);
 expect(screen.getByLabelText(copy.ru.draftQuantity)).toHaveProp("value", " 3,5 "); expect(screen.getByLabelText(copy.ru.draftQuantity)).toHaveProp("selection", { start: 1, end: 3 }); expect(screen.queryByText("SYNTHETIC private cart error")).toBeNull(); expect(screen.getByLabelText(copy.ru.draftQuantity)).toHaveProp("editable", true);
});
it.each(["organizationId", "generation", "client"])("does not apply a late result after %s changes", async field => {
 const s = setup(); let finish!: (body: unknown) => void; s.update.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const view = await open(s.client); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), "3.5"); await fireEvent.press(screen.getByRole("button", { name: cartCommandCopy.ru.save }));
 const scope = { ...cartCommandScope, ...(field === "generation" ? { generation: 2 } : field === "organizationId" ? { organizationId: "00000000-0000-4000-8000-000000000099" } : {}) }, client = field === "client" ? { ...s.client } : s.client;
 await view.rerender(<StrictMode><App session={session(client, scope)} /></StrictMode>); await screen.findByText(copy.ru.emptyCatalog); const hidden = jest.fn(() => { throw new Error("Old cart result decoded"); }), value = {}; Object.defineProperty(value, "id", { get: hidden }); await act(async () => finish(value)); expect(hidden).not.toHaveBeenCalled(); expect(screen.queryByText(cartCommandCopy.ru.received)).toBeNull();
});

it("keeps an edited unsent quantity/caret through reread and new review without changing or resending the original request", async () => {
 const s = setup(), c = cartCommandCopy.ru; s.update.mockRejectedValueOnce(new Error("SYNTHETIC response lost")); await open(s.client);
 await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), " 3,5 "); await fireEvent.press(screen.getByRole("button", { name: c.save })); await screen.findByText(c.unknownBody);
 s.setCurrent(commandCart(2, "4")); await fireEvent.press(screen.getByRole("button", { name: c.read })); await screen.findByText(c.reviewBody); await fireEvent.press(screen.getByRole("button", { name: c.checkNew })); await screen.findByLabelText(copy.ru.draftQuantity);
 await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), " 5,5 "); await fireEvent(screen.getByLabelText(copy.ru.draftQuantity), "selectionChange", { nativeEvent: { selection: { start: 1, end: 3 } } });
 await fireEvent.press(screen.getByRole("button", { name: c.read })); await screen.findByText(c.reviewBody); await fireEvent.press(screen.getByRole("button", { name: c.checkNew })); await screen.findByLabelText(copy.ru.draftQuantity);
 expect(screen.getByLabelText(copy.ru.draftQuantity)).toHaveProp("value", " 5,5 "); expect(screen.getByLabelText(copy.ru.draftQuantity)).toHaveProp("selection", { start: 1, end: 3 }); expect(screen.getByText(`${c.requested}: 5.5`)).toBeOnTheScreen();
 expect(s.update).toHaveBeenCalledTimes(1); expect(s.update.mock.calls[0]![3]).toEqual({ expectedVersion: 1, quantity: 3.5 });
});
