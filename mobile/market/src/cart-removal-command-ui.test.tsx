import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import type { MobileReadClient } from "./read-controller";
import type { CartCommandFixture, CartQuantityInput, CartVersionInput } from "./cart-command-fixture";
import { cartCommandCopy } from "./CartCommandUi";
import { cartCommandScope, cartCommandAuthorization, commandCart, removedCartResult, quantityCartResult, cartCommandError } from "./test-fixtures/cart-commands";
import { savedPage } from "./test-fixtures/carts";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { copy } from "./i18n";
import { captureHardwareBack } from "./test-fixtures/hardware-back";
function setup() {
 let current = commandCart();
 const remove = jest.fn(async (_scope: typeof cartCommandScope, _cart: string, item: string, input: CartVersionInput): Promise<unknown> => { current = removedCartResult(current, item, input); return current; });
 const update = jest.fn(async (_scope: typeof cartCommandScope, _cart: string, _item: string, input: CartQuantityInput): Promise<unknown> => { current = quantityCartResult(input); return current; });
 const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), updateCartItem: update, removeCartItem: remove }, read = jest.fn(async () => savedPage(current, []));
 const client: MobileReadClient = { searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => listDraftPayload("comparison-exact-offer"), workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"), workspaceCarts: read, workspaceCart: async () => current, cartCommandFixture: fixture };
 return { client, fixture, remove, update, read, setCurrent: (cart: typeof current) => { current = cart; } };
}
const session = (client: MobileReadClient, scope = cartCommandScope) => ({ client, scope, organizationName: "SYNTHETIC" });
async function open(client: MobileReadClient, locale: "ru" | "kk" = "ru") {
 const view = await render(<StrictMode><App session={session(client)} locale={locale} /></StrictMode>), t = copy[locale]; await fireEvent.press(screen.getByRole("tab", { name: t.cart })); await screen.findByRole("button", { name: `${t.draftOpen}: ${t.cartItem} 1` }); await fireEvent.press(screen.getByRole("button", { name: `${t.draftOpen}: ${t.cartItem} 1` })); await screen.findByLabelText(t.draftQuantity); return view;
}

it.each(["fresh", "stale", "reprepared"].flatMap(mode => (["ru", "kk"] as const).map(locale => ({ mode, locale }))))("hardware Back cancels unsent cart removal $mode/$locale with the existing draft policy", async ({ mode, locale }) => {
 const hardware = captureHardwareBack(), s = setup(), t = copy[locale], c = cartCommandCopy[locale];
 try {
  await open(s.client, locale); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), " 4,5 "); await fireEvent(screen.getByLabelText(t.draftQuantity), "selectionChange", { nativeEvent: { selection: { start: 1, end: 3 } } });
  await fireEvent.press(screen.getByRole("button", { name: c.removeStart }));
  if (mode === "stale") { s.setCurrent(commandCart(2)); await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByText(c.sourceChanged); }
  if (mode === "reprepared") { s.remove.mockRejectedValueOnce(Error("SYNTHETIC lost removal")); await fireEvent.press(screen.getByRole("button", { name: c.removeConfirm })); await screen.findByText(c.unknown); await fireEvent.press(screen.getByRole("button", { name: c.read })); await screen.findByText(c.review); await fireEvent.press(screen.getByRole("button", { name: c.recheckRemove })); await screen.findByRole("button", { name: c.removeConfirm }); }
  const reads = s.read.mock.calls.length, removals = s.remove.mock.calls.length;
  expect(await hardware.press()).toBe(true);
  if (mode === "stale") { expect(screen.getByText(t.draftSourceChangedBody)).toBeOnTheScreen(); expect(screen.queryByLabelText(t.draftQuantity)).toBeNull(); }
  else { await screen.findByLabelText(t.draftQuantity); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", " 4,5 "); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("selection", { start: 1, end: 3 }); }
  expect(screen.queryByRole("button", { name: c.removeConfirm })).toBeNull();
  if (mode === "reprepared") expect(screen.getByText(c.priorUnknown)).toBeOnTheScreen(); expect(s.remove).toHaveBeenCalledTimes(removals); expect(s.update).not.toHaveBeenCalled(); expect(s.read).toHaveBeenCalledTimes(reads);
  expect(await hardware.press()).toBe(true); await screen.findByText(t.currentCart); expect(s.remove).toHaveBeenCalledTimes(removals); expect(s.read).toHaveBeenCalledTimes(reads); expect(await hardware.press()).toBe(false);
 } finally { hardware.restore(); }
});

