import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import type { MobileReadClient } from "./read-controller";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { CartCommandFixture, CartRepriceInput } from "./cart-command-fixture";
import { cartRepriceCopy } from "./CartRepriceUi";
import { cartValidationCopy } from "./CartValidationUi";
import { cartCommandCopy } from "./CartCommandUi";
import { cartWorkspaceCommandCopy } from "./CartWorkspaceCommandUi";
import { cartCommandScope, cartCommandAuthorization, cartCommandError, commandCart } from "./test-fixtures/cart-commands";
import { repriceValidation, repriceResult } from "./test-fixtures/cart-reprice";
import { savedPage } from "./test-fixtures/carts";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { bindMarketReads, createMarketTransport, type FetchTransport } from "./market-transport";
import { copy } from "./i18n";
import { formatMinor } from "./format-wire";
import { captureHardwareBack } from "./test-fixtures/hardware-back";
function setup() {
 let truth: CartResponse | null = commandCart(3);
 const validate = jest.fn(async (_scope: typeof cartCommandScope, _id: string): Promise<unknown> => repriceValidation(truth!));
 const send = jest.fn(async (_scope: typeof cartCommandScope, _id: string, input: CartRepriceInput): Promise<unknown> => { truth = repriceResult(truth!, input); return truth; });
 const read = jest.fn(async (_input: unknown) => savedPage(truth, [])), detail = jest.fn(async (_id: string): Promise<unknown> => truth), update = jest.fn(), remove = jest.fn(), create = jest.fn();
 const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), validateCart: validate, repriceCart: send, updateCartItem: update, removeCartItem: remove, createCart: create };
 const client: MobileReadClient = { searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => listDraftPayload("comparison-exact-offer"), workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"), workspaceCarts: read, workspaceCart: detail, cartCommandFixture: fixture };
 return { validate, send, read, detail, update, remove, create, fixture, client, current: () => truth, setCurrent: (cart: CartResponse | null) => { truth = cart; } };
}
const session = (client: MobileReadClient) => ({ client, scope: cartCommandScope, organizationName: "SYNTHETIC" });
async function enter(s: ReturnType<typeof setup>, locale: "ru" | "kk" = "ru") { const view = await render(<App session={session(s.client)} locale={locale} />); await fireEvent.press(screen.getByRole("tab", { name: copy[locale].cart })); await screen.findByRole("button", { name: cartValidationCopy[locale].start }); return view; }
async function prepare(locale: "ru" | "kk" = "ru") { await fireEvent.press(screen.getByRole("button", { name: cartValidationCopy[locale].start })); await screen.findByRole("button", { name: cartRepriceCopy[locale].prepare }); await fireEvent.press(screen.getByRole("button", { name: cartRepriceCopy[locale].prepare })); await screen.findByRole("button", { name: cartRepriceCopy[locale].confirm }); }

it.each(["fresh", "stale"].flatMap(mode => (["ru", "kk"] as const).map(locale => ({ mode, locale }))))("hardware Back cancels unsent reprice review $mode/$locale locally", async ({ mode, locale }) => {
 const hardware = captureHardwareBack(), s = setup(), t = cartRepriceCopy[locale];
 try {
  await enter(s, locale); await prepare(locale);
  if (mode === "stale") { s.setCurrent(commandCart(4)); await fireEvent.press(screen.getByRole("button", { name: copy[locale].refresh })); await screen.findByText(t.sourceChanged); }
  const source = JSON.stringify(s.current()), reads = s.read.mock.calls.length, validations = s.validate.mock.calls.length;
  expect(await hardware.press()).toBe(true); await screen.findByText(copy[locale].currentCart);
  expect(screen.queryByRole("button", { name: t.confirm })).toBeNull(); expect(screen.getByRole("tab", { name: copy[locale].cart })).toHaveProp("accessibilityState", expect.objectContaining({ selected: true }));
  expect(s.send).not.toHaveBeenCalled(); expect(s.update).not.toHaveBeenCalled(); expect(s.remove).not.toHaveBeenCalled(); expect(s.create).not.toHaveBeenCalled(); expect(s.read).toHaveBeenCalledTimes(reads); expect(s.validate).toHaveBeenCalledTimes(validations); expect(JSON.stringify(s.current())).toBe(source);
  expect(await hardware.press()).toBe(false); expect(s.send).not.toHaveBeenCalled(); expect(s.read).toHaveBeenCalledTimes(reads);
 } finally { hardware.restore(); }
});

