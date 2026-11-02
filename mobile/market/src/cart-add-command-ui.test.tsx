import { StrictMode, type ComponentProps } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import * as AddUi from "./CartAddCommandUi";
import { cartAddCopy, cartAddQuantityIssueText } from "./CartAddCommandUi";
import { cartCommandCopy } from "./CartCommandUi";
import { cartWorkspaceCommandCopy, cartCreateStartLabel } from "./CartWorkspaceCommandUi";
import type { FormInputHandle } from "./ui/controls";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { CartAddInput, CartCommandFixture, CartCreateInput } from "./cart-command-fixture";
import type { MobileReadClient } from "./read-controller";
import { cartCommandAuthorization, cartCommandScope, cartCommandError, cartAddComparison, addCommandCart, addCartItemResult, createdCartResult } from "./test-fixtures/cart-commands";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { savedPage } from "./test-fixtures/carts";
import { copy } from "./i18n";
import { formatMinor } from "./format-wire";
import { captureHardwareBack } from "./test-fixtures/hardware-back";

// Public native refs from the real owned input; no renderer traversal or host
// event-handler calls are used to prove first-error focus.
const mockHandles = new Map<string, FormInputHandle>();
jest.mock("./ui/controls", () => {
  const real = jest.requireActual<typeof import("./ui/controls")>("./ui/controls"), React = jest.requireActual<typeof import("react")>("react");
  return { ...real, FormInput: React.forwardRef<FormInputHandle, ComponentProps<typeof real.FormInput>>((props, ref) => React.createElement(real.FormInput, { ...props, ref: node => {
    if (node) mockHandles.set(props.accessibilityLabel, node);
    if (typeof ref === "function") ref(node); else if (ref) ref.current = node;
  } })) };
});
afterEach(() => { mockHandles.clear(); jest.restoreAllMocks(); });

function setup(noCurrent = false, currency?: string) {
  const comparison = cartAddComparison(); if (currency) comparison.offers[0]!.price.currency = currency;
  let truth: CartResponse | null = noCurrent ? null : addCommandCart();
  if (truth && currency) { truth.currency = currency; truth.items.forEach(item => { item.currency = currency; }); }
  const compare = jest.fn(async (_input: unknown): Promise<unknown> => comparison);
  const read = jest.fn(async (_input: unknown) => savedPage(truth, []));
  const detail = jest.fn(async (id: string): Promise<unknown> => { if (!truth || truth.id !== id) throw new Error("SYNTHETIC unexpected cart"); return truth; });
  const add = jest.fn(async (_scope: typeof cartCommandScope, id: string, input: CartAddInput): Promise<unknown> => {
    if (!truth || truth.id !== id) throw new Error("SYNTHETIC unexpected add target");
    const line = addCartItemResult(truth, input);
    truth = { ...truth, version: truth.version + 1, items: [...truth.items.filter(item => item.offerId !== input.offerId), line] };
    return line;
  });
  const create = jest.fn(async (_scope: typeof cartCommandScope, _buyer: string, input: CartCreateInput): Promise<unknown> => {
    if (!truth) { truth = createdCartResult(); truth.currency = input.currency; truth.items = []; truth.version = 1; }
    return truth;
  });
  const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), addCartItem: add };
  const client: MobileReadClient = { searchCatalog: async () => listDraftPayload("catalog-null-price"), compareOffers: compare, workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"), workspaceCarts: read, workspaceCart: detail, cartCommandFixture: fixture };
  return { comparison, compare, read, detail, add, create, fixture, client, current: () => truth, setCart: (cart: CartResponse | null) => { truth = cart; } };
}
const session = (client: MobileReadClient, scope = cartCommandScope) => ({ client, scope, organizationName: "SYNTHETIC" });
async function openEditor(s: ReturnType<typeof setup>, locale: "ru" | "kk" = "ru") {
  const t = copy[locale], view = await render(<StrictMode><App session={session(s.client)} locale={locale} /></StrictMode>);
  await screen.findByText("SYNTHETIC product"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC product, SYNTHETIC variant` }));
  await screen.findByText("SYNTHETIC supplier"); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` }));
  await fireEvent.press(screen.getByRole("button", { name: t.localListAdd })); await screen.findByLabelText(t.localListQuantity); return view;
}
const rawName = "  SYNTHETIC Таңғы список  ", rawNote = "  SYNTHETIC ескерту\nSecond line  ";
async function fill(locale: "ru" | "kk" = "ru") {
  const t = copy[locale]; await fireEvent.changeText(screen.getByLabelText(t.localListName), rawName); await fireEvent.changeText(screen.getByLabelText(t.localListNote), rawNote); await fireEvent.changeText(screen.getByLabelText(t.localListQuantity), " 3,5 ");
}
async function choose(locale: "ru" | "kk" = "ru") {
  await fireEvent.press(screen.getByRole("button", { name: cartAddCopy[locale].choose })); await screen.findByText(cartAddCopy[locale].body);
}
async function resumeEditor(locale: "ru" | "kk" = "ru") {
  const t = copy[locale]; await fireEvent.press(screen.getByRole("button", { name: t.localListResume })); await screen.findByLabelText(t.localListName);
  await fireEvent.press(screen.getByRole("button", { name: `${t.localListEdit}: ${t.cartItem} 1` })); await screen.findByLabelText(t.localListQuantity);
}

