import { StrictMode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import App from "../App";
import type { MobileReadClient, ReadScope } from "./read-controller";
import { savedCart, savedPage, cartId, failedCartId, buyerId } from "./test-fixtures/carts";
import { copy } from "./i18n";
import { formatMinor } from "./format-wire";
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const fixture = (id: string): unknown => JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === id)!.payload));
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: buyerId, generation: 1 };
function client(cart = savedCart()) { return { searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-empty")), compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")), workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")), getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(fixture("order-workflow-minimal")), workspaceCarts: jest.fn<NonNullable<MobileReadClient["workspaceCarts"]>>().mockResolvedValue(savedPage(cart, [])), workspaceCart: jest.fn<NonNullable<MobileReadClient["workspaceCart"]>>().mockResolvedValue(cart) }; }
const session = (api = client(), active = scope) => ({ scope: active, client: api, organizationName: "SYNTHETIC organization" });
async function open(locale: "ru" | "kk", api = client()) { const rendered = await render(<App session={session(api)} locale={locale} />); await fireEvent.press(screen.getByRole("tab", { name: copy[locale].cart })); await screen.findAllByText(`${copy[locale].quantity}: 1.000001`); return rendered; }
async function edit(locale: "ru" | "kk", index = 1, resume = false) { const t = copy[locale]; await fireEvent.press(screen.getByRole("button", { name: `${resume ? t.draftResume : t.draftOpen}: ${t.cartItem} ${index}` })); await screen.findByLabelText(t.draftQuantity); }