it.each(["ru", "kk"] as const)("hardware Back returns prepared quantity retry to review without sending in%s", async locale => {
 const hardware = captureHardwareBack(), s = setup(), t = copy[locale], c = cartCommandCopy[locale];
 try {
  s.update.mockRejectedValueOnce(cartCommandError(409)); await open(s.client, locale); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), " 4,5 "); await fireEvent.press(screen.getByRole("button", { name: c.save })); await screen.findByText(c.conflict);
  await fireEvent.press(screen.getByRole("button", { name: c.read })); await screen.findByText(c.review); await fireEvent.press(screen.getByRole("button", { name: c.checkNew })); await screen.findByText(c.prepared);
  const reads = s.read.mock.calls.length; expect(await hardware.press()).toBe(true); await screen.findByRole("button", { name: c.checkNew }); expect(screen.queryByText(c.prepared)).toBeNull(); expect(screen.getByText(c.reviewBody)).toBeOnTheScreen(); expect(s.update).toHaveBeenCalledTimes(1); expect(s.remove).not.toHaveBeenCalled(); expect(s.read).toHaveBeenCalledTimes(reads);
 } finally { hardware.restore(); }
});

it.each(["network", "throttled"].flatMap(mode => (["ru", "kk"] as const).map(locale => ({ mode, locale }))))("hardware Back cancels visible removal after recoverable GET $mode/$locale", async ({ mode, locale }) => {
 const hardware = captureHardwareBack(), s = setup(), t = copy[locale], c = cartCommandCopy[locale];
 try {
  await open(s.client, locale); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), " 4,5 "); await fireEvent(screen.getByLabelText(t.draftQuantity), "selectionChange", { nativeEvent: { selection: { start: 1, end: 3 } } }); await fireEvent.press(screen.getByRole("button", { name: c.removeStart })); s.read.mockRejectedValueOnce(mode === "network" ? Error("SYNTHETIC offline refresh") : cartCommandError(429)); await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByRole("button", { name: t.retry }); expect(screen.getByRole("button", { name: c.removeCancel })).toBeOnTheScreen();
  const reads = s.read.mock.calls.length; expect(await hardware.press()).toBe(true); expect(screen.getByText(c.editor)).toBeOnTheScreen(); expect(screen.queryByRole("button", { name: c.removeConfirm })).toBeNull(); expect(screen.getByRole("button", { name: t.retry })).toBeOnTheScreen(); expect(s.read).toHaveBeenCalledTimes(reads); expect(s.remove).not.toHaveBeenCalled(); expect(s.update).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: t.retry })); await screen.findByLabelText(t.draftQuantity); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", " 4,5 "); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("selection", { start: 1, end: 3 }); expect(s.read).toHaveBeenCalledTimes(reads + 1); expect(await hardware.press()).toBe(true); await screen.findByText(t.currentCart); expect(await hardware.press()).toBe(false); expect(s.remove).not.toHaveBeenCalled(); expect(s.update).not.toHaveBeenCalled(); expect(s.read).toHaveBeenCalledTimes(reads + 1);
 } finally { hardware.restore(); }
});