it.each(["ru", "kk"] as const)("hardware Back returns unsent addition retry to original unknown review and retains local input in%s", async locale => {
 const hardware = captureHardwareBack(), s = setup(), t = cartAddCopy[locale], c = copy[locale];
 try {
  await openEditor(s, locale); await fill(locale); await fireEvent(screen.getByLabelText(c.localListQuantity), "selectionChange", { nativeEvent: { selection: { start: 1, end: 3 } } }); await choose(locale); s.add.mockRejectedValueOnce(Error("SYNTHETIC lost addition")); await fireEvent.press(screen.getByRole("button", { name: t.apply })); await screen.findByText(t.unknownBody); const original = s.add.mock.calls[0]![2]; await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.reviewBody); await fireEvent.press(screen.getByRole("button", { name: t.prepare })); await screen.findByText(t.preparedBody);
  const reads = s.read.mock.calls.length, comparisons = s.compare.mock.calls.length; expect(await hardware.press()).toBe(true); await screen.findByText(t.reviewBody); expect(screen.queryByText(t.preparedBody)).toBeNull(); expect(screen.getByText(t.priorBody)).toBeOnTheScreen(); expect(s.add).toHaveBeenCalledTimes(1); expect(s.add.mock.calls[0]![2]).toBe(original); expect(s.create).not.toHaveBeenCalled(); expect(s.read).toHaveBeenCalledTimes(reads); expect(s.compare).toHaveBeenCalledTimes(comparisons); expect(await hardware.press()).toBe(false);
  await resumeEditor(locale); expect(screen.getByLabelText(c.localListQuantity)).toHaveProp("value", " 3,5 "); expect(screen.getByLabelText(c.localListQuantity)).toHaveProp("selection", { start: 1, end: 3 }); expect(screen.getByLabelText(c.localListName)).toHaveProp("value", rawName); expect(screen.getByLabelText(c.localListNote)).toHaveProp("value", rawNote); expect(s.add).toHaveBeenCalledTimes(1);
 } finally { hardware.restore(); }
});