it.each(["network", "throttled"].flatMap(mode => (["ru", "kk"] as const).map(locale => ({ mode, locale }))))("hardware Back cancels visible reprice preparation after recoverable GET $mode/$locale", async ({ mode, locale }) => {
 const hardware = captureHardwareBack(), s = setup(), t = cartRepriceCopy[locale], c = copy[locale], original = JSON.stringify(s.current());
 try {
  await enter(s, locale); await prepare(locale); s.read.mockRejectedValueOnce(mode === "network" ? Error("SYNTHETIC offline refresh") : cartCommandError(429)); await fireEvent.press(screen.getByRole("button", { name: c.refresh })); await screen.findByRole("button", { name: c.retry }); expect(screen.getByRole("button", { name: t.cancel })).toBeOnTheScreen();
  const reads = s.read.mock.calls.length; expect(await hardware.press()).toBe(true); expect(screen.queryByRole("button", { name: t.cancel })).toBeNull(); expect(screen.queryByRole("button", { name: t.confirm })).toBeNull(); expect(screen.getByRole("button", { name: c.retry })).toBeOnTheScreen(); expect(s.read).toHaveBeenCalledTimes(reads); expect(s.send).not.toHaveBeenCalled(); expect(s.update).not.toHaveBeenCalled(); expect(s.remove).not.toHaveBeenCalled(); expect(s.create).not.toHaveBeenCalled(); expect(s.validate).toHaveBeenCalledTimes(1); expect(await hardware.press()).toBe(false);
  await fireEvent.press(screen.getByRole("button", { name: c.retry })); await screen.findByText(c.currentCart); expect(s.read).toHaveBeenCalledTimes(reads + 1); expect(s.send).not.toHaveBeenCalled(); expect(JSON.stringify(s.current())).toBe(original);
 } finally { hardware.restore(); }
});

