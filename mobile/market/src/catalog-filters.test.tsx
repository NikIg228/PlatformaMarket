import { catalogReadCopy } from "./CatalogRead";
import { searchCatalogSchema } from "../../../packages/schemas/src/index";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import App from "../App";
import { catalogSearchResponseSchema } from "../../../packages/schemas/src/core-api";
import type { MarketSession, MobileReadClient, ReadScope } from "./read-controller";
import { copy } from "./i18n";
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const fixture = (id: string): unknown => JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === id)!.payload));
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: "00000000-0000-4000-8000-000000000004", generation: 1 };
const categoryId = "00000000-0000-4000-8000-000000000040", supplierId = "00000000-0000-4000-8000-000000000041";
function page(offset = 0) {
  const data = catalogSearchResponseSchema.parse(fixture("catalog-null-price")); data.offset = offset; data.limit = 24; data.total = 48;
  data.items[0]!.name = `SYNTHETIC page ${offset ? 2 : 1}`;
  data.facets = { categories: [{ id: categoryId, name: "SYNTHETIC category", count: 999 }], suppliers: [{ id: supplierId, name: "SYNTHETIC supplier filter", count: 999 }] };
  return data;
}
function client() { return { searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockImplementation(async input => page(searchCatalogSchema.parse(input).offset)), compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")), workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")), getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(fixture("order-workflow-minimal")) }; }
function session(api = client(), active = scope): MarketSession { return { scope: active, client: api, organizationName: "SYNTHETIC organization" }; }
async function select(locale: "ru" | "kk", field: "category" | "supplier") {
  const t = copy[locale]; await fireEvent.press(screen.getByRole("button", { name: t.filters }));
  await fireEvent.press(screen.getByRole("tab", { name: field === "category" ? `${t.categoryFilter}: SYNTHETIC category` : `${t.supplierFilter}: SYNTHETIC supplier filter` }));
  await screen.findByText("SYNTHETIC page 1");
}
it.each(["ru", "kk"] as const)("retains actual category/supplier filters through search/pages/exact offer/Back in %s", async locale => {
  const api = client(), t = copy[locale]; await render(<App session={session(api)} locale={locale} />); await screen.findByText("SYNTHETIC page 1");
  await select(locale, "category"); await select(locale, "supplier");
  expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "", offset: 0, categoryId, supplierOrganizationId: supplierId, buyerOrganizationId: scope.organizationId });
  await fireEvent.changeText(screen.getByLabelText(t.search), " exact q "); await fireEvent(screen.getByLabelText(t.search), "submitEditing"); await screen.findByText("SYNTHETIC page 1");
  expect(screen.getByLabelText(t.search)).toHaveProp("maxLength", 240);
  await fireEvent.press(screen.getByRole("button", { name: t.next })); await screen.findByText("SYNTHETIC page 2");
  expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "exact q", offset: 24, categoryId, supplierOrganizationId: supplierId, buyerOrganizationId: scope.organizationId });
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC page 2, SYNTHETIC variant` })); await screen.findByText("SYNTHETIC supplier");
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC supplier` })); await screen.findByText(`${t.minimum}: 0.000001`);
  await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByText("SYNTHETIC supplier");
  await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByText("SYNTHETIC page 2");
  expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toMatchObject({ q: "exact q", offset: 24, categoryId, supplierOrganizationId: supplierId });
  await fireEvent.press(screen.getByRole("button", { name: t.back })); await screen.findByText("SYNTHETIC page 1");
  await fireEvent.press(screen.getByRole("button", { name: t.clear })); await screen.findByText("SYNTHETIC page 1");
  expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toMatchObject({ q: "", offset: 0, categoryId, supplierOrganizationId: supplierId });
});
it("opens/closes or reselects the same filter without a request and never presents facet counts as global totals", async () => {
  const api = client(); await render(<App session={session(api)} />); await screen.findByText("SYNTHETIC page 1");
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.filters }));
  expect(api.searchCatalog).toHaveBeenCalledTimes(1); expect(screen.queryByText(/999/)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.back })); await screen.findByText("SYNTHETIC page 1");
  expect(api.searchCatalog).toHaveBeenCalledTimes(1);
  await select("ru", "category"); expect(api.searchCatalog).toHaveBeenCalledTimes(2);
  await select("ru", "category"); expect(api.searchCatalog).toHaveBeenCalledTimes(2);
});
it("clear filters preserves the applied query and unsent draft and restores an empty filtered result", async () => {
  const api = client(); const filtered = page(); filtered.items = [];
  api.searchCatalog.mockImplementation(async input => input.categoryId ? filtered : page());
  await render(<App session={session(api)} />); await screen.findByText("SYNTHETIC page 1");
  await fireEvent.changeText(screen.getByLabelText(copy.ru.search), "applied"); await fireEvent(screen.getByLabelText(copy.ru.search), "submitEditing"); await screen.findByText("SYNTHETIC page 1");
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.filters })); await fireEvent.press(screen.getByRole("tab", { name: `${copy.ru.categoryFilter}: SYNTHETIC category` })); await screen.findByText(catalogReadCopy.ru.emptyPage);
  await fireEvent.changeText(screen.getByLabelText(copy.ru.search), "unsent");
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.clearFilters })); await screen.findByText("SYNTHETIC page 1");
  expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toEqual({ q: "applied", offset: 0, buyerOrganizationId: scope.organizationId });
  expect(screen.getByLabelText(copy.ru.search)).toHaveProp("value", "unsent"); expect(screen.getByText(`${copy.ru.searchApplied}: applied`)).toBeOnTheScreen();
});
it("uses current locale and the same filter query after pending refresh/offline retry", async () => {
  const api = client(); const rendered = await render(<App session={session(api)} />); await screen.findByText("SYNTHETIC page 1"); await select("ru", "category");
  let reject!: (error: Error) => void; api.searchCatalog.mockReturnValueOnce(new Promise((_yes, no) => { reject = no; }));
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await rendered.rerender(<App session={session(api)} locale="kk" />);
  await act(async () => reject(new Error("SYNTHETIC offline"))); await screen.findByRole("alert", { name: `${copy.kk.error}. ${copy.kk.errorBody}` });
  await fireEvent.press(screen.getByRole("button", { name: copy.kk.retry })); await screen.findByText("SYNTHETIC page 1");
  expect(screen.getByText(`${copy.kk.categoryFilter}: SYNTHETIC category`)).toBeOnTheScreen(); expect(api.searchCatalog.mock.calls.at(-1)?.[0]).toMatchObject({ categoryId });
});
it("shows missing facet choices explicitly and keeps the already-applied filter clearable when its name is absent", async () => {
  const api = client(); api.searchCatalog.mockImplementation(async input => { const data = page(); if (input.categoryId) data.facets = { categories: [], suppliers: [] }; return data; });
  await render(<App session={session(api)} />); await screen.findByText("SYNTHETIC page 1"); await select("ru", "category");
  expect(screen.getByText(`${copy.ru.categoryFilter}: ${copy.ru.filterSelected}`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.filters }));
  expect(screen.getByText(copy.ru.noCategoryChoices)).toBeOnTheScreen(); expect(screen.getByText(copy.ru.noSupplierChoices)).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: copy.ru.clearFilters })).toBeOnTheScreen(); expect(screen.queryByText(categoryId)).toBeNull();
});
it("discards late filtered data and clears selections on session reset", async () => {
  const api = client(); const rendered = await render(<App session={session(api)} />); await screen.findByText("SYNTHETIC page 1"); await select("ru", "category");
  let resolve!: (value: unknown) => void; api.searchCatalog.mockReturnValueOnce(new Promise(yes => { resolve = yes; })); await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh }));
  await rendered.rerender(<App session={session(api, { ...scope, generation: 2 })} />); await screen.findByText("SYNTHETIC page 1"); await act(async () => resolve({ ...page(), items: [] }));
  expect(screen.queryByRole("button", { name: copy.ru.clearFilters })).toBeNull(); expect(api.searchCatalog.mock.calls.at(-1)?.[0]).not.toHaveProperty("categoryId");
});
