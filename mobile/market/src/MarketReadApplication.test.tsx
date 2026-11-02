import { StrictMode } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import { BackHandler } from "react-native";
import App from "../App";
import type { MarketSession, MobileReadClient, ReadScope } from "./read-controller";
import { catalogSearchResponseSchema, offerComparisonResponseSchema } from "../../../packages/schemas/src/core-api";
import { workspaceOrderPageSchema } from "../../../packages/schemas/src/workspace-reads";
import { orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { searchCatalogSchema } from "../../../packages/schemas/src/index";
import { copy } from "./i18n";

const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: Array<{ id: string; payload: unknown }> };
function fixture(id: string): unknown {
  const item = corpus.cases.find((item) => item.id === id);
  if (!item) throw new Error(`Missing fixture ${id}`);
  return JSON.parse(JSON.stringify(item.payload));
}
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: "00000000-0000-4000-8000-000000000004", generation: 1 };
const productId = "00000000-0000-4000-8000-000000000001";
const variantId = "00000000-0000-4000-8000-000000000002";
function client() {
  return {
    searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-null-price")),
    compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")),
    workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")),
    getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(fixture("order-workflow-minimal")),
  };
}
function session(api = client(), active = scope): MarketSession { return { scope: active, client: api, organizationName: "SYNTHETIC organization" }; }
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((yes) => { resolve = yes; });
  return { promise, resolve };
}
const openVariant = async () => {
  await screen.findByText("SYNTHETIC product");
  await fireEvent.press(screen.getByRole("button", { name: "Открыть: SYNTHETIC product, SYNTHETIC variant" }));
  await screen.findByText("SYNTHETIC supplier");
};
const openOrder = async () => {
  await fireEvent.press(screen.getByRole("tab", { name: "Заказы" }));
  await screen.findByText("SYNTHETIC-READ-001");
  await fireEvent.press(screen.getByRole("button", { name: "Открыть: SYNTHETIC-READ-001" }));
};
const cursor = "SYNTHETIC:opaque+/=cursor";
function orderPage(currentCursor?: string, organizationId = scope.organizationId) {
  const page = workspaceOrderPageSchema.parse(fixture("workspace-orders-page"));
  page.items[0]!.buyer.id = organizationId;
  if (!currentCursor) {
    page.items[0]!.id = "00000000-0000-4000-8000-000000000030";
    page.items[0]!.orderNumber = "SYNTHETIC-READ-000";
    page.nextCursor = cursor;
  }
  return page;
}
function paginatedClient() {
  const api = client();
  api.searchCatalog.mockImplementation(async (input) => {
    const { offset } = searchCatalogSchema.parse(input);
    const page = catalogSearchResponseSchema.parse(fixture("catalog-null-price"));
    page.offset = offset; page.limit = 1; page.total = 2;
    page.items[0]!.name = `SYNTHETIC product page ${offset + 1}`;
    // The response echo is intentionally not the user's applied query.
    return page;
  });
  api.workspaceOrders.mockImplementation(async (_role, query) => orderPage(query.cursor));
  return api;
}

