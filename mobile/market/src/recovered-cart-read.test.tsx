import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import App from "../App";
import * as CartUi from "./CartRead";
import { copy } from "./i18n";
import { recoveredCartCopy } from "./recovered-cart-link";
import type { MarketSession, MobileReadClient, ReadScope } from "./read-controller";
import { buyerId, cartId, failedCartId, savedCart, savedPage } from "./test-fixtures/carts";

const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const fixture = (id: string): unknown => JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === id)!.payload));
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: buyerId, generation: 1 };
const cursor = "SYNTHETIC:recovered+/=opaque";
function source() { const cart = savedCart(failedCartId, 4, true); cart.recoveredCartId = cartId; return cart; }
function target() { const cart = savedCart(cartId, 7); cart.items[0]!.quantity = "31.000001"; return cart; }
function client() {
  return {
    searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-empty")),
    compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")),
    workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")),
    getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(fixture("order-workflow-minimal")),
    workspaceCarts: jest.fn<NonNullable<MobileReadClient["workspaceCarts"]>>().mockResolvedValue(savedPage(null, [source()])),
    workspaceCart: jest.fn<NonNullable<MobileReadClient["workspaceCart"]>>().mockResolvedValue(target()),
  };
}
function session(api: MobileReadClient, active = scope): MarketSession { return { client: api, scope: active, organizationName: "SYNTHETIC organization" }; }
async function openPage(api = client(), locale: "ru" | "kk" = "ru") {
  const view = await render(<App session={session(api)} locale={locale} />);
  await fireEvent.press(screen.getByRole("tab", { name: copy[locale].cart }));
  await screen.findByText(recoveredCartCopy[locale].body);
  return view;
}
async function openTarget(locale: "ru" | "kk" = "ru") {
  await fireEvent.press(screen.getByRole("button", { name: `${recoveredCartCopy[locale].open}: ${copy[locale].savedCart} 1` }));
}

it.each(["ru", "kk"] as const)("independently reads the supplied recovered cart and Back rereads the exact page in %s", async locale => {
  const api = client(), t = copy[locale];
  api.workspaceCarts.mockImplementation(async input => savedPage(null, [source()], input.cursor ? null : cursor));
  await openPage(api, locale);
  expect(api.workspaceCart).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: t.next }));
  await screen.findByText(recoveredCartCopy[locale].body);
  const exact = api.workspaceCarts.mock.calls.at(-1)![0];
  await openTarget(locale);
  await screen.findByText(`${t.quantity}: 31.000001`);
  expect(api.workspaceCart).toHaveBeenCalledTimes(1);
  expect(api.workspaceCart).toHaveBeenCalledWith(cartId);
  expect(screen.queryByText(`${t.quantity}: 1.000001`)).toBeNull();
  expect(screen.queryByRole("button", { name: /^(Восстановить|Оформить|Қалпына келтіру|Рәсімдеу)/ })).toBeNull();
  expect(screen.queryByText("SYNTHETIC private pricing")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.back }));
  await screen.findByText(recoveredCartCopy[locale].body);
  expect(api.workspaceCarts.mock.calls.at(-1)![0]).toEqual(exact);
});

it("does not claim that a previously recovered cart is still active or unchanged", async () => {
  const api = client(), cart = target(); cart.status = "CHECKED_OUT"; cart.version = 19;
  api.workspaceCart.mockResolvedValue(cart);
  await openPage(api); await openTarget();
  await screen.findByText(`${copy.ru.snapshotVersion}: 19`);
  expect(screen.queryByRole("button", { name: /Применить|Удалить|Оформить/ })).toBeNull();
});

it("keeps the supplied relationship as metadata when this client has no independent cart reader", async () => {
  const { workspaceCart, ...reads } = client();
  await render(<App session={session(reads)} />);
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart }));
  await screen.findByText(recoveredCartCopy.ru.body);
  expect(screen.queryByRole("button", { name: new RegExp(recoveredCartCopy.ru.open) })).toBeNull();
  expect(workspaceCart).not.toHaveBeenCalled();
});

