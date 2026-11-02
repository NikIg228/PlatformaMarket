import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../App";
import type { MobileReadClient } from "./read-controller";
import type { CartResponse } from "../../../packages/schemas/src/core-api";
import type { CartCommandFixture } from "./cart-command-fixture";
import { cartValidationCopy } from "./CartValidationUi";
import { cartCommandCopy } from "./CartCommandUi";
import { cartCommandAuthorization, cartCommandScope, commandCart, cartCommandError } from "./test-fixtures/cart-commands";
import { cartValidationResult } from "./test-fixtures/cart-validation";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { savedPage } from "./test-fixtures/carts";
import { bindMarketReads, createMarketTransport, type FetchTransport } from "./market-transport";
import { copy } from "./i18n";
import { formatMinor } from "./format-wire";
function setup(kind: "unchanged" | "changed" | "unavailable" = "changed") {
 let current: CartResponse | null = commandCart(3);
 const validation = jest.fn(async (_scope: typeof cartCommandScope, _cartId: string): Promise<unknown> => cartValidationResult(current!, kind));
 const read = jest.fn(async (_input: unknown) => savedPage(current, [])), detail = jest.fn(async (): Promise<unknown> => current);
 const update = jest.fn(), remove = jest.fn(); const fixture: CartCommandFixture = { authorization: cartCommandAuthorization(), validateCart: validation, updateCartItem: update, removeCartItem: remove };
 const client: MobileReadClient = { searchCatalog: async () => listDraftPayload("catalog-empty"), compareOffers: async () => listDraftPayload("comparison-exact-offer"), workspaceOrders: async () => listDraftPayload("workspace-orders-page"), getOrderWorkflow: async () => listDraftPayload("order-workflow-minimal"), workspaceCarts: read, workspaceCart: detail, cartCommandFixture: fixture };
 return { client, fixture, validation, read, detail, update, remove, current: () => current, setCurrent: (value: CartResponse | null) => { current = value; } };
}
const session = (client: MobileReadClient) => ({ client, scope: cartCommandScope, organizationName: "SYNTHETIC" });
async function enter(s: ReturnType<typeof setup>, locale: "ru" | "kk" = "ru") { const view = await render(<App session={session(s.client)} locale={locale} />); await fireEvent.press(screen.getByRole("tab", { name: copy[locale].cart })); await screen.findByRole("button", { name: cartValidationCopy[locale].start }); return view; }
async function validate(locale: "ru" | "kk" = "ru") { await fireEvent.press(screen.getByRole("button", { name: cartValidationCopy[locale].start })); await screen.findByText(cartValidationCopy[locale].ready); }
it.each(["ru", "kk"] as const)("shows source changes and previous/current exact values without accepting/repricing/ordering in %s", async locale => {
 const s = setup(), t = cartValidationCopy[locale], original = JSON.stringify(s.current()); await enter(s, locale); expect(s.validation).not.toHaveBeenCalled(); await validate(locale);
 expect(s.validation.mock.calls).toEqual([[cartCommandScope, s.current()!.id]]); expect(screen.getByText(t.previous)).toBeOnTheScreen(); expect(screen.getByText(t.current)).toBeOnTheScreen();
 expect(screen.getByText(`${t.unit}: ${formatMinor("90071992547409939998", s.current()!.currency, locale)}`)).toBeOnTheScreen(); expect(screen.getByText(`${t.total}: ${formatMinor("90071992547409939999", s.current()!.currency, locale)}`)).toBeOnTheScreen();
 expect(screen.getByText(`${t.available}: ${t.unknown}`)).toBeOnTheScreen(); expect(screen.getByText(`${t.available}: 1.500001`)).toBeOnTheScreen(); expect(screen.getByText(`${t.fulfillment}: ${t.insufficient}`)).toBeOnTheScreen();
 expect(screen.getByText(`${t.vatIncluded}: ${t.unknown}`)).toBeOnTheScreen(); expect(screen.getByText(`${t.saleUnit}: SYNTHETIC sale unit`)).toBeOnTheScreen(); expect(screen.getByText(`${t.packagingQuantity}: 3.000001`)).toBeOnTheScreen();
 expect(screen.getAllByText(`${t.acceptance}: ${t.yes}`)).toHaveLength(2); expect(screen.getAllByText(`${t.checkout}: ${t.no}`)).toHaveLength(2);
 expect(screen.queryByText("SYNTHETIC raw Russian/server/private message not a localized UI status")).toBeNull(); expect(JSON.stringify(s.current())).toBe(original); expect(s.update).not.toHaveBeenCalled(); expect(s.remove).not.toHaveBeenCalled();
});
it.each(["unchanged", "unavailable"] as const)("renders %s and nullable conditions from the server answer without implying a checkout receipt", async kind => {
 const s = setup(kind), t = cartValidationCopy.ru; await enter(s); await validate(); expect(screen.getByText(kind === "unchanged" ? t.unchanged : t.notAvailable)).toBeOnTheScreen();
 if (kind === "unavailable") { expect(screen.getByText(t.missing)).toBeOnTheScreen(); expect(screen.queryByText(t.current)).toBeNull(); } else expect(screen.getAllByText(`${t.checkout}: ${t.yes}`)).toHaveLength(2);
 expect(screen.getByText(t.body)).toBeOnTheScreen(); expect(s.detail).not.toHaveBeenCalled();
});
it("keeps zero inventory distinct from an omitted inventory value and does not infer stock arithmetic", async () => {
 const s = setup("unchanged"), t = cartValidationCopy.ru, value = cartValidationResult(s.current()!); value.items[0]!.current!.availableQuantity = "0"; value.items[0]!.current!.fulfillmentStatus = "OUT_OF_STOCK"; value.items[0]!.canCheckout = false; value.canCheckout = false;
 s.validation.mockResolvedValueOnce(value); await enter(s); await validate(); expect(screen.getByText(`${t.available}: 0`)).toBeOnTheScreen(); expect(screen.getByText(`${t.available}: ${t.unknown}`)).toBeOnTheScreen(); expect(screen.getByText(`${t.fulfillment}: ${t.outOfStock}`)).toBeOnTheScreen();
});
it("renders an empty current-cart validation without offering order creation", async () => {
 const s = setup("unchanged"); s.current()!.items = []; await enter(s); await validate(); expect(screen.getByText(cartValidationCopy.ru.empty)).toBeOnTheScreen(); expect(screen.getByText(`${cartValidationCopy.ru.checkout}: ${cartValidationCopy.ru.no}`)).toBeOnTheScreen(); expect(s.validation).toHaveBeenCalledTimes(1);
});
it.each(["version", "different", "none"])("hides validation after a fresh %s workspace read and waits for a new explicit check", async change => {
 const s = setup(); await enter(s); await validate(); const next = commandCart(4); if (change === "different") { next.id = "00000000-0000-4000-8000-000000000990"; next.items[0]!.cartId = next.id; }
 s.setCurrent(change === "none" ? null : next); await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await screen.findByText(cartValidationCopy.ru.stale);
 expect(screen.queryByText(cartValidationCopy.ru.ready)).toBeNull(); expect(screen.queryByText(cartValidationCopy.ru.current)).toBeNull(); expect(s.validation).toHaveBeenCalledTimes(1);
 if (change === "none") expect(screen.queryByRole("button", { name: cartValidationCopy.ru.start })).toBeNull(); else { await validate(); expect(s.validation.mock.calls[1]).toEqual([cartCommandScope, next.id]); }
});
it("changes locale without rechecking, while an independent cart detail and Back require fresh validation", async () => {
 const s = setup(), view = await enter(s); await validate(); await view.rerender(<App session={session(s.client)} locale="kk" />); await screen.findByText(cartValidationCopy.kk.ready); expect(s.validation).toHaveBeenCalledTimes(1);
 await fireEvent.press(screen.getByRole("button", { name: copy.kk.cartDetails })); await screen.findByText(copy.kk.cartSnapshotBody); expect(screen.queryByText(cartValidationCopy.kk.ready)).toBeNull();
 await fireEvent.press(screen.getByRole("button", { name: copy.kk.back })); await screen.findByText(cartValidationCopy.kk.stale); expect(s.validation).toHaveBeenCalledTimes(1); await validate("kk"); expect(s.validation).toHaveBeenCalledTimes(2);
});
it.each([401,403,404,409,500])("shows localized %i error without raw message, automatic retry or mutation", async status => {
 const s = setup(); s.validation.mockRejectedValueOnce(cartCommandError(status)); await enter(s, "kk"); await fireEvent.press(screen.getByRole("button", { name: cartValidationCopy.kk.start })); const t = cartValidationCopy.kk;
 await screen.findByText(status === 401 ? t.auth : status === 403 ? t.denied : status === 404 ? t.unavailable : status === 409 ? t.conflict : t.error); expect(screen.queryByText("SYNTHETIC private cart error")).toBeNull(); expect(s.validation).toHaveBeenCalledTimes(1);
 if (status === 401 || status === 403) expect(screen.getByRole("button", { name: t.start })).toBeDisabled(); else { await validate("kk"); expect(s.validation).toHaveBeenCalledTimes(2); }
 expect(s.update).not.toHaveBeenCalled(); expect(s.remove).not.toHaveBeenCalled();
});
it("prevents duplicate checks and position writes while pending, then discards a body after a new page read", async () => {
 const s = setup(); let finish!: (body: unknown) => void; s.validation.mockImplementationOnce(() => new Promise(yes => { finish = yes; })); await enter(s); await fireEvent.press(screen.getByRole("button", { name: cartValidationCopy.ru.start }));
 expect(screen.getByRole("button", { name: cartValidationCopy.ru.start })).toBeDisabled(); await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.draftOpen}: ${copy.ru.cartItem} 1` }));
 expect(screen.queryByRole("button", { name: cartCommandCopy.ru.save })).toBeNull(); expect(screen.queryByRole("button", { name: cartCommandCopy.ru.removeStart })).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: copy.ru.draftBack }));
 await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh }));
 const content = jest.fn(() => { throw new Error("stale content must not be read"); }); await act(async () => { finish(Object.defineProperty({}, "cartId", { get: content })); }); await screen.findByText(cartValidationCopy.ru.stale);
 expect(content).not.toHaveBeenCalled(); expect(s.validation).toHaveBeenCalledTimes(1); expect(s.update).not.toHaveBeenCalled(); expect(s.remove).not.toHaveBeenCalled();
});
it("does not retain old validation through scope replacement or StrictMode's effect replay", async () => {
 const s = setup(), view = await render(<StrictMode><App session={session(s.client)} /></StrictMode>); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByRole("button", { name: cartValidationCopy.ru.start }); await validate(); expect(s.validation).toHaveBeenCalledTimes(1);
 await view.rerender(<StrictMode><App session={{ ...session(s.client), scope: { ...cartCommandScope, generation: 2 } }} /></StrictMode>); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByText(copy.ru.currentCart); expect(screen.queryByText(cartValidationCopy.ru.ready)).toBeNull(); expect(screen.queryByRole("button", { name: cartValidationCopy.ru.start })).toBeNull(); expect(s.validation).toHaveBeenCalledTimes(1);
});
it("keeps default native transport GET-only with no validation affordance or sample response", async () => {
 const current = commandCart(), fetcher = jest.fn<ReturnType<FetchTransport>, Parameters<FetchTransport>>().mockImplementation(async url => ({ status: 200, ok: true, text: async () => JSON.stringify(url.includes("/workspaces/buyer/carts") ? savedPage(current, []) : listDraftPayload("catalog-empty")) }));
 const transport = createMarketTransport("https://market.example.invalid/api", fetcher), client = bindMarketReads(path => transport.request(path, { token: "synthetic-test-token", organizationId: cartCommandScope.organizationId }), cartCommandScope.organizationId);
 await render(<App session={session(client)} />); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByText(copy.ru.currentCart); expect(screen.queryByText(cartValidationCopy.ru.title)).toBeNull(); expect(screen.queryByRole("button", { name: cartValidationCopy.ru.start })).toBeNull(); expect(fetcher.mock.calls.every(([,init]) => init.method === "GET" && init.body === undefined)).toBe(true); expect(fetcher.mock.calls.some(([url]) => url.includes("/validate"))).toBe(false); transport.cancelAll();
});