describe("organizational buyer mobile read flow", () => {
  it("navigates catalog → exact variant/offer → order status with no purchase actions", async () => {
    const api = client();
    await render(<App session={session(api)} />);
    await openVariant();
    expect(api.compareOffers).toHaveBeenCalledTimes(1);
    expect(api.compareOffers).toHaveBeenCalledWith({ productId, variantId, buyerOrganizationId: scope.organizationId });
    await fireEvent.press(screen.getByRole("button", { name: "Открыть: SYNTHETIC supplier" }));
    expect(await screen.findByText("Минимальный заказ: 0.000001")).toBeOnTheScreen();
    expect(screen.getByText("90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT")).toBeOnTheScreen();
    expect(screen.getByText("Вариант: SYNTHETIC variant")).toBeOnTheScreen();
    expect(screen.getByText("Количество в упаковке: 10")).toBeOnTheScreen();
    expect(screen.getByText("Единица измерения уточняется")).toBeOnTheScreen();
    expect(screen.getByText("Актуальность остатка уточняется")).toBeOnTheScreen();
    expect(screen.getByText("Цена за единицу: 9\u00a0007\u00a0199\u00a0254\u00a0740,993 KZT / SYNTHETIC unit")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Назад" }));
    expect(api.compareOffers).toHaveBeenCalledTimes(1);
    await openOrder();
    expect(await screen.findByText("Оплата: Не оплачено")).toBeOnTheScreen();
    expect(screen.getByText("Сумма заказа: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Купить|Оплатить|Подписать/ })).toBeNull();
  });

  it("exposes loading, empty and explicit query submission using the active organization", async () => {
    const api = client(); const pending = deferred();
    api.searchCatalog.mockReturnValueOnce(pending.promise).mockResolvedValue(fixture("catalog-empty"));
    await render(<App session={session(api)} />);
    expect(screen.getByRole("progressbar")).toBeOnTheScreen();
    await act(async () => { pending.resolve(fixture("catalog-null-price")); });
    await screen.findByText("SYNTHETIC product");
    await fireEvent.changeText(screen.getByLabelText("Найти товар"), "different & exact");
    await fireEvent.press(screen.getByRole("button", { name: "Найти" }));
    expect(await screen.findByText("Товары не найдены")).toBeOnTheScreen();
    expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "different & exact", offset: 0, buyerOrganizationId: scope.organizationId });
    expect(screen.queryByText("SYNTHETIC product")).toBeNull();
  });

  it("renders denial without old order data or server prose and recovers on explicit retry", async () => {
    const api = client();
    api.getOrderWorkflow.mockRejectedValueOnce({ status: 403, payload: fixture("error-denied") });
    await render(<App session={session(api)} />);
    await openOrder();
    expect(await screen.findByText("Нет доступа к этим данным")).toBeOnTheScreen();
    expect(screen.getByRole("alert", { name: `${copy.ru.denied}. ${copy.ru.deniedBody}` })).toBeOnTheScreen();
    expect(screen.queryByText("SYNTHETIC-READ-001")).toBeNull();
    expect(screen.queryByText("SYNTHETIC denial")).toBeNull();
    expect(api.getOrderWorkflow).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("Оплата: Не оплачено")).toBeOnTheScreen();
    expect(api.getOrderWorkflow).toHaveBeenCalledTimes(2);
  });

  it("rejects an incompatible workspace page rather than mapping a future enum", async () => {
    const api = client(); api.workspaceOrders.mockResolvedValueOnce(fixture("workspace-unknown-enum"));
    await render(<App session={session(api)} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Заказы" }));
    expect(await screen.findByText("Не удалось отобразить данные")).toBeOnTheScreen();
    expect(screen.queryByText("SYNTHETIC-READ-001")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("SYNTHETIC-READ-001")).toBeOnTheScreen();
  });

  it.each([
    { ...scope, userId: "00000000-0000-4000-8000-000000000022" },
    { ...scope, organizationId: "00000000-0000-4000-8000-000000000024" },
    { ...scope, environment: "synthetic-other" },
    { ...scope, generation: 2 },
  ])("drops old reads after scope component changes %#", async (active) => {
    const api = client(); const pending = deferred();
    api.searchCatalog.mockReturnValueOnce(pending.promise).mockResolvedValue(fixture("catalog-empty"));
    const rendered = await render(<App session={session(api)} />);
    await rendered.rerender(<App session={session(api, active)} />);
    expect(await screen.findByText("Товары не найдены")).toBeOnTheScreen();
    await act(async () => { pending.resolve(fixture("catalog-null-price")); });
    expect(screen.queryByText("SYNTHETIC product")).toBeNull();
    expect(api.searchCatalog.mock.calls.at(-1)?.[0].buyerOrganizationId).toBe(active.organizationId);
  });

  it("resets navigation for a replacement client even when scope values are identical", async () => {
    const old = client(); const pending = deferred(); old.getOrderWorkflow.mockReturnValueOnce(pending.promise);
    const rendered = await render(<App session={session(old)} />);
    await openOrder();
    const next = client(); next.searchCatalog.mockResolvedValue(fixture("catalog-empty"));
    await rendered.rerender(<App session={session(next)} />);
    expect(await screen.findByText("Товары не найдены")).toBeOnTheScreen();
    await act(async () => { pending.resolve(fixture("order-workflow-minimal")); });
    expect(screen.queryByText("Оплата: Не оплачено")).toBeNull();
    expect(next.getOrderWorkflow).not.toHaveBeenCalled();
  });

  it("works through React StrictMode effect cleanup/replay", async () => {
    await render(<StrictMode><App session={session()} /></StrictMode>);
    expect(await screen.findByText("SYNTHETIC product")).toBeOnTheScreen();
  });

  it("shows throttling without a timer or an automatic request loop", async () => {
    const api = client(); api.searchCatalog.mockRejectedValueOnce({ status: 429, payload: fixture("error-throttled") });
    await render(<App session={session(api)} />);
    expect(await screen.findByText("Слишком много запросов")).toBeOnTheScreen();
    expect(api.searchCatalog).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("SYNTHETIC product")).toBeOnTheScreen();
    expect(api.searchCatalog).toHaveBeenCalledTimes(2);
  });

  it("offers RU/KK copy and no fake session or login action", async () => {
    await render(<App />);
    expect(screen.getByText("Сеанс недоступен")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Войти" })).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
    expect(screen.getByText("Сеанс қолжетімсіз")).toBeOnTheScreen();
  });

  it("does not turn an absent warehouse projection into zero stock", async () => {
    const api = client();
    const comparison = offerComparisonResponseSchema.parse(fixture("comparison-exact-offer"));
    comparison.offers[0]!.availability = [];
    api.compareOffers.mockResolvedValue(comparison);
    await render(<App session={session(api)} />);
    await openVariant();
    await fireEvent.press(screen.getByRole("button", { name: "Открыть: SYNTHETIC supplier" }));
    expect(await screen.findByText("Сведения об остатке уточняются")).toBeOnTheScreen();
    expect(screen.queryByText("Остаток: 0")).toBeNull();
    expect(screen.queryByRole("button", { name: /Купить|Оплатить/ })).toBeNull();
  });

  it.each(["ru", "kk"] as const)("keeps the search draft through error → busy retry → empty results with accessible %s states", async (locale) => {
    const api = client(); const retry = deferred(); const t = copy[locale];
    api.searchCatalog.mockResolvedValueOnce(fixture("catalog-null-price"))
      .mockRejectedValueOnce({ status: 429, payload: fixture("error-throttled") })
      .mockReturnValueOnce(retry.promise);
    await render(<App session={session(api)} locale={locale} />);
    await screen.findByText("SYNTHETIC product");
    await fireEvent.changeText(screen.getByLabelText(t.search), "SYNTHETIC query & exact");
    await fireEvent.press(screen.getByRole("button", { name: t.find }));
    expect(await screen.findByRole("alert", { name: `${t.throttled}. ${t.throttledBody}` })).toBeOnTheScreen();
    expect(screen.getByLabelText(t.search)).toHaveDisplayValue("SYNTHETIC query & exact");
    expect(screen.queryByText("SYNTHETIC product")).toBeNull();
    expect(api.searchCatalog).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByRole("button", { name: t.retry }));
    expect(screen.getByRole("progressbar", { name: t.loading, busy: true })).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText(t.search)).toHaveDisplayValue("SYNTHETIC query & exact");
    await act(async () => { retry.resolve(fixture("catalog-empty")); });
    expect(await screen.findByRole("text", { name: t.emptyCatalog })).toBeOnTheScreen();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByRole("tab", { name: t.catalog, selected: true })).toBeOnTheScreen();
    expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "SYNTHETIC query & exact", offset: 0, buyerOrganizationId: scope.organizationId });
    expect(api.searchCatalog).toHaveBeenCalledTimes(3);
  });

  it.each(["ru", "kk"] as const)("returns to each tab's exact list page and applied query in %s", async (locale) => {
    const api = paginatedClient(); const t = copy[locale];
    await render(<App session={session(api)} locale={locale} />);
    await screen.findByText("SYNTHETIC product page 1");
    await fireEvent.changeText(screen.getByLabelText(t.search), "  SYNTHETIC query & exact  ");
    await fireEvent.press(screen.getByRole("button", { name: t.find }));
    await screen.findByText("SYNTHETIC product page 1");
    await fireEvent.press(screen.getByRole("button", { name: t.next }));
    await screen.findByText("SYNTHETIC product page 2");
    expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "SYNTHETIC query & exact", offset: 1, buyerOrganizationId: scope.organizationId });
    await fireEvent.changeText(screen.getByLabelText(t.search), "SYNTHETIC unsubmitted draft");
    await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC product page 2, SYNTHETIC variant` }));
    await screen.findByText("SYNTHETIC supplier");
    await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` }));
    await screen.findByText(`${t.minimum}: 0.000001`);
    await fireEvent.press(screen.getByRole("tab", { name: t.orders }));
    await screen.findByText("SYNTHETIC-READ-000");
    await fireEvent.press(screen.getByRole("button", { name: t.next }));
    await screen.findByText("SYNTHETIC-READ-001");
    expect(api.workspaceOrders.mock.calls.at(-1)).toEqual(["buyer", { cursor, limit: 50, q: "" }]);
    await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` }));
    await screen.findByText(`${t.payment}: ${t.unpaid}`);
    await fireEvent.press(screen.getByRole("button", { name: t.back }));
    await screen.findByText("SYNTHETIC-READ-001");
    await fireEvent.press(screen.getByRole("tab", { name: t.catalog }));
    await screen.findByText("SYNTHETIC product page 2");
    expect(screen.getByLabelText(t.search)).toHaveDisplayValue("SYNTHETIC unsubmitted draft");
    expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "SYNTHETIC query & exact", offset: 1, buyerOrganizationId: scope.organizationId });
    await fireEvent.press(screen.getByRole("button", { name: t.back }));
    await screen.findByText("SYNTHETIC product page 1");
    expect(api.searchCatalog.mock.calls.at(-1)?.[0].q).toBe("SYNTHETIC query & exact");
    await fireEvent.press(screen.getByRole("button", { name: t.clear }));
    await screen.findByText("SYNTHETIC product page 1");
    expect(screen.getByLabelText(t.search)).toHaveDisplayValue("");
    expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "", offset: 0, buyerOrganizationId: scope.organizationId });
    expect(screen.queryByRole("button", { name: t.back })).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: t.orders }));
    await screen.findByText("SYNTHETIC-READ-001");
    expect(api.workspaceOrders.mock.calls.at(-1)?.[1].cursor).toBe(cursor);
    await fireEvent.press(screen.getByRole("button", { name: t.back }));
    await screen.findByText("SYNTHETIC-READ-000");
    expect(api.workspaceOrders.mock.calls.at(-1)).toEqual(["buyer", { limit: 50, q: "" }]);
    expect(screen.queryByRole("button", { name: t.back })).toBeNull();
  });

  it("keeps hardware Back within the current tab's pages and removes its listener", async () => {
    type Listener = Parameters<typeof BackHandler.addEventListener>[1];
    const listeners = new Set<Listener>();
    const add = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_name, handler) => {
      listeners.add(handler);
      return { remove: () => { listeners.delete(handler); } };
    });
    const pressBack = async () => {
      expect(listeners.size).toBe(1);
      let handled: boolean | undefined;
      await act(async () => { handled = [...listeners][0]!({ type: "hardwareBackPress", timeStamp: 0 }); });
      return handled;
    };
    try {
      const api = paginatedClient();
      const rendered = await render(<App session={session(api)} />);
      await screen.findByText("SYNTHETIC product page 1");
      await fireEvent.press(screen.getByRole("button", { name: "Далее" }));
      await screen.findByText("SYNTHETIC product page 2");
      await fireEvent.press(screen.getByRole("button", { name: "Открыть: SYNTHETIC product page 2, SYNTHETIC variant" }));
      await screen.findByText("SYNTHETIC supplier");
      await fireEvent.press(screen.getByRole("button", { name: "Открыть: SYNTHETIC supplier" }));
      await screen.findByText("Минимальный заказ: 0.000001");
      expect(await pressBack()).toBe(true);
      await screen.findByText("SYNTHETIC supplier");
      expect(api.compareOffers).toHaveBeenCalledTimes(1);
      expect(await pressBack()).toBe(true);
      await screen.findByText("SYNTHETIC product page 2");
      expect(await pressBack()).toBe(true);
      await screen.findByText("SYNTHETIC product page 1");
      expect(await pressBack()).toBe(false);
      await rendered.unmount();
      expect(listeners.size).toBe(0);
    } finally { add.mockRestore(); }
  });

  it("discards a late offer read after switching sections and restores the list context", async () => {
    const api = paginatedClient(); const pending = deferred();
    api.compareOffers.mockReturnValueOnce(pending.promise);
    await render(<App session={session(api)} />);
    await screen.findByText("SYNTHETIC product page 1");
    await fireEvent.press(screen.getByRole("button", { name: "Далее" }));
    await screen.findByText("SYNTHETIC product page 2");
    await fireEvent.press(screen.getByRole("button", { name: "Открыть: SYNTHETIC product page 2, SYNTHETIC variant" }));
    expect(screen.getByRole("progressbar")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("tab", { name: "Заказы" }));
    await screen.findByText("SYNTHETIC-READ-000");
    await act(async () => { pending.resolve(fixture("comparison-exact-offer")); });
    expect(screen.getByText("SYNTHETIC-READ-000")).toBeOnTheScreen();
    expect(screen.queryByText("SYNTHETIC supplier")).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "Каталог" }));
    await screen.findByText("SYNTHETIC product page 2");
    expect(api.searchCatalog.mock.calls.at(-1)?.[0].offset).toBe(1);
  });

  it("clears both saved list histories and drafts when organization/session scope changes", async () => {
    const api = paginatedClient();
    const rendered = await render(<App session={session(api)} />);
    await screen.findByText("SYNTHETIC product page 1");
    await fireEvent.changeText(screen.getByLabelText("Найти товар"), "SYNTHETIC old draft");
    await fireEvent.press(screen.getByRole("button", { name: "Найти" }));
    await screen.findByText("SYNTHETIC product page 1");
    await fireEvent.press(screen.getByRole("button", { name: "Далее" }));
    await screen.findByText("SYNTHETIC product page 2");
    await fireEvent.press(screen.getByRole("tab", { name: "Заказы" }));
    await screen.findByText("SYNTHETIC-READ-000");
    await fireEvent.press(screen.getByRole("button", { name: "Далее" }));
    await screen.findByText("SYNTHETIC-READ-001");
    const active = { ...scope, organizationId: "00000000-0000-4000-8000-000000000024", generation: 2 };
    api.workspaceOrders.mockImplementation(async (_role, query) => orderPage(query.cursor, active.organizationId));
    await rendered.rerender(<App session={session(api, active)} />);
    await screen.findByText("SYNTHETIC product page 1");
    expect(screen.getByLabelText("Найти товар")).toHaveDisplayValue("");
    expect(screen.queryByRole("button", { name: "Назад" })).toBeNull();
    expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "", offset: 0, buyerOrganizationId: active.organizationId });
    await fireEvent.press(screen.getByRole("tab", { name: "Заказы" }));
    await screen.findByText("SYNTHETIC-READ-000");
    expect(api.workspaceOrders.mock.calls.at(-1)).toEqual(["buyer", { limit: 50, q: "" }]);
    expect(screen.queryByRole("button", { name: "Назад" })).toBeNull();
  });

  it.each(["ru", "kk"] as const)("refreshes an empty list explicitly and blocks duplicate presses in %s", async (locale) => {
    const api = client(); const pending = deferred(); const t = copy[locale];
    api.searchCatalog.mockResolvedValueOnce(fixture("catalog-empty")).mockReturnValueOnce(pending.promise);
    await render(<App session={session(api)} locale={locale} />);
    await screen.findByRole("text", { name: t.emptyCatalog });
    expect(api.searchCatalog).toHaveBeenCalledTimes(1);
    const refresh = screen.getByRole("button", { name: t.refresh });
    await act(async () => { await fireEvent.press(refresh); await fireEvent.press(refresh); });
    expect(screen.getByRole("button", { name: t.refresh })).toBeDisabled();
    expect(screen.getByRole("progressbar", { busy: true })).toBeOnTheScreen();
    expect(screen.queryByText(t.emptyCatalog)).toBeNull();
    expect(api.searchCatalog).toHaveBeenCalledTimes(2);
    await act(async () => { pending.resolve(fixture("catalog-null-price")); });
    await screen.findByText("SYNTHETIC product");
    expect(screen.getByRole("button", { name: t.refresh })).toBeEnabled();
    expect(api.searchCatalog).toHaveBeenCalledTimes(2);
  });

  it("refreshes the current order page with its exact opaque cursor", async () => {
    const api = paginatedClient(); const pending = deferred();
    await render(<App session={session(api)} />);
    await screen.findByText("SYNTHETIC product page 1");
    await fireEvent.press(screen.getByRole("tab", { name: "Заказы" }));
    await screen.findByText("SYNTHETIC-READ-000");
    await fireEvent.press(screen.getByRole("button", { name: "Далее" }));
    await screen.findByText("SYNTHETIC-READ-001");
    api.workspaceOrders.mockReturnValueOnce(pending.promise);
    await fireEvent.press(screen.getByRole("button", { name: "Обновить" }));
    expect(api.workspaceOrders.mock.calls.at(-1)).toEqual(["buyer", { cursor, limit: 50, q: "" }]);
    expect(screen.queryByText("SYNTHETIC-READ-001")).toBeNull();
    await act(async () => { pending.resolve(orderPage(cursor)); });
    await screen.findByText("SYNTHETIC-READ-001");
    expect(api.workspaceOrders).toHaveBeenCalledTimes(3);
    await fireEvent.press(screen.getByRole("button", { name: "Назад" }));
    await screen.findByText("SYNTHETIC-READ-000");
  });

  it.each([false, true])("does not replace a removed offer or keep its old price (alternative offered: %s)", async (alternative) => {
    const api = client();
    await render(<App session={session(api)} />);
    await openVariant();
    await fireEvent.press(screen.getByRole("button", { name: "Открыть: SYNTHETIC supplier" }));
    await screen.findByText("Минимальный заказ: 0.000001");
    const changed = offerComparisonResponseSchema.parse(fixture("comparison-no-offer"));
    changed.selectedVariantId = variantId;
    if (alternative) {
      const original = offerComparisonResponseSchema.parse(fixture("comparison-exact-offer")).offers[0]!;
      changed.offers = [{ ...original, offerId: "00000000-0000-4000-8000-000000000031", supplier: { ...original.supplier, name: "SYNTHETIC alternative supplier" } }];
    }
    api.compareOffers.mockResolvedValueOnce(changed);
    await fireEvent.press(screen.getByRole("button", { name: "Обновить" }));
    await screen.findByText("Данные недоступны");
    expect(screen.queryByText("Минимальный заказ: 0.000001")).toBeNull();
    expect(screen.queryByText("SYNTHETIC alternative supplier")).toBeNull();
    expect(screen.queryByText("90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT")).toBeNull();
    expect(api.compareOffers).toHaveBeenCalledTimes(2);
    expect(api.compareOffers.mock.calls.at(-1)?.[0]).toEqual({ productId, variantId, buyerOrganizationId: scope.organizationId });
    expect(screen.queryByRole("button", { name: /Купить|Оплатить/ })).toBeNull();
  });

  it("keeps query/page/draft after refresh failure and recovers through explicit retry", async () => {
    const api = paginatedClient();
    await render(<App session={session(api)} />);
    await screen.findByText("SYNTHETIC product page 1");
    await fireEvent.changeText(screen.getByLabelText("Найти товар"), "SYNTHETIC applied query");
    await fireEvent.press(screen.getByRole("button", { name: "Найти" }));
    await screen.findByText("SYNTHETIC product page 1");
    await fireEvent.press(screen.getByRole("button", { name: "Далее" }));
    await screen.findByText("SYNTHETIC product page 2");
    await fireEvent.changeText(screen.getByLabelText("Найти товар"), "SYNTHETIC unsent draft");
    api.searchCatalog.mockRejectedValueOnce(new Error("SYNTHETIC private network prose"));
    await fireEvent.press(screen.getByRole("button", { name: "Обновить" }));
    await screen.findByRole("alert", { name: `${copy.ru.error}. ${copy.ru.errorBody}` });
    expect(screen.queryByText("SYNTHETIC product page 2")).toBeNull();
    expect(screen.queryByText("SYNTHETIC private network prose")).toBeNull();
    expect(screen.getByLabelText("Найти товар")).toHaveDisplayValue("SYNTHETIC unsent draft");
    expect(api.searchCatalog).toHaveBeenCalledTimes(4);
    await fireEvent.press(screen.getByRole("button", { name: "Повторить" }));
    await screen.findByText("SYNTHETIC product page 2");
    expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "SYNTHETIC applied query", offset: 1, buyerOrganizationId: scope.organizationId });
    expect(api.searchCatalog).toHaveBeenCalledTimes(5);
  });

  it("refreshes only the open order workflow read", async () => {
    const api = client(); const pending = deferred();
    await render(<App session={session(api)} />);
    await openOrder();
    await screen.findByText("Оплата: Не оплачено");
    api.getOrderWorkflow.mockReturnValueOnce(pending.promise);
    await fireEvent.press(screen.getByRole("button", { name: "Обновить" }));
    expect(screen.getByRole("button", { name: "Обновить" })).toBeDisabled();
    expect(screen.queryByText("Сумма заказа: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT")).toBeNull();
    await act(async () => { pending.resolve(fixture("order-workflow-minimal")); });
    await screen.findByText("Оплата: Не оплачено");
    expect(api.getOrderWorkflow.mock.calls).toEqual([["00000000-0000-4000-8000-000000000006"], ["00000000-0000-4000-8000-000000000006"]]);
    expect(api.searchCatalog).toHaveBeenCalledTimes(1);
    expect(api.workspaceOrders).toHaveBeenCalledTimes(1);
    expect(api.compareOffers).not.toHaveBeenCalled();
  });

  it.each([["ru", false], ["ru", true], ["kk", false], ["kk", true]] as const)("keeps a partial order line and its exact financial snapshot in %s (blank name: %s)", async (locale, blank) => {
    const api = client(); const t = copy[locale];
    const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
    if (blank) {
      const item = workflow.order.items[0]!;
      item.offer = { id: item.offerId, productVariant: { id: item.productVariantId, product: { id: productId, canonicalName: "   " } } };
    }
    api.getOrderWorkflow.mockResolvedValue(workflow);
    await render(<App session={session(api)} locale={locale} />);
    await fireEvent.press(screen.getByRole("tab", { name: t.orders }));
    await screen.findByText("SYNTHETIC-READ-001");
    await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` }));
    await screen.findByRole("header", { name: t.itemUnknown });
    expect(screen.getByText(`${t.orderItem} 1`)).toBeOnTheScreen();
    expect(screen.getByText(`${t.quantity}: 1.000001`)).toBeOnTheScreen();
    expect(screen.getByText(`${t.normalized}: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT`)).toBeOnTheScreen();
    expect(screen.getByText(`${t.lineAmount}: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT`)).toBeOnTheScreen();
    expect(screen.getByText(`${t.amount}: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT`)).toBeOnTheScreen();
    expect(screen.queryByText(`${t.quantity}: 0`)).toBeNull();
    expect(screen.queryByRole("button", { name: /Купить|Оплатить|Подписать|Сатып алу|Төлеу/ })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: t.back }));
    await screen.findByText("SYNTHETIC-READ-001");
  });

  it.each(["ru", "kk"] as const)("shows an explicit missing composition without replacing the order total in %s", async locale => {
    const api = client(); const t = copy[locale];
    const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
    workflow.order.items = [];
    api.getOrderWorkflow.mockResolvedValue(workflow);
    await render(<App session={session(api)} locale={locale} />);
    await fireEvent.press(screen.getByRole("tab", { name: t.orders }));
    await screen.findByText("SYNTHETIC-READ-001");
    await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` }));
    await screen.findByRole("text", { name: t.orderItemsUnknown });
    expect(screen.getByText(`${t.amount}: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT`)).toBeOnTheScreen();
    expect(screen.queryByText(`${t.amount}: 0,00 KZT`)).toBeNull();
    expect(screen.getByRole("button", { name: t.refresh })).toBeEnabled();
  });

  it.each([["ru", "USD"], ["kk", "USD"], ["ru", "XYZ"], ["kk", "XYZ"]] as const)("distinguishes genuine zero from unknown currency in a %s order line (%s)", async (locale, currency) => {
    const api = client(); const t = copy[locale];
    const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
    const item = workflow.order.items[0]!;
    item.unitPriceMinor = "0"; item.totalPriceMinor = "0"; item.currency = currency;
    workflow.order.subtotalAmountMinor = "0"; workflow.order.currency = currency;
    api.getOrderWorkflow.mockResolvedValue(workflow);
    await render(<App session={session(api)} locale={locale} />);
    await fireEvent.press(screen.getByRole("tab", { name: t.orders }));
    await screen.findByText("SYNTHETIC-READ-001");
    await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` }));
    const price = currency === "USD" ? "0,00 USD" : t.priceUnknown;
    await screen.findByText(`${t.lineAmount}: ${price}`);
    expect(screen.getByText(`${t.normalized}: ${price}`)).toBeOnTheScreen();
    expect(screen.getByText(`${t.amount}: ${price}`)).toBeOnTheScreen();
    expect(screen.getByText(`${t.quantity}: 1.000001`)).toBeOnTheScreen();
    expect(screen.queryByText(/0,00 KZT/)).toBeNull();
  });

  it("updates an order line's missing name on explicit refresh without replacing its snapshot or route", async () => {
    const api = client();
    await render(<App session={session(api)} />);
    await openOrder();
    await screen.findByText(copy.ru.itemUnknown);
    const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
    const item = workflow.order.items[0]!;
    workflow.version += 1;
    item.offer = { id: item.offerId, productVariant: { id: item.productVariantId, product: { id: productId, canonicalName: "SYNTHETIC restored order name" } } };
    api.getOrderWorkflow.mockResolvedValue(workflow);
    await fireEvent.press(screen.getByRole("button", { name: "Обновить" }));
    await screen.findByText("SYNTHETIC restored order name");
    expect(screen.queryByText(copy.ru.itemUnknown)).toBeNull();
    expect(screen.getByText("Количество: 1.000001")).toBeOnTheScreen();
    expect(screen.getByText("Сумма заказа: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT")).toBeOnTheScreen();
    expect(api.getOrderWorkflow).toHaveBeenCalledTimes(2);
    expect(api.compareOffers).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Назад" }));
    await screen.findByText("SYNTHETIC-READ-001");
  });

  it("does not treat a null offer as the valid absent projection", async () => {
    const api = client(); const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
    api.getOrderWorkflow.mockResolvedValue({ ...workflow, order: { ...workflow.order, items: workflow.order.items.map(item => ({ ...item, offer: null })) } });
    await render(<App session={session(api)} />);
    await openOrder();
    await screen.findByRole("alert", { name: `${copy.ru.contract}. ${copy.ru.contractBody}` });
    expect(screen.queryByText("Количество: 1.000001")).toBeNull();
    expect(screen.queryByText(copy.ru.itemUnknown)).toBeNull();
  });

  it("preserves each wire currency separately without converting or borrowing the order currency", async () => {
    const api = client(); const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
    // An adversarial display-boundary case, not acceptance of mixed-currency accounting.
    workflow.order.items[0]!.currency = "USD";
    api.getOrderWorkflow.mockResolvedValue(workflow);
    await render(<App session={session(api)} />);
    await openOrder();
    await screen.findByText("Сумма позиции: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 USD");
    expect(screen.getByText("Цена за единицу: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 USD")).toBeOnTheScreen();
    expect(screen.getByText("Сумма заказа: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT")).toBeOnTheScreen();
    expect(screen.queryByText("Сумма позиции: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT")).toBeNull();
  });

  it.each([
    ["ru", "PAID", "UNPAID", "Оплачен", "Не оплачено"],
    ["kk", "PAID", "UNPAID", "Төленген", "Төленбеген"],
    ["ru", "AWAITING_CONFIRMATION", "PAID", "Ожидает подтверждения", "Оплачено"],
    ["kk", "AWAITING_CONFIRMATION", "PAID", "Растау күтілуде", "Төленген"],
    ["ru", "PAID", "SYNTHETIC_FUTURE_PAYMENT", "Оплачен", "Сведения об оплате уточняются"],
    ["kk", "PAID", "SYNTHETIC_FUTURE_PAYMENT", "Төленген", "Төлем туралы мәлімет нақтылануда"],
  ] as const)("separates order and payment state in the %s list (%s/%s)", async (locale, status, paymentStatus, orderLabel, payment) => {
    const api = client(); const t = copy[locale];
    const page = workspaceOrderPageSchema.parse(fixture("workspace-orders-page"));
    page.items[0]!.status = status; page.items[0]!.paymentStatus = paymentStatus;
    api.workspaceOrders.mockResolvedValue(page);
    await render(<App session={session(api)} locale={locale} />);
    await fireEvent.press(screen.getByRole("tab", { name: t.orders }));
    await screen.findByText("SYNTHETIC-READ-001");
    expect(screen.getByText(`${t.status}: ${orderLabel}`)).toBeOnTheScreen();
    expect(screen.getByText(`${t.payment}: ${payment}`)).toBeOnTheScreen();
    expect(screen.queryByText(/SYNTHETIC_FUTURE_PAYMENT/)).toBeNull();
    expect(screen.queryByText(new RegExp(`\\b${status}\\b`))).toBeNull();
    expect(screen.queryByRole("button", { name: /Купить|Оплатить|Подписать|Сатып алу|Төлеу/ })).toBeNull();
    expect(api.workspaceOrders).toHaveBeenCalledTimes(1);
  });

  it.each(["ru", "kk"] as const)("keeps unknown open workflow statuses readable without raw values or invented authority in %s", async locale => {
    const api = client(); const t = copy[locale];
    const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
    workflow.status = "SYNTHETIC_FUTURE_ORDER"; workflow.paymentStatus = "SYNTHETIC_FUTURE_PAYMENT";
    api.getOrderWorkflow.mockResolvedValue(workflow);
    await render(<App session={session(api)} locale={locale} />);
    await fireEvent.press(screen.getByRole("tab", { name: t.orders }));
    await screen.findByText("SYNTHETIC-READ-001");
    await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` }));
    await screen.findByText(`${t.status}: ${t.unknownStatus}`);
    expect(screen.getByText(`${t.payment}: ${t.unknownPayment}`)).toBeOnTheScreen();
    expect(screen.getByText(`${t.amount}: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT`)).toBeOnTheScreen();
    expect(screen.getByText(`${t.quantity}: 1.000001`)).toBeOnTheScreen();
    expect(screen.queryByText(/SYNTHETIC_FUTURE/)).toBeNull();
    expect(screen.getByRole("button", { name: t.retry })).toBeEnabled();
    expect(screen.queryByRole("button", { name: t.refresh })).toBeNull();
    expect(api.getOrderWorkflow).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Купить|Оплатить|Подписать|Сатып алу|Төлеу/ })).toBeNull();
  });

  it.each(["ru", "kk"] as const)("shows the freshness deadline with an explicit zone in %s", async locale => {
    const api = client(); const t = copy[locale];
    const comparison = offerComparisonResponseSchema.parse(fixture("comparison-exact-offer"));
    comparison.offers[0]!.availability[0]!.freshnessExpiresAt = "2099-01-01T03:04:05.000Z";
    api.compareOffers.mockResolvedValue(comparison);
    await render(<App session={session(api)} locale={locale} />);
    await screen.findByText("SYNTHETIC product");
    await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC product, SYNTHETIC variant` }));
    await screen.findByText("SYNTHETIC supplier");
    await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` }));
    await screen.findByText(new RegExp(`${t.freshnessExpires}: .*2099.*GMT`));
    expect(screen.queryByText(t.freshnessUnknown)).toBeNull();
  });

  it.each(["ru", "kk"] as const)("keeps an unavailable date formatter from crashing the offer or leaking technical errors in %s", async locale => {
    const api = client(); const t = copy[locale];
    const comparison = offerComparisonResponseSchema.parse(fixture("comparison-exact-offer"));
    comparison.offers[0]!.availability[0]!.freshnessExpiresAt = "2099-01-01T03:04:05.000Z";
    api.compareOffers.mockResolvedValue(comparison);
    const formatter = jest.spyOn(Intl, "DateTimeFormat").mockImplementation(() => { throw new RangeError("SYNTHETIC private formatter error"); });
    try {
      await render(<App session={session(api)} locale={locale} />);
      await screen.findByText("SYNTHETIC product");
      await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC product, SYNTHETIC variant` }));
      await screen.findByText("SYNTHETIC supplier");
      await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` }));
      await screen.findByText(t.freshnessUnknown);
      expect(screen.getByText(`${t.minimum}: 0.000001`)).toBeOnTheScreen();
      expect(screen.queryByText(/Invalid Date|SYNTHETIC private formatter error/)).toBeNull();
    } finally { formatter.mockRestore(); }
  });

  it.each(["ru", "kk"] as const)("recovers an unavailable root catalog without an impossible Back or duplicate retry in %s", async locale => {
    const api = client(); const pending = deferred(); const t = copy[locale];
    api.searchCatalog.mockRejectedValueOnce({ status: 404, payload: fixture("error-not-found") }).mockReturnValueOnce(pending.promise);
    await render(<App session={session(api)} locale={locale} />);
    await screen.findByRole("alert", { name: `${t.unavailable}. ${t.unavailableRootBody}` });
    expect(screen.queryByRole("button", { name: t.back })).toBeNull();
    const retry = screen.getByRole("button", { name: t.retry });
    await act(async () => { await fireEvent.press(retry); await fireEvent.press(retry); });
    expect(api.searchCatalog).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("progressbar", { busy: true })).toBeOnTheScreen();
    await act(async () => { pending.resolve(fixture("catalog-null-price")); });
    await screen.findByText("SYNTHETIC product");
    expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "", offset: 0, buyerOrganizationId: scope.organizationId });
  });

  it("retries the unavailable root order list using the same buyer query", async () => {
    const api = client();
    api.workspaceOrders.mockRejectedValueOnce({ status: 404, payload: fixture("error-not-found") });
    await render(<App session={session(api)} />);
    await screen.findByText("SYNTHETIC product");
    await fireEvent.press(screen.getByRole("tab", { name: "Заказы" }));
    await screen.findByRole("alert", { name: `${copy.ru.unavailable}. ${copy.ru.unavailableRootBody}` });
    expect(screen.queryByText("SYNTHETIC product")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Повторить" }));
    await screen.findByText("SYNTHETIC-READ-001");
    expect(api.workspaceOrders.mock.calls).toEqual([["buyer", { limit: 50, q: "" }], ["buyer", { limit: 50, q: "" }]]);
  });

  it("returns from an unavailable order to the same cursor page without retrying the hidden object", async () => {
    const api = paginatedClient();
    api.getOrderWorkflow.mockRejectedValue({ status: 404, payload: fixture("error-not-found") });
    await render(<App session={session(api)} />);
    await screen.findByText("SYNTHETIC product page 1");
    await fireEvent.press(screen.getByRole("tab", { name: "Заказы" }));
    await screen.findByText("SYNTHETIC-READ-000");
    await fireEvent.press(screen.getByRole("button", { name: "Далее" }));
    await screen.findByText("SYNTHETIC-READ-001");
    await fireEvent.press(screen.getByRole("button", { name: "Открыть: SYNTHETIC-READ-001" }));
    await screen.findByRole("alert", { name: `${copy.ru.unavailable}. ${copy.ru.unavailableBody}` });
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Назад" }));
    await screen.findByText("SYNTHETIC-READ-001");
    expect(api.workspaceOrders.mock.calls.at(-1)?.[1].cursor).toBe(cursor);
    expect(api.getOrderWorkflow).toHaveBeenCalledTimes(1);
  });

  it("switches locale during a pending search without losing applied query or draft and without another request", async () => {
    const api = client(); const pending = deferred();
    api.searchCatalog.mockResolvedValueOnce(fixture("catalog-null-price")).mockReturnValueOnce(pending.promise);
    await render(<App session={session(api)} />);
    await screen.findByText("SYNTHETIC product");
    await fireEvent.changeText(screen.getByLabelText(copy.ru.search), "SYNTHETIC applied query");
    await fireEvent.press(screen.getByRole("button", { name: copy.ru.find }));
    await fireEvent.changeText(screen.getByLabelText(copy.ru.search), "SYNTHETIC unsent draft");
    await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
    expect(screen.getByRole("progressbar", { name: copy.kk.loading, busy: true })).toBeOnTheScreen();
    expect(screen.getByLabelText(copy.kk.search)).toHaveDisplayValue("SYNTHETIC unsent draft");
    expect(api.searchCatalog).toHaveBeenCalledTimes(2);
    await act(async () => { pending.resolve(fixture("catalog-empty")); });
    await screen.findByRole("text", { name: copy.kk.emptyCatalog });
    expect(screen.queryByText(copy.ru.emptyCatalog)).toBeNull();
    expect(api.searchCatalog.mock.calls.at(-1)?.[0].q).toBe("SYNTHETIC applied query");
    await fireEvent.press(screen.getByRole("button", { name: copy.kk.find }));
    await screen.findByText("SYNTHETIC product");
    expect(api.searchCatalog.mock.calls.at(-1)?.[0].q).toBe("SYNTHETIC unsent draft");
    expect(api.searchCatalog).toHaveBeenCalledTimes(3);
  });

  it("uses the current locale for a delayed error and changes its copy without retrying", async () => {
    const api = client(); const pending = deferred();
    api.searchCatalog.mockReturnValueOnce(pending.promise.then(() => { throw { status: 403, payload: fixture("error-denied") }; }));
    await render(<App session={session(api)} />);
    await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
    await act(async () => { pending.resolve(null); });
    await screen.findByRole("alert", { name: `${copy.kk.denied}. ${copy.kk.deniedBody}` });
    expect(screen.queryByText(copy.ru.denied)).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: "RU" }));
    expect(screen.getByRole("alert", { name: `${copy.ru.denied}. ${copy.ru.deniedBody}` })).toBeOnTheScreen();
    expect(api.searchCatalog).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: copy.ru.retry }));
    await screen.findByText("SYNTHETIC product");
    expect(api.searchCatalog).toHaveBeenCalledTimes(2);
  });

  it("keeps the open order and exact money when locale changes without fetching it again", async () => {
    const api = client();
    await render(<App session={session(api)} />);
    await openOrder(); await screen.findByText(`${copy.ru.payment}: ${copy.ru.unpaid}`);
    await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" }));
    expect(screen.getByText(`${copy.kk.payment}: ${copy.kk.unpaid}`)).toBeOnTheScreen();
    expect(screen.getByText(`${copy.kk.quantity}: 1.000001`)).toBeOnTheScreen();
    expect(screen.getByText(`${copy.kk.amount}: 90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT`)).toBeOnTheScreen();
    expect(api.getOrderWorkflow).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: copy.kk.back }));
    await screen.findByText("SYNTHETIC-READ-001");
    expect(api.getOrderWorkflow).toHaveBeenCalledTimes(1);
  });

  it.each(["ru", "kk"] as const)("does not silently apply a deleted draft and keeps explicit Clear reachable in %s", async locale => {
    const api = client(); const t = copy[locale];
    await render(<App session={session(api)} locale={locale} />);
    await screen.findByText("SYNTHETIC product");
    await fireEvent.changeText(screen.getByLabelText(t.search), "SYNTHETIC applied query");
    await fireEvent.press(screen.getByRole("button", { name: t.find }));
    await screen.findByText("SYNTHETIC product");
    await fireEvent.changeText(screen.getByLabelText(t.search), "");
    expect(api.searchCatalog).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: t.find })).toBeDisabled();
    expect(screen.getByRole("button", { name: t.clear })).toBeEnabled();
    await fireEvent(screen.getByLabelText(t.search), "submitEditing");
    await fireEvent.changeText(screen.getByLabelText(t.search), "   ");
    await fireEvent(screen.getByLabelText(t.search), "submitEditing");
    expect(api.searchCatalog).toHaveBeenCalledTimes(2);
    expect(api.searchCatalog.mock.calls.at(-1)?.[0].q).toBe("SYNTHETIC applied query");
    await fireEvent.press(screen.getByRole("button", { name: t.clear }));
    await screen.findByText("SYNTHETIC product");
    expect(api.searchCatalog).toHaveBeenCalledTimes(3);
    expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "", offset: 0, buyerOrganizationId: scope.organizationId });
    expect(screen.getByLabelText(t.search)).toHaveDisplayValue("");
    expect(screen.queryByRole("button", { name: t.clear })).toBeNull();
  });

  it("keeps an applied pending search when its draft is erased and waits for explicit Clear", async () => {
    const api = client(); const pending = deferred();
    api.searchCatalog.mockResolvedValueOnce(fixture("catalog-null-price")).mockReturnValueOnce(pending.promise);
    await render(<App session={session(api)} />);
    await screen.findByText("SYNTHETIC product");
    await fireEvent.changeText(screen.getByLabelText(copy.ru.search), "SYNTHETIC pending query");
    await fireEvent.press(screen.getByRole("button", { name: copy.ru.find }));
    await fireEvent.changeText(screen.getByLabelText(copy.ru.search), "");
    expect(api.searchCatalog).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: copy.ru.clear })).toBeDisabled();
    await fireEvent(screen.getByLabelText(copy.ru.search), "submitEditing");
    expect(api.searchCatalog).toHaveBeenCalledTimes(2);
    await act(async () => { pending.resolve(fixture("catalog-empty")); });
    await screen.findByText(copy.ru.emptyCatalog);
    expect(screen.getByRole("button", { name: copy.ru.clear })).toBeEnabled();
    await fireEvent.press(screen.getByRole("button", { name: copy.ru.clear }));
    await screen.findByText("SYNTHETIC product");
    expect(api.searchCatalog).toHaveBeenCalledTimes(3);
    expect(api.searchCatalog.mock.calls.at(-1)?.[0].q).toBe("");
  });
});