it.each(["ru", "kk"] as const)("keeps source quantity/prices exact while checking/back/resuming/cancelling a local draft in %s", async locale => {
  const api = client(), cart = savedCart(), t = copy[locale]; await open(locale, api); const reads = api.workspaceCarts.mock.calls.length;
  await edit(locale); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", "1.000001");
  expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("keyboardType", "decimal-pad"); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("returnKeyType", "done");
  await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), "2,500"); await fireEvent(screen.getByLabelText(t.draftQuantity), "submitEditing");
  await screen.findByRole("text", { name: `${t.draftChecked}. ${t.draftOnlyLocal}` });
  expect(screen.getByText(`${t.draftServerQuantity}: 1.000001`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: t.draftBack }));
  expect(screen.getByText(`${t.draftPreview}: 2,500`)).toBeOnTheScreen(); expect(screen.getByText(`${t.quantity}: 1.000001`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.lineAmount}: ${formatMinor(cart.items[0]!.totalPriceMinor, cart.items[0]!.currency, locale)}`)).toBeOnTheScreen();
  await edit(locale, 1, true); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", "2,500");
  await fireEvent.press(screen.getByRole("button", { name: t.draftCancel })); expect(screen.queryByText(`${t.draftPreview}: 2,500`)).toBeNull();
  expect(screen.getByText(`${t.quantity}: 1.000001`)).toBeOnTheScreen(); expect(api.workspaceCarts).toHaveBeenCalledTimes(reads); expect(api.workspaceCart).not.toHaveBeenCalled();
});
it.each(["ru", "kk"] as const)("gives field-local required/positive/schema limit/step/precision errors in %s and checks only on action", async locale => {
  const api = client(), t = copy[locale]; await open(locale, api); await edit(locale);
  const cases = [["", t.draftRequired], ["0", t.draftPositive], ["1000001", `${t.draftMaximum}: 1000000.`], ["0.0000001", `${t.draftStep}: 0,000001.`], ["1.0000000000000000001", t.draftPrecision]];
  for (const [value, error] of cases) {
    await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), value!); expect(screen.queryByRole("alert")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: t.draftCheck })); await screen.findByRole("alert", { name: `${t.draftError}. ${error}` });
    expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", value); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("accessibilityHint", error);
  }
  await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), "0.000001"); await fireEvent.press(screen.getByRole("button", { name: t.draftCheck }));
  expect(screen.queryByRole("alert")).toBeNull(); expect(screen.getByRole("text", { name: `${t.draftChecked}. ${t.draftOnlyLocal}` })).toBeOnTheScreen(); expect(api.workspaceCarts).toHaveBeenCalledTimes(1);
});
it("switches locale without changing raw invalid input or issuing a read", async () => {
  const api = client(), rendered = await open("ru", api); await edit("ru"); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), ""); await fireEvent.press(screen.getByRole("button", { name: copy.ru.draftCheck }));
  await rendered.rerender(<App session={session(api)} locale="kk" />);
  expect(screen.getByRole("alert", { name: `${copy.kk.draftError}. ${copy.kk.draftRequired}` })).toBeOnTheScreen(); expect(screen.getByLabelText(copy.kk.draftQuantity)).toHaveProp("value", ""); expect(api.workspaceCarts).toHaveBeenCalledTimes(1);
});
it("isolates multiple line drafts and supports single/all cancellation without changing wire rows", async () => {
  const cart = savedCart(); cart.items.push({ ...cart.items[0]!, id: failedCartId }); const api = client(cart), t = copy.ru;
  await open("ru", api); await edit("ru"); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), "9"); await fireEvent.press(screen.getByRole("button", { name: t.draftBack }));
  await edit("ru", 2); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), ""); await fireEvent.press(screen.getByRole("button", { name: t.back }));
  expect(screen.getByText(`${t.draftCount}: 2`)).toBeOnTheScreen(); expect(screen.getByText(`${t.draftPreview}: ${t.draftBlank}`)).toBeOnTheScreen();
  await edit("ru", 1, true); await fireEvent.press(screen.getByRole("button", { name: t.draftCancel })); expect(screen.getByText(`${t.draftCount}: 1`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: t.draftCancelAll })); expect(screen.queryByText(`${t.draftCount}: 1`)).toBeNull(); expect(screen.getAllByText(`${t.quantity}: 1.000001`)).toHaveLength(2);
});
it.each(["user", "organization", "environment", "generation", "client"] as const)("clears local drafts before rendering replacement %s context", async field => {
  const api = client(), rendered = await open("ru", api); await edit("ru"); await fireEvent.changeText(screen.getByLabelText(copy.ru.draftQuantity), "123.456");
  const active = { ...scope };
  if (field === "user") active.userId = failedCartId;
  if (field === "organization") active.organizationId = failedCartId;
  if (field === "environment") active.environment = "synthetic-other";
  if (field === "generation") active.generation++;
  const nextApi = field === "client" ? client() : api; const nextCart = savedCart(); nextCart.buyerOrganizationId = active.organizationId; nextApi.workspaceCarts.mockResolvedValue(savedPage(nextCart, []));
  await rendered.rerender(<App session={session(nextApi, active)} />); await screen.findByText(copy.ru.emptyCatalog);
  expect(screen.queryByLabelText(copy.ru.draftQuantity)).toBeNull(); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByText(`${copy.ru.quantity}: 1.000001`);
  expect(screen.queryByText(`${copy.ru.draftPreview}: 123.456`)).toBeNull(); expect(screen.queryByRole("button", { name: `${copy.ru.draftResume}: ${copy.ru.cartItem} 1` })).toBeNull();
});
it("retains a local draft across same-version refresh and rejects stale edit view when server version changes", async () => {
  const api = client(), t = copy.ru; await open("ru", api); await edit("ru"); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), "2.5");
  await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByLabelText(t.draftQuantity); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", "2.5");
  const newer = savedCart(cartId, 2); newer.items[0]!.quantity = "7"; api.workspaceCarts.mockResolvedValue(savedPage(newer, []));
  await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByRole("text", { name: `${t.draftSourceChanged}. ${t.draftSourceChangedBody}` });
  expect(screen.queryByLabelText(t.draftQuantity)).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: t.draftBack }));
  expect(screen.getByText(`${t.quantity}: 7`)).toBeOnTheScreen(); expect(screen.getByRole("text", { name: `${t.draftDiscarded}. ${t.draftDiscardedBody}` })).toBeOnTheScreen();
  await edit("ru"); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", "7");
});
it("does not attach an old draft to a new cart pointer or a removed item", async () => {
  const api = client(), t = copy.ru; await open("ru", api); await edit("ru"); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), "2");
  api.workspaceCarts.mockResolvedValue(savedPage(savedCart(failedCartId), [])); await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByRole("text", { name: `${t.draftSourceChanged}. ${t.draftSourceChangedBody}` });
  expect(screen.queryByLabelText(t.draftQuantity)).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: t.draftBack })); await edit("ru");
  const empty = savedCart(failedCartId); empty.items = []; api.workspaceCarts.mockResolvedValue(savedPage(empty, [])); await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByRole("text", { name: `${t.draftSourceChanged}. ${t.draftSourceChangedBody}` }); expect(screen.queryByLabelText(t.draftQuantity)).toBeNull();
});
it("preserves recoverable offline input but drops it on denied current-cart access", async () => {
  const api = client(), t = copy.ru; await open("ru", api); await edit("ru"); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), "4.5");
  await fireEvent(screen.getByLabelText(t.draftQuantity), "selectionChange", { nativeEvent: { selection: { start: 1, end: 2 } } }); api.workspaceCarts.mockRejectedValueOnce(new Error("SYNTHETIC offline")); await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByRole("alert", { name: `${t.error}. ${t.errorBody}` });
  await fireEvent.press(screen.getByRole("button", { name: t.retry })); await screen.findByLabelText(t.draftQuantity); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", "4.5"); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("selection", { start: 1, end: 2 });
  api.workspaceCarts.mockRejectedValueOnce({ status: 403, payload: fixture("error-denied") }); await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByRole("alert", { name: `${t.denied}. ${t.deniedBody}` });
  await fireEvent.press(screen.getByRole("button", { name: t.retry })); await screen.findByRole("text", { name: `${t.draftSourceChanged}. ${t.draftSourceChangedBody}` }); expect(screen.queryByLabelText(t.draftQuantity)).toBeNull();
});
it("offers no quantity editor on saved/detail projections, and survives StrictMode/back without another request", async () => {
  const api = client(), t = copy.ru; await render(<StrictMode><App session={session(api)} /></StrictMode>); await fireEvent.press(screen.getByRole("tab", { name: t.cart })); await screen.findByText(`${t.quantity}: 1.000001`);
  const reads = api.workspaceCarts.mock.calls.length; await edit("ru"); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), "6"); await fireEvent.press(screen.getByRole("button", { name: t.back }));
  expect(screen.getByText(`${t.draftPreview}: 6`)).toBeOnTheScreen(); expect(api.workspaceCarts).toHaveBeenCalledTimes(reads);
  await fireEvent.press(screen.getByRole("button", { name: t.cartDetails })); await screen.findByText(copy.ru.checkoutUnavailable); expect(screen.queryByRole("button", { name: `${t.draftOpen}: ${t.cartItem} 1` })).toBeNull();
});

it("retains a draft through failed-history paging and uses the same opaque query for its editor/Back", async () => {
  const cart = savedCart(), api = client(cart), t = copy.ru, cursor = "SYNTHETIC:draft+/=page";
  api.workspaceCarts.mockImplementation(async input => savedPage(cart, [], input.cursor ? null : cursor));
  await open("ru", api); await edit("ru"); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), "8"); await fireEvent.press(screen.getByRole("button", { name: t.draftBack }));
  await fireEvent.press(screen.getByRole("button", { name: t.next })); await screen.findByText(`${t.draftPreview}: 8`);
  const reads = api.workspaceCarts.mock.calls.length; await edit("ru", 1, true); expect(screen.getByLabelText(t.draftQuantity)).toHaveProp("value", "8");
  await fireEvent.press(screen.getByRole("button", { name: t.draftBack })); expect(api.workspaceCarts).toHaveBeenCalledTimes(reads); expect(api.workspaceCarts.mock.calls.at(-1)?.[0]).toMatchObject({ cursor });
});
it("does not discard valid cart input just because an unrelated resource denies access", async () => {
  const api = { ...client(), getOrganizationProfile: jest.fn<NonNullable<MobileReadClient["getOrganizationProfile"]>>().mockRejectedValue({ status: 403, payload: fixture("error-denied") }) }, t = copy.ru;
  await open("ru", api); await edit("ru"); await fireEvent.changeText(screen.getByLabelText(t.draftQuantity), "9"); await fireEvent.press(screen.getByRole("button", { name: t.draftBack }));
  await fireEvent.press(screen.getByRole("tab", { name: t.organization })); await screen.findByRole("alert", { name: `${t.denied}. ${t.deniedBody}` });
  await fireEvent.press(screen.getByRole("tab", { name: t.cart })); await screen.findByText(`${t.draftPreview}: 9`);
});