it.each(["ru", "kk"] as const)("reviews replacement, sends only on explicit action, reads result independently and retains original list text/caret in %s", async locale => {
  const s = setup(), t = cartAddCopy[locale], c = copy[locale]; await openEditor(s, locale); await fill(locale);
  await fireEvent(screen.getByLabelText(c.localListQuantity), "selectionChange", { nativeEvent: { selection: { start: 1, end: 3 } } });
  await fireEvent(screen.getByLabelText(c.localListName), "selectionChange", { nativeEvent: { selection: { start: 3, end: 8 } } });
  await fireEvent(screen.getByLabelText(c.localListNote), "selectionChange", { nativeEvent: { selection: { start: 5, end: 9 } } });
  await fireEvent(screen.getByLabelText(c.localListQuantity), "submitEditing"); expect(s.add).not.toHaveBeenCalled(); expect(s.read).not.toHaveBeenCalled();
  await choose(locale); await screen.findByText(t.replaces); expect(screen.getByText(`${t.existing}: 2`)).toBeOnTheScreen(); expect(screen.getByText(`${t.requested}: 3.5`)).toBeOnTheScreen(); expect(s.add).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: t.apply })); await screen.findByText(t.resultBody);
  expect(s.add.mock.calls[0]).toEqual([cartCommandScope, addCommandCart().id, { offerId: s.comparison.offers[0]!.offerId, quantity: 3.5 }]);
  expect(screen.getByText(`${t.total}: ${formatMinor("90071992547409939999", s.comparison.offers[0]!.price.currency, locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(`${c.snapshotVersion}: 1`)).toBeOnTheScreen(); expect(screen.getByText(`${c.quantity}: 2`)).toBeOnTheScreen(); expect(screen.queryByText("SYNTHETIC private add pricing")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.open })); await screen.findByText(`${c.snapshotVersion}: 2`); await screen.findByText(`${c.quantity}: 3.5`); expect(s.detail).toHaveBeenCalledWith(addCommandCart().id);
  await fireEvent.press(screen.getByRole("button", { name: c.back })); await screen.findByText(`${c.snapshotVersion}: 2`); await resumeEditor(locale);
  expect(screen.getByLabelText(c.localListName)).toHaveProp("value", rawName); expect(screen.getByLabelText(c.localListNote)).toHaveProp("value", rawNote); expect(screen.getByLabelText(c.localListQuantity)).toHaveProp("value", " 3,5 ");
  expect(screen.getByLabelText(c.localListName)).toHaveProp("selection", { start: 3, end: 8 }); expect(screen.getByLabelText(c.localListNote)).toHaveProp("selection", { start: 5, end: 9 }); expect(screen.getByLabelText(c.localListQuantity)).toHaveProp("selection", { start: 1, end: 3 });
  expect(s.add).toHaveBeenCalledTimes(1);
});

it.each(["absent", "permission"])("has no add/preparation action without explicit source authority: %s", async kind => {
  const s = setup(); if (kind === "absent") delete s.client.cartCommandFixture; else s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
  await openEditor(s); expect(screen.queryByRole("button", { name: cartAddCopy.ru.choose })).toBeNull(); expect(s.add).not.toHaveBeenCalled();
});

it("focuses only the actual cart quantity error, announces its field, preserves raw text and switches RU/KK without full-list validation", async () => {
  const s = setup(), view = await openEditor(s), c = copy.ru;
  const quantity = jest.spyOn(mockHandles.get(c.localListQuantity)!, "focus"); quantity.mockClear();
  await fireEvent.changeText(screen.getByLabelText(c.localListQuantity), "2"); await fireEvent.press(screen.getByRole("button", { name: cartAddCopy.ru.choose }));
  const error = cartAddQuantityIssueText({ kind: "offer-step", minimum: "1.5", step: "1" }, "ru");
  expect(mockHandles.get(c.localListQuantity)).not.toBe(mockHandles.get(c.localListName)); expect(quantity.mock.contexts.at(-1)).toBe(mockHandles.get(c.localListQuantity)); expect(screen.getByRole("alert", { name: `${c.localListQuantity}. ${error}` })).toBeOnTheScreen();
  expect(screen.getByLabelText(c.localListQuantity)).toHaveProp("accessibilityHint", error); expect(screen.getByLabelText(c.localListName)).toHaveProp("value", ""); expect(s.read).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText(c.localListQuantity), "0.0000001"); expect(screen.getByLabelText(c.localListQuantity)).toHaveProp("accessibilityHint", c.localListOnlyLocal);
  await fireEvent.press(screen.getByRole("button", { name: cartAddCopy.ru.choose }));
  await view.rerender(<StrictMode><App session={session(s.client)} locale="kk" /></StrictMode>);
  expect(screen.getByLabelText(copy.kk.localListQuantity)).toHaveProp("value", "0.0000001"); expect(screen.getByLabelText(copy.kk.localListQuantity)).toHaveProp("accessibilityHint", cartAddQuantityIssueText({ kind: "step", step: "0.000001" }, "kk")); expect(s.add).not.toHaveBeenCalled();
});

it("does not focus a quantity field or request a cart when source availability is not established", async () => {
  const s = setup(); s.comparison.offers[0]!.availability = []; await openEditor(s); await fill(); const focus = jest.spyOn(mockHandles.get(copy.ru.localListQuantity)!, "focus"); focus.mockClear();
  await fireEvent.press(screen.getByRole("button", { name: cartAddCopy.ru.choose })); await screen.findByText(cartAddCopy.ru.availability); expect(focus).not.toHaveBeenCalled(); expect(s.read).not.toHaveBeenCalled(); expect(s.add).not.toHaveBeenCalled();
});

it("never sends name/note or requires list-save validity for the selected cart offer/quantity", async () => {
  const s = setup(); await openEditor(s); await fireEvent.changeText(screen.getByLabelText(copy.ru.localListQuantity), "3.5"); await fireEvent.changeText(screen.getByLabelText(copy.ru.localListNote), "SYNTHETIC " + "x".repeat(600));
  await choose(); await fireEvent.press(screen.getByRole("button", { name: cartAddCopy.ru.apply })); await screen.findByText(cartAddCopy.ru.resultBody);
  expect(Object.keys(s.add.mock.calls[0]![2]).sort()).toEqual(["offerId", "quantity"]); expect(s.add.mock.calls[0]![2]).not.toHaveProperty("note");
});

it("rereads the exact selected product/variant when resuming a local entry from a different read before choosing it for cart", async () => {
  const s = setup(); await openEditor(s); await fill(); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.orders })); await screen.findByText("SYNTHETIC-READ-001"); await resumeEditor();
  expect(screen.queryByRole("button", { name: cartAddCopy.ru.choose })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: cartAddCopy.ru.readOffer })); await screen.findByRole("button", { name: cartAddCopy.ru.choose });
  expect(s.compare).toHaveBeenLastCalledWith(expect.objectContaining({ productId: s.comparison.product.id, variantId: s.comparison.selectedVariantId, buyerOrganizationId: cartCommandScope.organizationId }));
  expect(screen.getByLabelText(copy.ru.localListQuantity)).toHaveProp("value", " 3,5 "); expect(screen.getByLabelText(copy.ru.localListNote)).toHaveProp("value", rawNote); expect(s.add).not.toHaveBeenCalled(); await choose();
});

it.each(["ru", "kk"] as const)("offers explicit matching-currency create/read/ack before a separate add when no active cart exists in %s", async locale => {
  const s = setup(true, "USD"), t = cartAddCopy[locale], w = cartWorkspaceCommandCopy[locale]; s.fixture.createCart = s.create;
  await openEditor(s, locale); await fill(locale); await choose(locale); await screen.findByText(t.needsCart);
  expect(screen.queryByRole("button", { name: w.start })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: cartCreateStartLabel(locale, "USD") })); await screen.findByText(w.resultBody); expect(s.create.mock.calls[0]![2]).toEqual({ currency: "USD" }); expect(s.add).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: w.read })); await screen.findByText(w.reviewBody); expect(screen.getByRole("button", { name: t.apply })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: w.acknowledge })); await fireEvent.press(screen.getByRole("button", { name: t.apply })); await screen.findByText(t.resultBody);
  expect(s.create).toHaveBeenCalledTimes(1); expect(s.add).toHaveBeenCalledTimes(1); expect(s.add.mock.calls[0]![2]).toEqual({ offerId: s.comparison.offers[0]!.offerId, quantity: 3.5 });
  await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.reviewBody); await fireEvent.press(screen.getByRole("button", { name: t.acknowledge }));
});

it("keeps unknown addition separate from matching read, allows reread after Back and needs a separately prepared new send", async () => {
  const s = setup(), t = cartAddCopy.ru; s.fixture.updateCartItem = jest.fn(async () => addCommandCart()); await openEditor(s); await fill(); await choose();
  s.add.mockRejectedValueOnce(new Error("SYNTHETIC committed response lost")); await fireEvent.press(screen.getByRole("button", { name: t.apply })); await screen.findByText(t.unknownBody);
  expect(screen.queryByRole("button", { name: t.apply })).toBeNull(); expect(screen.queryByRole("button", { name: t.submit })).toBeNull();
  s.setCart(addCommandCart(2, "3.500000")); await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.reviewBody); expect(screen.queryByText(t.resultBody)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.draftOpen}: ${copy.ru.cartItem} 1` })); await screen.findByLabelText(copy.ru.draftQuantity); expect(screen.queryByRole("button", { name: cartCommandCopy.ru.save })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.back })); await screen.findByText(t.reviewBody);
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.cartDetails })); await screen.findByText(`${copy.ru.snapshotVersion}: 2`);
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.back })); await screen.findByText(t.reviewBody); expect(screen.getByRole("button", { name: t.acknowledge })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.reviewBody); await fireEvent.press(screen.getByRole("button", { name: t.prepare })); await screen.findByText(t.preparedBody); expect(s.add).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: t.returnReview })); await fireEvent.press(screen.getByRole("button", { name: t.prepare })); await fireEvent.press(screen.getByRole("button", { name: t.submit })); await screen.findByText(t.resultBody);
  expect(s.add).toHaveBeenCalledTimes(2); expect(screen.getByText(t.priorBody)).toBeOnTheScreen();
});