it.each([403, 404, 429, 500] as const)("shows the existing %s read failure without falling back to the old source items", async status => {
  const api = client();
  api.workspaceCart.mockRejectedValue({ status, payload: { statusCode: status, code: "SYNTHETIC_ERROR", message: "SYNTHETIC private failure", path: `/workspaces/buyer/carts/${cartId}`, timestamp: "2026-10-30T01:02:03.000Z" } });
  await openPage(api); await openTarget();
  const title = status === 403 ? copy.ru.denied : status === 404 ? copy.ru.unavailable : status === 429 ? copy.ru.throttled : copy.ru.error;
  await screen.findByRole("alert", { name: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) });
  expect(screen.queryByText(`${copy.ru.quantity}: 1.000001`)).toBeNull();
  expect(screen.queryByText("SYNTHETIC private failure")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.back }));
  await screen.findByText(recoveredCartCopy.ru.body);
});

it.each(["id", "owner", "line-binding"] as const)("rejects a recovered target with wrong %s through the existing reader", async kind => {
  const api = client(), cart = target();
  if (kind === "id") cart.id = failedCartId;
  if (kind === "owner") cart.buyerOrganizationId = "00000000-0000-4000-8000-000000000099";
  if (kind === "line-binding") cart.items[0]!.cartId = failedCartId;
  api.workspaceCart.mockResolvedValue(cart);
  await openPage(api); await openTarget();
  await screen.findByRole("alert", { name: `${copy.ru.contract}. ${copy.ru.contractBody}` });
  expect(screen.queryByText(`${copy.ru.quantity}: 31.000001`)).toBeNull();
});

it("rejects foreign, retained, and duplicate row callbacks while a current row remains actionable", async () => {
  const real = CartUi.CartWorkspaceRead, pages: Parameters<typeof real>[0][] = [];
  const spy = jest.spyOn(CartUi, "CartWorkspaceRead").mockImplementation(props => { pages.push(props); return real(props); });
  try {
    const api = client(); await openPage(api); const first = pages.at(-1)!;
    await act(async () => first.onRecoveredCart?.({ ...first.page.items[0]! }));
    expect(api.workspaceCart).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh }));
    await screen.findByText(recoveredCartCopy.ru.body);
    await act(async () => first.onRecoveredCart?.(first.page.items[0]!));
    expect(api.workspaceCart).not.toHaveBeenCalled();
    const current = pages.at(-1)!;
    await act(async () => { current.onRecoveredCart?.(current.page.items[0]!); current.onRecoveredCart?.(current.page.items[0]!); });
    await screen.findByText(`${copy.ru.quantity}: 31.000001`);
    expect(api.workspaceCart).toHaveBeenCalledTimes(1);
  } finally { spy.mockRestore(); }
});

it("does not use an old page callback after a tab or session change, or render late target data", async () => {
  const real = CartUi.CartWorkspaceRead, pages: Parameters<typeof real>[0][] = [];
  const spy = jest.spyOn(CartUi, "CartWorkspaceRead").mockImplementation(props => { pages.push(props); return real(props); });
  try {
    const api = client(), view = await openPage(api), first = pages.at(-1)!;
    await fireEvent.press(screen.getByRole("tab", { name: copy.ru.catalog })); await screen.findByText(copy.ru.emptyCatalog);
    await act(async () => first.onRecoveredCart?.(first.page.items[0]!));
    expect(api.workspaceCart).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart })); await screen.findByText(recoveredCartCopy.ru.body);
    let resolve!: (value: unknown) => void;
    api.workspaceCart.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    await openTarget();
    await view.rerender(<App session={session(api, { ...scope, generation: 2 })} />);
    await screen.findByText(copy.ru.emptyCatalog);
    await act(async () => { first.onRecoveredCart?.(first.page.items[0]!); resolve(target()); });
    expect(api.workspaceCart).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(`${copy.ru.quantity}: 31.000001`)).toBeNull();
    expect(screen.queryByRole("button", { name: copy.ru.back })).toBeNull();
  } finally { spy.mockRestore(); }
});

it("shows an invalid supplied self relationship without a link and leaves missing pointers absent", async () => {
  const api = client(), cart = source(); cart.recoveredCartId = cart.id;
  api.workspaceCarts.mockResolvedValue(savedPage(null, [cart]));
  await render(<App session={session(api)} />); await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart }));
  await screen.findByRole("alert", { name: recoveredCartCopy.ru.invalid });
  expect(screen.queryByRole("button", { name: new RegExp(recoveredCartCopy.ru.open) })).toBeNull();
  cart.recoveredCartId = null; api.workspaceCarts.mockResolvedValue(savedPage(null, [cart]));
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await screen.findByText(copy.ru.failedCarts);
  expect(screen.queryByText(recoveredCartCopy.ru.body)).toBeNull();
  expect(api.workspaceCart).not.toHaveBeenCalled();
});
