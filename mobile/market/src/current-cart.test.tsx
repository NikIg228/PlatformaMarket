import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import App from "../App";
import { createMobileReadSlot, type ReadScope } from "../../../contracts/mobile-read/read-adapter";
import { cartItemResponseSchema, cartResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { workspaceCartPageSchema } from "../../../packages/schemas/src/workspace-reads";
import type { MarketSession, MobileReadClient } from "./read-controller";
import { copy } from "./i18n";

const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const fixture = (id: string) => JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === id)!.payload)) as unknown;
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: "00000000-0000-4000-8000-000000000004", generation: 1 };
const cartId = "00000000-0000-4000-8000-000000000040";
const otherId = "00000000-0000-4000-8000-000000000041";
function cart(version = 1, id = cartId, buyerOrganizationId = scope.organizationId) {
  const item = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal")).order.items[0]!;
  const date = "2026-10-28T00:00:00.000Z";
  return cartResponseSchema.parse({ id, buyerOrganizationId, currency: item.currency, status: "ACTIVE", version, createdById: scope.userId,
    items: [cartItemResponseSchema.parse({ id: item.id, cartId: id, offerId: item.offerId, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor, totalPriceMinor: item.totalPriceMinor, currency: item.currency, priceSource: "SYNTHETIC_SNAPSHOT", priceRuleId: null, pricingSnapshot: null, createdAt: date, updatedAt: date })],
    checkout: null, createdAt: date, updatedAt: date });
}
function page(current: ReturnType<typeof cart> | null = cart(), items: ReturnType<typeof cart>[] = []) {
  return workspaceCartPageSchema.parse({ current, items, nextCursor: null });
}
function api() {
  return {
    searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-empty")),
    compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")),
    workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")),
    getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(fixture("order-workflow-minimal")),
    workspaceCarts: jest.fn<NonNullable<MobileReadClient["workspaceCarts"]>>().mockResolvedValue(page()),
  };
}
function session(client = api(), active = scope): MarketSession { return { client, scope: active, organizationName: "SYNTHETIC organization" }; }

it.each(["ru", "kk"] as const)("reads current cart snapshots in %s without totals, creation or checkout", async locale => {
  const client = api(); const t = copy[locale];
  await render(<App session={session(client)} locale={locale} />);
  await screen.findByText(t.emptyCatalog);
  await fireEvent.press(screen.getByRole("tab", { name: t.cart }));
  await screen.findByRole("text", { name: `${t.currentCart}. ${t.cartReadOnly}` });
  expect(screen.getByText(`${t.snapshotVersion}: 1`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.quantity}: 1.000001`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.lineAmount}: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT`)).toBeOnTheScreen();
  expect(screen.getByText(t.itemUnknown)).toBeOnTheScreen();
  expect(client.workspaceCarts).toHaveBeenCalledWith({ limit: 1, q: "" });
  expect(screen.queryByRole("button", { name: /Купить|Оплатить|Оформить|Создать|Төлеу|Рәсімдеу/ })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: t.refresh }));
  await screen.findByText(`${t.snapshotVersion}: 1`);
  expect(client.workspaceCarts).toHaveBeenCalledTimes(2);
});

it("does not show failed-history carts as the current cart or create a cart for an empty pointer", async () => {
  const client = api(); const failed = cart(1, otherId); failed.status = "ABANDONED"; failed.checkout = { id: otherId, status: "FAILED" };
  client.workspaceCarts.mockResolvedValue(page(null, [failed]));
  await render(<App session={session(client)} />);
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart }));
  await screen.findByRole("text", { name: `${copy.ru.noCurrentCart}. ${copy.ru.cartReadOnly}` });
  expect(screen.queryByText(`${copy.ru.quantity}: 1.000001`)).toBeNull();
  expect(client.workspaceCarts).toHaveBeenCalledTimes(1);
});

it.each(["current", "history"] as const)("rejects a foreign organization in %s cart data", kind => {
  const slot = createMobileReadSlot(scope); const foreign = cart(1, otherId, otherId);
  const ticket = slot.begin({ kind: "workspace-carts" });
  slot.complete(ticket, { status: 200, body: kind === "current" ? page(foreign) : page(cart(), [foreign]) });
  expect(slot.getState().phase).toBe("contract-error");
});

it("compares versions only for the same current cart and accepts a new pointer with a lower version", () => {
  const slot = createMobileReadSlot(scope);
  const apply = (body: unknown) => slot.complete(slot.begin({ kind: "workspace-carts" }), { status: 200, body });
  apply(page(cart(7))); apply(page(cart(6)));
  let state = slot.getState(); expect("read" in state && state.read.kind === "workspace-carts" && state.read.value.current?.version).toBe(7);
  apply(page(cart(1, otherId)));
  state = slot.getState(); expect("read" in state && state.read.kind === "workspace-carts" && state.read.value.current?.id).toBe(otherId);
  apply(page(null)); expect(slot.getState().phase).toBe("empty");
});

it("ignores an old cart response after a reset and clears its data", () => {
  const slot = createMobileReadSlot(scope); const old = slot.begin({ kind: "workspace-carts" });
  slot.reset({ ...scope, organizationId: otherId, generation: 2 });
  expect(slot.complete(old, { status: 200, body: page() })).toBe("discarded");
  expect(slot.getState().phase).toBe("idle");
});

it("hides old cart data during refresh, exposes a safe error and keeps explicit retry", async () => {
  const client = api(); let finish!: (value: unknown) => void;
  await render(<App session={session(client)} />);
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart }));
  await screen.findByText(`${copy.ru.snapshotVersion}: 1`);
  client.workspaceCarts.mockReturnValueOnce(new Promise(yes => { finish = yes; }));
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh }));
  expect(screen.queryByText(`${copy.ru.quantity}: 1.000001`)).toBeNull();
  expect(screen.getByRole("progressbar", { busy: true })).toBeOnTheScreen();
  await act(async () => { finish({ current: { invalid: true }, items: [], nextCursor: null }); });
  await screen.findByRole("alert", { name: `${copy.ru.contract}. ${copy.ru.contractBody}` });
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.retry }));
  await screen.findByText(`${copy.ru.snapshotVersion}: 1`);
  expect(client.workspaceCarts).toHaveBeenCalledTimes(3);
});

it("resets the current-cart view on organization change instead of reusing its request", async () => {
  const client = api(); const rendered = await render(<App session={session(client)} />);
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.cart }));
  await screen.findByText(`${copy.ru.snapshotVersion}: 1`);
  await rendered.rerender(<App session={session(client, { ...scope, organizationId: otherId, generation: 2 })} />);
  await screen.findByText(copy.ru.emptyCatalog);
  expect(screen.queryByText(`${copy.ru.snapshotVersion}: 1`)).toBeNull();
  expect(client.workspaceCarts).toHaveBeenCalledTimes(1);
});