it("keeps read failure reachable and requires explicit new-cart review after409 without adding request fields", async () => {
  const s = setup(), t = cartAddCopy.ru; await openEditor(s); await fill(); await choose(); s.add.mockRejectedValueOnce(cartCommandError(409)); await fireEvent.press(screen.getByRole("button", { name: t.apply })); await screen.findByText(t.rejectedBody);
  expect(screen.queryByText("SYNTHETIC private cart error")).toBeNull(); s.read.mockRejectedValueOnce(new Error("SYNTHETIC offline")); await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.readError);
  const cart = addCommandCart(9, "5"); cart.id = "00000000-0000-4000-8000-000000000899"; cart.items.forEach(item => { item.cartId = cart.id; }); s.setCart(cart);
  await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.otherCart); await fireEvent.press(screen.getByRole("button", { name: t.prepare })); await fireEvent.press(screen.getByRole("button", { name: t.submit })); await screen.findByText(t.resultBody);
  expect(s.add.mock.calls[1]![1]).toBe(cart.id); expect(Object.keys(s.add.mock.calls[1]![2]).sort()).toEqual(["offerId", "quantity"]);
});

it("serializes repeated Apply and preserves pending state across locale change", async () => {
  const s = setup(); let finish!: (body: unknown) => void; s.add.mockImplementationOnce(() => new Promise(done => { finish = done; })); const view = await openEditor(s); await fill(); await choose();
  const button = screen.getByRole("button", { name: cartAddCopy.ru.apply }); await fireEvent.press(button); await fireEvent.press(button); expect(s.add).toHaveBeenCalledTimes(1);
  await view.rerender(<StrictMode><App session={session(s.client)} locale="kk" /></StrictMode>); expect(screen.getByLabelText(cartAddCopy.kk.pending)).toBeOnTheScreen();
  await act(async () => finish(addCartItemResult(addCommandCart(), s.add.mock.calls[0]![2]))); await screen.findByText(cartAddCopy.kk.resultBody);
});