it("hardware Back during GET loading does not cancel hidden removal and leaves original review reachable", async () => {
 const hardware = captureHardwareBack(), s = setup(), t = copy.ru, c = cartCommandCopy.ru; let finish!: (value: ReturnType<typeof savedPage>) => void;
 try {
  await open(s.client); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), " 8,25 "); await fireEvent(screen.getByLabelText(t.draftQuantity), "selectionChange", { nativeEvent: { selection: { start: 2, end: 4 } } }); await fireEvent.press(screen.getByRole("button", { name: c.removeStart })); s.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); await fireEvent.press(screen.getByRole("button", { name: t.refresh })); expect(screen.queryByRole("button", { name: c.removeCancel })).toBeNull(); const reads = s.read.mock.calls.length;
  expect(await hardware.press()).toBe(true); await act(async () => { finish(savedPage(commandCart(), [])); }); await screen.findByRole("button", { name: `${c.resumeAttempt}: ${commandCart().id}` }); await fireEvent.press(screen.getByRole("button", { name: `${c.resumeAttempt}: ${commandCart().id}` })); await screen.findByRole("button", { name: c.removeCancel }); expect(await hardware.press()).toBe(true); await screen.findByLabelText(t.draftQuantity); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", " 8,25 "); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("selection", { start: 2, end: 4 }); expect(s.read).toHaveBeenCalledTimes(reads); expect(s.remove).not.toHaveBeenCalled(); expect(s.update).not.toHaveBeenCalled();
 } finally { if (finish) await act(async () => { finish(savedPage(commandCart(), [])); }); hardware.restore(); }
});
it.each(["absent", "permission"])("keeps removal unavailable without the explicit fake port/grant: %s", async reason => {
 const s = setup(); if (reason === "absent") delete s.fixture.removeCartItem; else s.fixture.authorization = { ...s.fixture.authorization, permissions: [] }; await open(s.client); expect(screen.queryByRole("button", { name: cartCommandCopy.ru.removeStart })).toBeNull(); expect(s.remove).not.toHaveBeenCalled();
});
it.each(["ru", "kk"] as const)("confirms the exact source line separately, cancels locally and consumes only the returned empty cart in %s", async locale => {
 const s = setup(), t = copy[locale], c = cartCommandCopy[locale]; await open(s.client, locale); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), " 4,5 "); await fireEvent(screen.getByLabelText(t.draftQuantity), "selectionChange", { nativeEvent: { selection: { start: 1, end: 3 } } }); await fireEvent.press(screen.getByRole("button", { name: c.removeStart })); await screen.findByText(c.removeTitle); expect(screen.getByText(`${c.sourceQuantity}: 2`)).toBeOnTheScreen(); expect(screen.getByText(`${c.expected}: 1`)).toBeOnTheScreen(); expect(screen.getByRole("text", { name: `${c.removeTitle}. ${c.removeBody} ${c.item}: ${commandCart().items[0]!.id}. ${c.sourceQuantity}: 2. ${c.expected}: 1.` })).toHaveProp("accessibilityLiveRegion", "polite"); expect(s.remove).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole("button", { name: c.removeCancel })); await screen.findByLabelText(t.draftQuantity); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", " 4,5 "); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("selection", { start: 1, end: 3 }); expect(s.remove).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole("button", { name: c.removeStart })); await fireEvent.press(screen.getByRole("button", { name: c.removeConfirm })); await screen.findByText(c.removeReceived); expect(screen.getByText(c.empty)).toBeOnTheScreen(); expect(s.remove).toHaveBeenCalledTimes(1); expect(s.remove.mock.calls[0]![3]).toEqual({ expectedVersion: 1 }); expect(s.update).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole("button", { name: c.read })); await screen.findByText(c.review); expect(screen.queryByRole("button", { name: c.recheckRemove })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: c.closeRead })); expect(screen.queryByRole("button", { name: `${t.draftOpen}: ${t.cartItem} 1` })).toBeNull(); expect(s.remove).toHaveBeenCalledTimes(1);
});
it("never interprets zero quantity as deletion; the separate confirmed removal sends no quantity", async () => {
 const s = setup(), c = cartCommandCopy.ru; await open(s.client); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), "0"); await fireEvent.press(screen.getByRole("button", { name: c.save })); await screen.findByText(copy.ru.draftPositive); expect(s.update).not.toHaveBeenCalled(); expect(s.remove).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole("button", { name: c.removeStart })); expect(screen.queryByLabelText(copy.ru.draftQuantity)).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: c.removeConfirm })); await screen.findByText(c.removeReceived); expect(Object.keys(s.remove.mock.calls[0]![3])).toEqual(["expectedVersion"]); expect(s.update).not.toHaveBeenCalled();
});
it("handles a same-version already-absent no-op as the actual response without inventing a version", async () => {
 const s = setup(), c = cartCommandCopy.ru; s.remove.mockImplementationOnce(async (_scope, _cart, id, input) => { const result = removedCartResult(commandCart(), id, input, 1); s.setCurrent(result); return result; }); await open(s.client); await fireEvent.press(screen.getByRole("button", { name: c.removeStart })); await fireEvent.press(screen.getByRole("button", { name: c.removeConfirm })); await screen.findByText(c.removeNoOpBody); expect(screen.getByText(`${c.version}: 1`)).toBeOnTheScreen();
});
it("requires read, review and a new confirmation after409 instead of auto-updating the original version", async () => {
 const s = setup(), c = cartCommandCopy.ru; s.remove.mockRejectedValueOnce(cartCommandError(409)); await open(s.client); await fireEvent.press(screen.getByRole("button", { name: c.removeStart })); await fireEvent.press(screen.getByRole("button", { name: c.removeConfirm })); await screen.findByText(c.conflict); expect(s.remove).toHaveBeenCalledTimes(1); s.setCurrent(commandCart(2, "4"));
 await fireEvent.press(screen.getByRole("button", { name: c.read })); await screen.findByText(c.review); expect(screen.getByText(`${c.expected}: 1`)).toBeOnTheScreen(); await fireEvent.press(screen.getByRole("button", { name: c.recheckRemove })); await screen.findByRole("button", { name: c.removeConfirm }); expect(screen.getByText(`${c.expected}: 2`)).toBeOnTheScreen(); expect(screen.getByText(`${c.sourceQuantity}: 4`)).toBeOnTheScreen(); expect(s.remove).toHaveBeenCalledTimes(1);
 await fireEvent.press(screen.getByRole("button", { name: c.removeConfirm })); await screen.findByText(c.removeReceived); expect(s.remove).toHaveBeenCalledTimes(2); expect(s.remove.mock.calls[1]![3]).toEqual({ expectedVersion: 2 }); expect(s.remove.mock.calls[0]![3]).toEqual({ expectedVersion: 1 });
});
it("shows unknown and later absence as unconfirmed facts, not as a successful delete or a repeat instruction", async () => {
 const s = setup(), c = cartCommandCopy.ru; s.remove.mockRejectedValueOnce(new Error("SYNTHETIC response lost")); const view = await open(s.client); await fireEvent.press(screen.getByRole("button", { name: c.removeStart })); await fireEvent.press(screen.getByRole("button", { name: c.removeConfirm })); await screen.findByText(c.unknown); expect(screen.queryByRole("button", { name: c.removeConfirm })).toBeNull(); expect(screen.queryByRole("button", { name: c.removeStart })).toBeNull();
 s.setCurrent(removedCartResult(commandCart(), commandCart().items[0]!.id, { expectedVersion: 1 })); await fireEvent.press(screen.getByRole("button", { name: c.read })); await screen.findByText(c.review); await view.rerender(<StrictMode><App session={session(s.client)} locale="kk" /></StrictMode>); const k = cartCommandCopy.kk;
 expect(screen.getByText(k.reviewBody)).toBeOnTheScreen(); expect(screen.getByText(k.priorUnknown)).toBeOnTheScreen(); expect(screen.queryByText(k.removeReceived)).toBeNull(); expect(screen.queryByRole("button", { name: k.recheckRemove })).toBeNull(); expect(s.remove).toHaveBeenCalledTimes(1); await fireEvent.press(screen.getByRole("button", { name: k.closeRead })); expect(s.remove).toHaveBeenCalledTimes(1);
});
it("invalidates a confirmation on a newer read rather than replacing its expectedVersion", async () => {
 const s = setup(), c = cartCommandCopy.ru; await open(s.client); await fireEvent.press(screen.getByRole("button", { name: c.removeStart })); s.setCurrent(commandCart(2)); await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await screen.findByText(c.sourceChanged); expect(screen.getByText(`${c.expected}: 1`)).toBeOnTheScreen(); expect(screen.getByRole("button", { name: c.removeConfirm })).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true })); expect(s.remove).not.toHaveBeenCalled();
});
it.each(["organizationId", "generation", "client"])("does not apply a late removal after %s replacement", async field => {
 const s = setup(); let finish!: (body: unknown) => void; s.remove.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); const view = await open(s.client); await fireEvent.press(screen.getByRole("button", { name: cartCommandCopy.ru.removeStart })); await fireEvent.press(screen.getByRole("button", { name: cartCommandCopy.ru.removeConfirm }));
 const scope = { ...cartCommandScope, ...(field === "organizationId" ? { organizationId: "00000000-0000-4000-8000-000000000099" } : field === "generation" ? { generation: 2 } : {}) }, client = field === "client" ? { ...s.client } : s.client;
 await view.rerender(<StrictMode><App session={session(client, scope)} /></StrictMode>); await screen.findByText(copy.ru.emptyCatalog); const hidden = jest.fn(() => { throw new Error("Stale deletion result decoded"); }), value = {}; Object.defineProperty(value, "id", { get: hidden }); await act(async () => finish(value)); expect(hidden).not.toHaveBeenCalled(); expect(screen.queryByText(cartCommandCopy.ru.removeReceived)).toBeNull();
});
