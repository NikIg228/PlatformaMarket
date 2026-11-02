import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import * as CartUi from "./CartRead";
import type { MobileReadClient } from "./read-controller";
import type { CartCommandFixture, CartCreateInput } from "./cart-command-fixture";
import { cartWorkspaceCommandCopy as commandCopy } from "./CartWorkspaceCommandUi";
import { cartCommandCopy } from "./CartCommandUi";
import { cartCommandAuthorization, cartCommandScope, createdCartResult, cartCommandError } from "./test-fixtures/cart-commands";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { savedPage } from "./test-fixtures/carts";
import { copy } from "./i18n";
import { formatMinor } from "./format-wire";
import { captureHardwareBack } from "./test-fixtures/hardware-back";

function setup() {
  const create = jest.fn(async (_scope: typeof cartCommandScope, _buyer: string, _input: CartCreateInput): Promise<unknown> => createdCartResult());
  const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), createCart: create };
  const read = jest.fn(async () => savedPage(null, []));
  const detail = jest.fn(async () => { const cart = createdCartResult(); cart.version = 9; cart.items[0]!.quantity = "4.5"; return cart; });
  const client: MobileReadClient = { searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => listDraftPayload("comparison-exact-offer"), workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"), workspaceCarts: read, workspaceCart: detail, cartCommandFixture: fixture };
  return { create, fixture, read, detail, client };
}
const session = (client: MobileReadClient, scope = cartCommandScope) => ({ client, scope, organizationName: "SYNTHETIC" });
async function open(client: MobileReadClient, locale: "ru" | "kk" = "ru") {
  const view = await render(<StrictMode><App session={session(client)} locale={locale} /></StrictMode>);
  await fireEvent.press(screen.getByRole("tab", { name: copy[locale].cart })); await screen.findByText(copy[locale].noCurrentCart);
  return view;
}

it.each(["ru", "kk"] as const)("hardware Back returns unsent create preparation to original unknown review in%s", async locale => {
 const hardware = captureHardwareBack(), s = setup(), t = commandCopy[locale];
 try {
  s.create.mockRejectedValueOnce(Error("SYNTHETIC lost create")); await open(s.client, locale); await fireEvent.press(screen.getByRole("button", { name: t.start })); await screen.findByText(t.unknownBody); await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.none); await fireEvent.press(screen.getByRole("button", { name: t.prepare })); await screen.findByText(t.preparedBody);
  const reads = s.read.mock.calls.length; expect(await hardware.press()).toBe(true); await screen.findByText(t.reviewBody); expect(screen.queryByText(t.preparedBody)).toBeNull(); expect(screen.getByText(t.priorBody)).toBeOnTheScreen(); expect(screen.getByRole("tab", { name: copy[locale].cart })).toHaveProp("accessibilityState", expect.objectContaining({ selected: true })); expect(s.create).toHaveBeenCalledTimes(1); expect(s.read).toHaveBeenCalledTimes(reads); expect(s.detail).not.toHaveBeenCalled(); expect(await hardware.press()).toBe(false);
 } finally { hardware.restore(); }
});

it.each(["absent", "permission"])("keeps create unavailable without injected source authority: %s", async field => {
  const s = setup(); if (field === "absent") delete s.client.cartCommandFixture; else s.fixture.authorization = { ...s.fixture.authorization, permissions: [] };
  await open(s.client); expect(screen.queryByRole("button", { name: commandCopy.ru.start })).toBeNull(); expect(s.create).not.toHaveBeenCalled();
});

