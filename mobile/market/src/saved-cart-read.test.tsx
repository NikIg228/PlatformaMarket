import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import App from "../App";
import type { MarketSession, MobileReadClient, ReadScope } from "./read-controller";
import { savedCart, savedCheckout, savedPage, cartId, failedCartId, checkoutId, buyerId } from "./test-fixtures/carts";
import { copy, checkoutReadStatusLabel } from "./i18n";
import { formatMinor } from "./format-wire";
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const fixture = (id: string): unknown => JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === id)!.payload));
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: buyerId, generation: 1 };
const cursor = "SYNTHETIC:failed+/=opaque", secondCartId = "00000000-0000-4000-8000-000000000042", secondCheckoutId = "00000000-0000-4000-8000-000000000051";
function client() { return { searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-empty")), compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")), workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")), getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(fixture("order-workflow-minimal")), workspaceCarts: jest.fn<NonNullable<MobileReadClient["workspaceCarts"]>>().mockResolvedValue(savedPage(null)), workspaceCart: jest.fn<NonNullable<MobileReadClient["workspaceCart"]>>().mockResolvedValue(savedCart(failedCartId, 2, true)), getCheckout: jest.fn<NonNullable<MobileReadClient["getCheckout"]>>().mockResolvedValue(savedCheckout()) }; }
function session(api = client(), active = scope): MarketSession { return { client: api, scope: active, organizationName: "SYNTHETIC organization" }; }
async function openCart(locale: "ru" | "kk", api = client()) { const rendered = await render(<App session={session(api)} locale={locale} />); await fireEvent.press(screen.getByRole("tab", { name: copy[locale].cart })); await screen.findByText(copy[locale].failedCarts); return rendered; }
async function openDetail(locale: "ru" | "kk") { const t = copy[locale]; await fireEvent.press(screen.getByRole("button", { name: `${t.open}: ${t.savedCart} 1` })); await screen.findByRole("text", { name: `${t.cartSnapshot}. ${t.cartSnapshotBody}` }); }