it.each(["generation", "organizationId", "client"])("drops late add content and local intent after%s replacement", async field => {
  const s = setup(); let finish!: (body: unknown) => void; s.add.mockImplementationOnce(() => new Promise(done => { finish = done; })); const view = await openEditor(s); await fill(); await choose(); await fireEvent.press(screen.getByRole("button", { name: cartAddCopy.ru.apply }));
  const scope = { ...cartCommandScope, ...(field === "generation" ? { generation: 2 } : field === "organizationId" ? { organizationId: "00000000-0000-4000-8000-000000000099" } : {}) };
  await view.rerender(<StrictMode><App session={session(field === "client" ? { ...s.client } : s.client, scope)} /></StrictMode>); await screen.findByText("SYNTHETIC product");
  const decoded = jest.fn(() => { throw new Error("Old add response decoded"); }), result = {}; Object.defineProperty(result, "id", { get: decoded }); await act(async () => finish(result));
  expect(decoded).not.toHaveBeenCalled(); expect(screen.queryByText(cartAddCopy.ru.resultBody)).toBeNull(); expect(screen.queryByRole("button", { name: copy.ru.localListResume })).toBeNull();
});

it("rejects retained comparison/selection callbacks before fresh source selection and never selects twice into requests", async () => {
  const real = AddUi.CartAddFromListAction, choices: Parameters<typeof real>[0][] = [], spy = jest.spyOn(AddUi, "CartAddFromListAction").mockImplementation(props => { choices.push(props); return real(props); });
  try {
    const s = setup(); await openEditor(s); await fill(); const old = choices.at(-1)!;
    await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await screen.findByLabelText(copy.ru.localListQuantity);
    await act(async () => { expect(old.command.select(old.target, old.comparison!)).toBe("unavailable"); old.onSelected(); }); expect(s.read).not.toHaveBeenCalled();
    await choose(); await act(async () => old.onSelected()); expect(s.read).toHaveBeenCalledTimes(1); expect(s.add).not.toHaveBeenCalled();
  } finally { spy.mockRestore(); }
});