it.each(["ru", "kk"] as const)("runs only the explicit source-default KZT action, shows exact response and independently reads result in %s", async locale => {
  const s = setup(), t = commandCopy[locale], c = copy[locale]; await open(s.client, locale); expect(s.create).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: t.start })); await screen.findByText(t.resultBody);
  expect(s.create.mock.calls[0]).toEqual([cartCommandScope, cartCommandScope.organizationId, { currency: "KZT" }]);
  expect(screen.getByText(`${t.total}: ${formatMinor("180143985094819862468", "KZT", locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(c.noCurrentCart)).toBeOnTheScreen(); expect(s.read).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("SYNTHETIC private pricing")).toBeNull(); expect(screen.queryByRole("button", { name: t.start })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.openResult })); await screen.findByText(`${c.quantity}: 4.5`);
  expect(s.detail).toHaveBeenCalledTimes(1); expect(s.detail).toHaveBeenCalledWith(createdCartResult().id);
  expect(screen.queryByText(`${t.quantity}: 3.000001`)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: c.back })); await screen.findByText(c.noCurrentCart);
  expect(s.read.mock.calls).toEqual([[{ limit: 1, q: "" }], [{ limit: 1, q: "" }]]);
});

it("keeps a pending request single across repeated clicks and locale changes", async () => {
  const s = setup(); let finish!: (value: unknown) => void; s.create.mockImplementationOnce(() => new Promise(done => { finish = done; }));
  const view = await open(s.client); const button = screen.getByRole("button", { name: commandCopy.ru.start });
  await fireEvent.press(button); await fireEvent.press(button); expect(s.create).toHaveBeenCalledTimes(1);
  await view.rerender(<StrictMode><App session={session(s.client)} locale="kk" /></StrictMode>);
  expect(screen.getByLabelText(commandCopy.kk.pending)).toBeOnTheScreen();
  await act(async () => finish(createdCartResult())); await screen.findByText(commandCopy.kk.resultBody); expect(s.create).toHaveBeenCalledTimes(1);
});

it("does not claim lost creation from a separate current cart read, and unlocks other writes only on acknowledgement", async () => {
  const s = setup(), t = commandCopy.ru;
  s.create.mockRejectedValueOnce(new Error("SYNTHETIC private timeout"));
  s.fixture.updateCartItem = jest.fn(async () => createdCartResult()); s.fixture.removeCartItem = jest.fn(async () => createdCartResult());
  await open(s.client); await fireEvent.press(screen.getByRole("button", { name: t.start })); await screen.findByText(t.unknownBody);
  expect(screen.queryByRole("button", { name: t.start })).toBeNull(); expect(screen.queryByRole("button", { name: t.submit })).toBeNull();
  s.read.mockResolvedValue(savedPage(createdCartResult(), []));
  await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.reviewBody);
  expect(screen.queryByText(t.resultBody)).toBeNull(); expect(screen.queryByRole("button", { name: t.prepare })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.draftOpen}: ${copy.ru.cartItem} 1` })); await screen.findByLabelText(copy.ru.draftQuantity);
  expect(screen.queryByRole("button", { name: cartCommandCopy.ru.save })).toBeNull(); expect(screen.queryByRole("button", { name: cartCommandCopy.ru.removeStart })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.back })); await screen.findByText(t.reviewBody);
  await fireEvent.press(screen.getByRole("button", { name: t.acknowledge }));
  expect(screen.getByText(t.priorBody)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.draftResume}: ${copy.ru.cartItem} 1` })); await screen.findByLabelText(copy.ru.draftQuantity);
  expect(screen.getByRole("button", { name: cartCommandCopy.ru.save })).toBeOnTheScreen(); expect(s.create).toHaveBeenCalledTimes(1);
});

it("needs separate read, preparation and submission after409 without rendering server prose", async () => {
  const s = setup(), t = commandCopy.ru; s.create.mockRejectedValueOnce(cartCommandError(409)); await open(s.client);
  await fireEvent.press(screen.getByRole("button", { name: t.start })); await screen.findByText(t.rejectedBody);
  expect(screen.queryByText("SYNTHETIC private cart error")).toBeNull(); expect(screen.queryByRole("button", { name: t.start })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.none);
  await fireEvent.press(screen.getByRole("button", { name: t.prepare })); await screen.findByText(t.preparedBody); expect(s.create).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: t.returnReview })); await screen.findByText(t.none);
  await fireEvent.press(screen.getByRole("button", { name: t.prepare })); await fireEvent.press(screen.getByRole("button", { name: t.submit }));
  await screen.findByText(t.resultBody); expect(s.create).toHaveBeenCalledTimes(2);
});

it("retains prior unknown after a new explicitly prepared attempt and recoverable read error", async () => {
  const s = setup(), t = commandCopy.ru; s.create.mockRejectedValueOnce(new Error("SYNTHETIC lost response")); await open(s.client);
  await fireEvent.press(screen.getByRole("button", { name: t.start })); await screen.findByText(t.unknownBody);
  s.read.mockRejectedValueOnce(new Error("SYNTHETIC offline")); await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.readError);
  await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByText(t.none);
  await fireEvent.press(screen.getByRole("button", { name: t.prepare })); await fireEvent.press(screen.getByRole("button", { name: t.submit })); await screen.findByText(t.resultBody);
  expect(screen.getByText(t.priorBody)).toBeOnTheScreen(); expect(s.create).toHaveBeenCalledTimes(2);
});

it.each(["generation", "organizationId", "client"])("drops pending response before decoding on %s replacement", async field => {
  const s = setup(); let finish!: (value: unknown) => void; s.create.mockImplementationOnce(() => new Promise(done => { finish = done; })); const view = await open(s.client);
  await fireEvent.press(screen.getByRole("button", { name: commandCopy.ru.start }));
  const scope = { ...cartCommandScope, ...(field === "generation" ? { generation: 2 } : field === "organizationId" ? { organizationId: "00000000-0000-4000-8000-000000000099" } : {}) };
  await view.rerender(<StrictMode><App session={session(field === "client" ? { ...s.client } : s.client, scope)} /></StrictMode>); await screen.findByText(copy.ru.emptyCatalog);
  const decoded = jest.fn(() => { throw new Error("Late create result decoded"); }), result = {}; Object.defineProperty(result, "id", { get: decoded }); await act(async () => finish(result));
  expect(decoded).not.toHaveBeenCalled(); expect(screen.queryByText(commandCopy.ru.resultBody)).toBeNull();
});

it("guards retained/foreign result navigation and never creates a cart when one is already current", async () => {
  const real = CartUi.CartWorkspaceRead, pages: Parameters<typeof real>[0][] = [], spy = jest.spyOn(CartUi, "CartWorkspaceRead").mockImplementation(props => { pages.push(props); return real(props); });
  try {
    const s = setup(); await open(s.client); await fireEvent.press(screen.getByRole("button", { name: commandCopy.ru.start })); await screen.findByText(commandCopy.ru.resultBody);
    const page = pages.at(-1)!, result = page.workspaceCommands!.getSnapshot().result!;
    await act(async () => page.onCommandResult?.({ ...result })); expect(s.detail).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("tab", { name: copy.ru.catalog })); await screen.findByText(copy.ru.emptyCatalog);
    await act(async () => page.onCommandResult?.(result)); expect(s.detail).not.toHaveBeenCalled();
    s.read.mockResolvedValue(savedPage(createdCartResult(), [])); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByText(copy.ru.currentCart);
    expect(screen.queryByRole("button", { name: commandCopy.ru.start })).toBeNull();
    await act(async () => page.workspaceCommands?.start(page.page)); expect(s.create).toHaveBeenCalledTimes(1);
  } finally { spy.mockRestore(); }
});
