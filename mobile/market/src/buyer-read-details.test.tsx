import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import App from "../App";
import type { MarketSession, MobileReadClient, ReadScope } from "./read-controller";
import { workspaceOrderGroupSchema, workspaceOrderPageSchema } from "../../../packages/schemas/src/workspace-reads";
import { offerComparisonResponseSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { copy, orderGroupLabel, orderGroups } from "./i18n";
import { formatTimestamp } from "./format-wire";

const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const fixture = (id: string): unknown => JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === id)!.payload));
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: "00000000-0000-4000-8000-000000000004", generation: 1 };
function client() {
  return {
    searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-null-price")),
    compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")),
    workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")),
    getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(fixture("order-workflow-minimal")),
  };
}
function session(api = client(), active = scope): MarketSession { return { scope: active, client: api, organizationName: "SYNTHETIC organization" }; }
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise<unknown>(yes => { resolve = yes; }); return { promise, resolve }; }
const cursor = "SYNTHETIC:opaque+/=cursor";

it.each(["ru", "kk"] as const)("uses server order groups/search and retains them through cursor/detail/back in %s", async locale => {
  const api = client(); const t = copy[locale];
  api.workspaceOrders.mockImplementation(async (_role, input) => {
    const page = workspaceOrderPageSchema.parse(fixture("workspace-orders-page"));
    page.nextCursor = input.cursor ? null : cursor;
    page.items[0]!.orderNumber = input.cursor ? "SYNTHETIC page two" : "SYNTHETIC page one";
    return page;
  });
  await render(<App session={session(api)} locale={locale} />);
  await screen.findByText("SYNTHETIC product");
  await fireEvent.changeText(screen.getByLabelText(t.search), "catalog unsent");
  await fireEvent.press(screen.getByRole("tab", { name: t.orders }));
  await screen.findByText("SYNTHETIC page one");
  expect(screen.getByLabelText(t.searchOrders)).toHaveProp("maxLength", 160);
  await fireEvent.changeText(screen.getByLabelText(t.searchOrders), "  exact & /? + қ  ");
  expect(api.workspaceOrders).toHaveBeenCalledTimes(1);
  await fireEvent(screen.getByLabelText(t.searchOrders), "submitEditing");
  await screen.findByText("SYNTHETIC page one");
  await fireEvent.press(screen.getByRole("tab", { name: orderGroupLabel("active", locale) }));
  await screen.findByText("SYNTHETIC page one");
  expect(screen.getByRole("tab", { name: orderGroupLabel("active", locale) })).toHaveProp("accessibilityState", expect.objectContaining({ selected: true }));
  expect(api.workspaceOrders.mock.calls.at(-1)).toEqual(["buyer", { limit: 50, q: "exact & /? + қ", group: "active" }]);
  await fireEvent.press(screen.getByRole("button", { name: t.next }));
  await screen.findByText("SYNTHETIC page two");
  expect(api.workspaceOrders.mock.calls.at(-1)?.[1]).toEqual({ limit: 50, q: "exact & /? + қ", group: "active", cursor });
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC page two` }));
  await screen.findByText(`${t.payment}: ${t.unpaid}`);
  await fireEvent.press(screen.getByRole("button", { name: t.back }));
  await screen.findByText("SYNTHETIC page two");
  expect(api.workspaceOrders.mock.calls.at(-1)?.[1]).toMatchObject({ q: "exact & /? + қ", group: "active", cursor });
  await fireEvent.press(screen.getByRole("button", { name: t.back }));
  await screen.findByText("SYNTHETIC page one");
  expect(api.workspaceOrders.mock.calls.at(-1)?.[1]).not.toHaveProperty("cursor");
  await fireEvent.press(screen.getByRole("tab", { name: t.catalog }));
  await screen.findByText("SYNTHETIC product");
  expect(screen.getByLabelText(t.search)).toHaveProp("value", "catalog unsent");
  await fireEvent.press(screen.getByRole("tab", { name: t.orders }));
  await screen.findByText("SYNTHETIC page one");
  expect(screen.getByLabelText(t.searchOrders)).toHaveProp("value", "  exact & /? + қ  ");
  await fireEvent.press(screen.getByRole("button", { name: t.clear }));
  await screen.findByText("SYNTHETIC page one");
  expect(api.workspaceOrders.mock.calls.at(-1)?.[1]).toEqual({ limit: 50, q: "", group: "active" });
  await fireEvent.press(screen.getByRole("tab", { name: orderGroupLabel(undefined, locale) }));
  await screen.findByText("SYNTHETIC page one");
  expect(api.workspaceOrders.mock.calls.at(-1)?.[1]).toEqual({ limit: 50, q: "" });
});

it("keeps all existing group choices schema-bound and does not locally filter status", async () => {
  expect(orderGroups.filter(group => group !== undefined)).toEqual(workspaceOrderGroupSchema.options);
  const api = client();
  await render(<App session={session(api)} />);
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.orders }));
  await screen.findByText("SYNTHETIC-READ-001");
  for (const group of workspaceOrderGroupSchema.options) {
    await fireEvent.press(screen.getByRole("tab", { name: orderGroupLabel(group, "ru") }));
    await screen.findByText("SYNTHETIC-READ-001");
    expect(api.workspaceOrders.mock.calls.at(-1)?.[1]).toEqual({ limit: 50, q: "", group });
  }
  const count = api.workspaceOrders.mock.calls.length;
  await fireEvent.press(screen.getByRole("tab", { name: orderGroupLabel("cancelled", "ru") }));
  expect(api.workspaceOrders).toHaveBeenCalledTimes(count);
});

it("preserves unsent order draft through filtered errors/retry and mid-request locale change", async () => {
  const api = client(); const pending = deferred();
  await render(<App session={session(api)} />);
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.orders }));
  await screen.findByText("SYNTHETIC-READ-001");
  await fireEvent.changeText(screen.getByLabelText(copy.ru.searchOrders), "applied");
  await fireEvent(screen.getByLabelText(copy.ru.searchOrders), "submitEditing");
  await screen.findByText("SYNTHETIC-READ-001");
  api.workspaceOrders.mockReturnValueOnce(pending.promise);
  await fireEvent.press(screen.getByRole("tab", { name: orderGroupLabel("attention", "ru") }));
  await fireEvent.changeText(screen.getByLabelText(copy.ru.searchOrders), "unsent after request");
  expect(screen.getByRole("tab", { name: orderGroupLabel("active", "ru") })).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  // App's injected locale changes do not replace the query or controller.
  await screen.rerender(<App session={session(api)} locale="kk" />);
  await act(async () => pending.resolve({ items: [], nextCursor: null }));
  await screen.findByText(copy.kk.emptyOrders);
  expect(screen.getByLabelText(copy.kk.searchOrders)).toHaveProp("value", "unsent after request");
  api.workspaceOrders.mockRejectedValueOnce(new Error("SYNTHETIC offline transport detail"));
  await fireEvent.press(screen.getByRole("button", { name: copy.kk.refresh }));
  await screen.findByRole("alert", { name: `${copy.kk.error}. ${copy.kk.errorBody}` });
  expect(screen.queryByText("SYNTHETIC offline transport detail")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: copy.kk.retry }));
  await screen.findByText("SYNTHETIC-READ-001");
  expect(api.workspaceOrders.mock.calls.at(-1)?.[1]).toEqual({ limit: 50, q: "applied", group: "attention" });
  expect(screen.getByLabelText(copy.kk.searchOrders)).toHaveProp("value", "unsent after request");
});

it("drops order filters, drafts and late old-organization response on scope reset", async () => {
  const api = client(); const pending = deferred();
  const rendered = await render(<App session={session(api)} />);
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.orders }));
  await screen.findByText("SYNTHETIC-READ-001");
  await fireEvent.changeText(screen.getByLabelText(copy.ru.searchOrders), "private old draft");
  api.workspaceOrders.mockReturnValueOnce(pending.promise);
  await fireEvent.press(screen.getByRole("tab", { name: orderGroupLabel("active", "ru") }));
  await rendered.rerender(<App session={session(api, { ...scope, generation: 2 })} />);
  await screen.findByText("SYNTHETIC product");
  await act(async () => pending.resolve(fixture("workspace-orders-page")));
  expect(screen.queryByText("SYNTHETIC-READ-001")).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.orders }));
  await screen.findByText("SYNTHETIC-READ-001");
  expect(screen.getByLabelText(copy.ru.searchOrders)).toHaveProp("value", "");
  expect(api.workspaceOrders.mock.calls.at(-1)?.[1]).toEqual({ limit: 50, q: "" });
});

it.each(["ru", "kk"] as const)("shows supplied list/order identity and explicit missing party in %s", async locale => {
  const api = client(); const t = copy[locale];
  const page = workspaceOrderPageSchema.parse(fixture("workspace-orders-page"));
  page.items[0]!.supplier.displayName = "SYNTHETIC exact supplier";
  page.items[0]!.itemCount = 0;
  api.workspaceOrders.mockResolvedValue(page);
  const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
  delete workflow.order.supplier; delete workflow.order.buyer;
  api.getOrderWorkflow.mockResolvedValue(workflow);
  await render(<App session={session(api)} locale={locale} />);
  await fireEvent.press(screen.getByRole("tab", { name: t.orders }));
  await screen.findByText(`${t.supplier}: SYNTHETIC exact supplier`);
  expect(screen.getByText(`${t.itemCount}: 0`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.createdAt}: ${formatTimestamp(page.items[0]!.createdAt, locale)}`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: ${page.items[0]!.orderNumber}` }));
  await screen.findByText(`${t.supplier}: ${t.partyUnknown}`);
  expect(screen.getByText(`${t.buyer}: ${t.partyUnknown}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.createdAt}: ${formatTimestamp(workflow.order.createdAt, locale)}`)).toBeOnTheScreen();
  expect(screen.queryByText(workflow.order.buyerOrganizationId)).toBeNull();
});

it.each(["ru", "kk"] as const)("shows exact offer increment and warehouse update separately from freshness in %s", async locale => {
  const api = client(); const t = copy[locale];
  const comparison = offerComparisonResponseSchema.parse(fixture("comparison-exact-offer"));
  const offer = comparison.offers[0]!;
  offer.orderIncrement = "0.000000000000000000123";
  offer.availability[0]!.updatedAt = "2026-10-29T01:02:03.000Z";
  offer.availability[0]!.freshnessExpiresAt = null;
  api.compareOffers.mockResolvedValue(comparison);
  await render(<App session={session(api)} locale={locale} />);
  await screen.findByText("SYNTHETIC product");
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC product, SYNTHETIC variant` }));
  await screen.findByText("SYNTHETIC supplier");
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` }));
  await screen.findByText(`${t.orderIncrement}: 0.000000000000000000123`);
  expect(screen.getByText(`${t.stockUpdated}: ${formatTimestamp(offer.availability[0]!.updatedAt, locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(t.freshnessUnknown)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: /Купить|Сатып алу|Оформить|Рәсімдеу/ })).toBeNull();
});