it("hardware Back during GET loading leaves hidden reprice preparation untouched", async () => {
 const hardware = captureHardwareBack(), s = setup(), t = cartRepriceCopy.ru; let finish!: (value: ReturnType<typeof savedPage>) => void;
 try {
  await enter(s); await prepare(); s.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); expect(screen.queryByRole("button", { name: t.cancel })).toBeNull(); const reads = s.read.mock.calls.length;
  expect(await hardware.press()).toBe(false); expect(s.send).not.toHaveBeenCalled(); expect(s.read).toHaveBeenCalledTimes(reads);
  await act(async () => { finish(savedPage(s.current(), [])); }); await screen.findByRole("button", { name: t.cancel }); expect(await hardware.press()).toBe(true); expect(s.send).not.toHaveBeenCalled(); expect(s.read).toHaveBeenCalledTimes(reads);
 } finally { if (finish) await act(async () => { finish(savedPage(s.current(), [])); }); hardware.restore(); }
});
it.each(["ru", "kk"] as const)("reviews full source terms, explicitly accepts, independently reads and acknowledges in %s", async locale => {
 const s = setup(), t = cartRepriceCopy[locale], v = cartValidationCopy[locale], original = JSON.stringify(s.current()); await enter(s, locale); expect(screen.queryByRole("button", { name: t.prepare })).toBeNull(); await prepare(locale);
 expect(s.send).not.toHaveBeenCalled(); expect(screen.getByText(t.preparedBody)).toBeOnTheScreen(); expect(screen.getByText(`${v.declaredRate}: 16`)).toBeOnTheScreen(); expect(screen.getByText(`${v.vatAmount}: ${formatMinor("1600000000000000000", s.current()!.currency, locale)}`)).toBeOnTheScreen(); expect(screen.getByText(`${v.profileVersion}: 5`)).toBeOnTheScreen(); expect(screen.getByText(`${v.organizationVersion}: 7`)).toBeOnTheScreen();
 expect(screen.getByText("SYNTHETIC exact promotion")).toBeOnTheScreen(); expect(screen.getByText(`${v.giftQuantity}: 0.500001`)).toBeOnTheScreen(); expect(screen.getByText(`${v.gift}: SYNTHETIC exact gift`)).toBeOnTheScreen(); expect(JSON.stringify(s.current())).toBe(original);
 expect(screen.queryByRole("button", { name: v.start })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.result);
 expect(s.send).toHaveBeenCalledTimes(1); expect(s.send.mock.calls[0]![2]).toEqual({ expectedVersion: 3, acceptedItems: repriceValidation(commandCart(3)).items.map(item => ({ cartItemId: item.cartItemId, snapshot: item.current })) });
 expect(screen.getByText(`${copy[locale].snapshotVersion}: 3`)).toBeOnTheScreen(); expect(screen.getByText(`${t.returned}: 4`)).toBeOnTheScreen(); expect(s.detail).not.toHaveBeenCalled();
 await fireEvent.press(screen.getByRole("button", { name: t.openResult })); await screen.findByText(copy[locale].cartSnapshotBody); expect(s.detail).toHaveBeenCalledWith(s.current()!.id); await fireEvent.press(screen.getByRole("button", { name: copy[locale].back })); await screen.findByRole("button", { name: t.read });
 await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByRole("button", { name: t.acknowledge }); expect(screen.queryByRole("button", { name: t.confirm })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: t.acknowledge })); await screen.findByRole("button", { name: v.start }); expect(s.validate).toHaveBeenCalledTimes(1); expect(s.send).toHaveBeenCalledTimes(1); expect(s.update).not.toHaveBeenCalled(); expect(s.remove).not.toHaveBeenCalled();
});
it("cancels an unsent preparation and preserves locale changes without sending or revalidating", async () => {
 const s = setup(), view = await enter(s); await prepare(); await view.rerender(<App session={session(s.client)} locale="kk" />); await screen.findByRole("button", { name: cartRepriceCopy.kk.confirm }); expect(s.validate).toHaveBeenCalledTimes(1); await fireEvent.press(screen.getByRole("button", { name: cartRepriceCopy.kk.cancel })); await screen.findByRole("button", { name: cartValidationCopy.kk.start }); expect(s.send).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: cartRepriceCopy.kk.prepare })).toBeOnTheScreen();
});
it("does not confirm a stale prepared page; cancellation exposes a fresh validation instead of auto-version", async () => {
 const s = setup(); await enter(s); await prepare(); s.setCurrent(commandCart(4)); await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await screen.findByText(cartRepriceCopy.ru.sourceChanged); expect(screen.getByRole("button", { name: cartRepriceCopy.ru.confirm })).toBeDisabled(); expect(s.send).not.toHaveBeenCalled(); await fireEvent.press(screen.getByRole("button", { name: cartRepriceCopy.ru.cancel })); await screen.findByText(cartValidationCopy.ru.stale); await prepare(); await fireEvent.press(screen.getByRole("button", { name: cartRepriceCopy.ru.confirm })); await screen.findByText(cartRepriceCopy.ru.result); expect(s.send.mock.calls[0]![2].expectedVersion).toBe(4); expect(s.validate).toHaveBeenCalledTimes(2);
});
it.each(["ru", "kk"] as const)("keeps unknown after fresh read, new validation and a separate new response: %s", async locale => {
 const s = setup(), t = cartRepriceCopy[locale]; s.send.mockRejectedValueOnce(new Error("SYNTHETIC response lost")); await enter(s, locale); await prepare(locale); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.unknown); const original = s.send.mock.calls[0]![2];
 expect(screen.queryByRole("button", { name: t.confirm })).toBeNull(); expect(s.send).toHaveBeenCalledTimes(1); s.setCurrent(commandCart(4)); await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByRole("button", { name: t.acknowledge }); expect(s.validate).toHaveBeenCalledTimes(1); await fireEvent.press(screen.getByRole("button", { name: t.acknowledge })); expect(screen.getByText(t.prior)).toBeOnTheScreen(); expect(screen.queryByRole("button", { name: t.prepare })).toBeNull(); await prepare(locale); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.result); expect(screen.getByText(t.prior)).toBeOnTheScreen(); expect(s.send).toHaveBeenCalledTimes(2); expect(s.send.mock.calls[1]![2].expectedVersion).toBe(4); expect(original.expectedVersion).toBe(3);
});
it.each(["none", "different"])("unlocks continuation after explicitly observing %s current cart without claiming old acceptance", async kind => {
 const s = setup(), t = cartRepriceCopy.ru; s.send.mockRejectedValueOnce(new Error("SYNTHETIC response lost")); await enter(s); await prepare(); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.unknown);
 const next = commandCart(4); next.id = "00000000-0000-4000-8000-000000000939"; next.items.forEach(item => { item.cartId = next.id; }); s.setCurrent(kind === "none" ? null : next); await fireEvent.press(screen.getByRole("button", { name: t.read })); await screen.findByRole("button", { name: t.acknowledge }); await fireEvent.press(screen.getByRole("button", { name: t.acknowledge })); expect(screen.getByText(t.prior)).toBeOnTheScreen(); if (kind === "none") expect(screen.getByRole("button", { name: cartWorkspaceCommandCopy.ru.start })).toBeEnabled(); else expect(screen.getByRole("button", { name: cartValidationCopy.ru.start })).toBeEnabled(); expect(s.send).toHaveBeenCalledTimes(1);
});
it.each([[409,"CART_VERSION_CONFLICT","versionConflict"],[409,"CART_REVALIDATION_REQUIRED","revalidation"],[400,"SYNTHETIC","rejected"],[500,"SYNTHETIC","unknown"]] as const)("handles %i/%s with explicit fresh reading and no silent payload update", async (status, code, title) => {
 const s = setup(), t = cartRepriceCopy.ru; s.send.mockRejectedValueOnce(cartCommandError(status,code)); await enter(s); await prepare(); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t[title]); expect(s.send).toHaveBeenCalledTimes(1); expect(s.validate).toHaveBeenCalledTimes(1); expect(screen.queryByText("SYNTHETIC private cart error")).toBeNull(); expect(screen.queryByRole("button", { name: t.confirm })).toBeNull(); expect(screen.getByRole("button", { name: t.read })).toBeOnTheScreen();
});
it("holds other cart commands and duplicate confirmation while pending, then ignores an old body after a newer workspace page", async () => {
 const s = setup(), t = cartRepriceCopy.ru; let finish!: (body: unknown) => void; s.send.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); await enter(s); await prepare(); await fireEvent.press(screen.getByRole("button", { name: t.confirm }));
 expect(screen.queryByRole("button", { name: t.confirm })).toBeNull(); expect(screen.queryByRole("button", { name: cartValidationCopy.ru.start })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.draftOpen}: ${copy.ru.cartItem} 1` })); expect(screen.queryByRole("button", { name: cartCommandCopy.ru.save })).toBeNull(); expect(screen.queryByRole("button", { name: cartCommandCopy.ru.removeStart })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: copy.ru.draftBack })); await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh }));
 const content = jest.fn(() => { throw new Error("must not decode old result"); }); await act(async () => { finish(Object.defineProperty({},"id",{get:content})); }); await screen.findByText(t.unknown); expect(content).not.toHaveBeenCalled(); expect(s.send).toHaveBeenCalledTimes(1); expect(s.update).not.toHaveBeenCalled(); expect(s.remove).not.toHaveBeenCalled();
});
it("retains no old reprice result across scope replacement under StrictMode", async () => {
 const s = setup(); const view = await render(<StrictMode><App session={session(s.client)} /></StrictMode>); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByRole("button", { name: cartValidationCopy.ru.start }); await prepare(); await fireEvent.press(screen.getByRole("button", { name: cartRepriceCopy.ru.confirm })); await screen.findByText(cartRepriceCopy.ru.result);
 await view.rerender(<StrictMode><App session={{...session(s.client),scope:{...cartCommandScope,generation:2}}} /></StrictMode>); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByText(copy.ru.currentCart); expect(screen.queryByText(cartRepriceCopy.ru.result)).toBeNull(); expect(screen.queryByText(cartRepriceCopy.ru.boundary)).toBeNull(); expect(s.send).toHaveBeenCalledTimes(1);
});
it("leaves default native cart transport GET-only without a reprice action", async () => {
 const fetcher = jest.fn<ReturnType<FetchTransport>,Parameters<FetchTransport>>().mockImplementation(async url => ({status:200,ok:true,text:async()=>JSON.stringify(url.includes("/workspaces/buyer/carts")?savedPage(commandCart(),[]):listDraftPayload("catalog-empty"))})); const transport=createMarketTransport("https://market.example.invalid/api",fetcher),client=bindMarketReads(path=>transport.request(path,{token:"synthetic-test-token",organizationId:cartCommandScope.organizationId}),cartCommandScope.organizationId);
 await render(<App session={session(client)} />);await fireEvent.press(screen.getByRole("tab",{name:copy.ru.cart}));await screen.findByText(copy.ru.currentCart);expect(screen.queryByText(cartRepriceCopy.ru.boundary)).toBeNull();expect(screen.queryByRole("button",{name:cartRepriceCopy.ru.prepare})).toBeNull();expect(fetcher.mock.calls.every(([url,init])=>init.method==="GET"&&init.body===undefined&&!url.includes("/reprice"))).toBe(true);transport.cancelAll();
});

it.each(["TAXABLE", "ZERO_RATED", "NOT_VAT_PAYER", "EXEMPT"] as const)("renders source VAT mode%s and preserves zero versus omitted rate without calculating tax", async mode => {
 const s = setup(), quote = repriceValidation(s.current()!), snapshot = quote.items[0]!.current!, t = cartValidationCopy.ru;
 snapshot.tax!.declaration.selection = { mode, rate: mode === "TAXABLE" ? "16" : mode === "ZERO_RATED" ? "0" : null, basis: mode === "TAXABLE" ? null : "SYNTHETIC declared basis" };
 if (mode !== "TAXABLE") { snapshot.tax!.baseMinor = snapshot.tax!.grossMinor; snapshot.tax!.vatMinor = "0"; }
 if (mode === "NOT_VAT_PAYER") snapshot.tax!.declaration.profile.status = "NOT_VAT_PAYER";
 s.validate.mockResolvedValueOnce(quote); await enter(s); await prepare();
 expect(screen.getByText(`${t.taxMode}: ${mode === "TAXABLE" ? t.taxable : mode === "ZERO_RATED" ? t.zeroRated : mode === "EXEMPT" ? t.exempt : t.nonPayer}`)).toBeOnTheScreen();
 expect(screen.getByText(`${t.declaredRate}: ${mode === "TAXABLE" ? "16" : mode === "ZERO_RATED" ? "0" : t.unknown}`)).toBeOnTheScreen();
 expect(screen.getByText(`${t.vatAmount}: ${formatMinor(mode === "TAXABLE" ? "1600000000000000000" : "0", s.current()!.currency, "ru")}`)).toBeOnTheScreen(); expect(s.send).not.toHaveBeenCalled();
});
it("shows absent tax/promotion/commercial snapshots explicitly rather than inventing zero tax, no gift or default unit", async () => {
 const s = setup(), quote = repriceValidation(s.current()!), snapshot = quote.items[0]!.current!, t = cartValidationCopy.kk; snapshot.tax = null; snapshot.promotion = null; snapshot.commercialTerms = null; s.validate.mockResolvedValueOnce(quote);
 await enter(s, "kk"); await prepare("kk"); expect(screen.getAllByText(t.taxMissing)).toHaveLength(2); expect(screen.getAllByText(t.promotionMissing)).toHaveLength(2); expect(screen.getAllByText(t.termsMissing)).toHaveLength(2); expect(screen.queryByText(`${t.giftQuantity}: 0`)).toBeNull(); expect(screen.queryByText(`${t.declaredRate}: 0`)).toBeNull(); expect(s.send).not.toHaveBeenCalled();
});