it.each(["ru", "kk"] as const)("shows only failed-page records separately and retains opaque page through cart/result/order/Back in %s", async locale => {
  const api = client(), t = copy[locale]; const second = savedCart(secondCartId, 4, true); second.checkout!.id = secondCheckoutId;
  api.workspaceCarts.mockImplementation(async input => input.cursor ? savedPage(null, [second]) : savedPage(null, [savedCart(failedCartId, 2, true)], cursor));
  api.workspaceCart.mockResolvedValue(second); api.getCheckout.mockResolvedValue(savedCheckout(secondCheckoutId, secondCartId));
  await openCart(locale, api); expect(screen.getByRole("text", { name: `${t.noCurrentCart}. ${t.cartReadOnly}` })).toBeOnTheScreen();
  expect(screen.queryByText(`${t.quantity}: 1.000001`)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.next })); await screen.findByText(`${t.savedCartVersion}: 4`);
  expect(api.workspaceCarts.mock.calls.at(-1)?.[0]).toEqual({ limit: 1, q: "", cursor });
  await openDetail(locale); expect(api.workspaceCart).toHaveBeenLastCalledWith(secondCartId);
  expect(screen.getByText(`${t.quantity}: 1.000001`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: t.openSavedCheckout })); await screen.findByRole("text", { name: `${t.savedCheckout}. ${t.checkoutSnapshotBody}` });
  expect(api.getCheckout).toHaveBeenLastCalledWith(secondCheckoutId);
  expect(screen.getByText(`${t.checkoutSnapshotAmount}: ${formatMinor("90071992547409931234", "USD", locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.checkoutState}: ${checkoutReadStatusLabel("FAILED", locale)}`)).toBeOnTheScreen();
  for (const secret of ["SYNTHETIC private idempotency", "SYNTHETIC private failure", "SYNTHETIC private payment", "SYNTHETIC private pricing"]) expect(screen.queryByText(secret)).toBeNull();
  expect(screen.queryByText(/https:\/\/private/)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` })); await screen.findByText(`${t.payment}: ${t.unpaid}`);
  await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByRole("text", { name: `${t.savedCheckout}. ${t.checkoutSnapshotBody}` });
  await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByRole("text", { name: `${t.cartSnapshot}. ${t.cartSnapshotBody}` });
  await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByText(`${t.savedCartVersion}: 4`);
  expect(api.workspaceCarts.mock.calls.at(-1)?.[0]).toMatchObject({ cursor });
  await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByText(`${t.savedCartVersion}: 2`);
  expect(api.workspaceCarts.mock.calls.at(-1)?.[0]).not.toHaveProperty("cursor");
  expect(screen.queryByRole("button", { name: /Оплатить|Оформить|Восстановить|Төлеу|Қалпына келтіру/ })).toBeNull();
});
it("keeps the current cart when the failed page is empty and opens its real detail without fabricating a result", async () => {
  const api = client(); api.workspaceCarts.mockResolvedValue(savedPage(savedCart(), [])); api.workspaceCart.mockResolvedValue(savedCart());
  await openCart("ru", api); expect(screen.getByText(copy.ru.failedCartsEmpty)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.cartDetails })); await screen.findByText(copy.ru.checkoutUnavailable);
  expect(api.workspaceCart).toHaveBeenCalledWith(cartId); expect(api.getCheckout).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: copy.ru.openSavedCheckout })).toBeNull();
});
it("shows empty snapshot/empty saved order projection without inventing totals or recovery actions", async () => {
  const api = client(), cart = savedCart(failedCartId, 2, true), result = savedCheckout(); cart.items = []; result.supplierOrders = [];
  api.workspaceCart.mockResolvedValue(cart); api.getCheckout.mockResolvedValue(result);
  await openCart("ru", api); await openDetail("ru"); expect(screen.getByText(copy.ru.snapshotItemsEmpty)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.openSavedCheckout })); await screen.findByText(copy.ru.checkoutOrdersEmpty);
  expect(screen.queryByRole("button", { name: /Восстановить|Оформить|Создать/ })).toBeNull();
});
it("keeps future open states readable with safe labels and no raw values or implied payment", async () => {
  const api = client(), cart = savedCart(failedCartId, 2, true), result = savedCheckout(); cart.status = "__proto__"; cart.checkout!.status = "FUTURE_RESULT"; result.status = "FUTURE_RESULT"; result.supplierOrders[0]!.paymentStatus = "FUTURE_PAYMENT";
  api.workspaceCart.mockResolvedValue(cart); api.getCheckout.mockResolvedValue(result);
  await openCart("kk", api); await openDetail("kk"); expect(screen.queryByText("__proto__")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: copy.kk.openSavedCheckout })); await screen.findByRole("text", { name: `${copy.kk.savedCheckout}. ${copy.kk.checkoutSnapshotBody}` });
  expect(screen.getByText(`${copy.kk.checkoutState}: ${copy.kk.unknownStatus}`)).toBeOnTheScreen(); expect(screen.getByText(`${copy.kk.payment}: ${copy.kk.unknownPayment}`)).toBeOnTheScreen();
  expect(screen.queryByText("FUTURE_RESULT")).toBeNull(); expect(screen.queryByText("FUTURE_PAYMENT")).toBeNull();
});
it("retains saved-result identity through pending locale change, offline error and explicit retry", async () => {
  const api = client(); const rendered = await openCart("ru", api); await openDetail("ru");
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.openSavedCheckout })); await screen.findByRole("text", { name: `${copy.ru.savedCheckout}. ${copy.ru.checkoutSnapshotBody}` });
  let reject!: (error: Error) => void; api.getCheckout.mockReturnValueOnce(new Promise((_yes, no) => { reject = no; }));
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); expect(screen.queryByText(new RegExp(`^${copy.ru.checkoutSnapshotAmount}:`))).toBeNull();
  await rendered.rerender(<App session={session(api)} locale="kk" />); await act(async () => reject(new Error("SYNTHETIC private failure")));
  await screen.findByRole("alert", { name: `${copy.kk.error}. ${copy.kk.errorBody}` }); await fireEvent.press(screen.getByRole("button", { name: copy.kk.retry }));
  await screen.findByRole("text", { name: `${copy.kk.savedCheckout}. ${copy.kk.checkoutSnapshotBody}` }); expect(api.getCheckout).toHaveBeenLastCalledWith(checkoutId);
});
it("uses the actual prior cart screen for unavailable saved results and preserves Back", async () => {
  const api = client(); api.getCheckout.mockRejectedValue({ status: 404, payload: { statusCode: 404, code: "NOT_FOUND", message: "SYNTHETIC private unavailable", path: `/checkouts/${checkoutId}`, timestamp: "2026-10-29T01:02:03.000Z" } });
  await openCart("ru", api); await openDetail("ru"); await fireEvent.press(screen.getByRole("button", { name: copy.ru.openSavedCheckout }));
  await screen.findByRole("alert", { name: `${copy.ru.unavailable}. ${copy.ru.cartPreviousPage}` });
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.back })); await screen.findByRole("text", { name: `${copy.ru.cartSnapshot}. ${copy.ru.cartSnapshotBody}` });
});
it("drops late saved-result data and cart history after session generation reset", async () => {
  const api = client(); const rendered = await openCart("ru", api); await openDetail("ru"); let resolve!: (value: unknown) => void;
  api.getCheckout.mockReturnValueOnce(new Promise(yes => { resolve = yes; })); await fireEvent.press(screen.getByRole("button", { name: copy.ru.openSavedCheckout }));
  await rendered.rerender(<App session={session(api, { ...scope, generation: 2 })} />); await screen.findByText(copy.ru.emptyCatalog); await act(async () => resolve(savedCheckout()));
  expect(screen.queryByText(new RegExp(`^${copy.ru.checkoutSnapshotAmount}:`))).toBeNull(); expect(screen.queryByRole("button", { name: copy.ru.back })).toBeNull();
});

it.each(["ru", "kk"] as const)("stops repeated cart-page cursor progress and waits for explicit recovery in %s", async locale => {
  const api = client(), t = copy[locale]; api.workspaceCarts.mockResolvedValue(savedPage(null, [savedCart(failedCartId, 2, true)], cursor));
  await openCart(locale, api); await fireEvent.press(screen.getByRole("button", { name: t.next }));
  await screen.findByRole("alert", { name: `${t.cartPagePartial}. ${t.cartPageRecovery}` });
  expect(screen.queryByRole("button", { name: t.next })).toBeNull(); expect(api.workspaceCarts).toHaveBeenCalledTimes(2);
  await fireEvent.press(screen.getByRole("button", { name: t.retry })); await screen.findByRole("alert", { name: `${t.cartPagePartial}. ${t.cartPageRecovery}` });
  expect(api.workspaceCarts.mock.calls.at(-1)?.[0]).toMatchObject({ cursor }); expect(api.workspaceCarts).toHaveBeenCalledTimes(3);
});
it("does not turn an empty failed page with a real next cursor into a fictitious end of all history", async () => {
  const api = client(); api.workspaceCarts.mockImplementation(async input => input.cursor ? savedPage(null) : savedPage(null, [], cursor));
  await openCart("ru", api); expect(screen.getByText(copy.ru.failedCartsEmpty)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.next })); await screen.findByText(`${copy.ru.savedCartVersion}: 2`);
  expect(api.workspaceCarts.mock.calls.at(-1)?.[0]).toMatchObject({ cursor });
});
