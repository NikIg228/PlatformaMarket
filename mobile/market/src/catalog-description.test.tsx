import { fireEvent, render, screen } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { catalogSearchResponseSchema } from "../../../packages/schemas/src/core-api";
import { CatalogListRead, catalogReadCopy } from "./CatalogRead";
import { listDraftComparison, listDraftScope } from "./test-fixtures/list-draft";
import type { MobileReadClient, MarketSession } from "./read-controller";
import { copy } from "./i18n";
import App from "../App";
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
function page(description: string | null) { const value = catalogSearchResponseSchema.parse(corpus.cases.find(item => item.id === "catalog-null-price")!.payload); value.items[0]!.description = description; return value; }
const literal = "  SYNTHETIC <b>001</b> & https://private.example.invalid/file\nҚазақша описание  ";
it.each(["ru", "kk"] as const)("shows product description literally in %s without activating markup, source URLs or another variant", async locale => {
  const value = page(literal); Object.defineProperty(value.items[0]!, "descriptionSources", { get: () => { throw new Error("Description source locator read"); } });
  await render(<CatalogListRead page={value} offset={value.offset} locale={locale} onClear={jest.fn()} onNext={jest.fn()} onVariant={jest.fn()} />);
  expect(screen.getByText(literal, { exact: true, normalizer: text => text })).toBeOnTheScreen();
  expect(screen.getByText(catalogReadCopy[locale].descriptionScope)).toBeOnTheScreen(); expect(screen.queryByRole("link")).toBeNull();
});
it.each([null, "", " \n "])("uses an explicit missing product description for %j without falling back to names or metadata", async description => {
  const value = page(description); value.items[0]!.descriptionSources = { text: "SYNTHETIC hidden source fallback" };
  await render(<CatalogListRead page={value} offset={value.offset} locale="kk" onClear={jest.fn()} onNext={jest.fn()} onVariant={jest.fn()} />);
  expect(screen.getByText(catalogReadCopy.kk.descriptionMissing)).toBeOnTheScreen(); expect(screen.queryByText(catalogReadCopy.kk.descriptionScope)).toBeNull(); expect(screen.queryByText("SYNTHETIC hidden source fallback")).toBeNull();
});
it("rejects an offset-mismatched page before inspecting any description", async () => {
  const value = page("SYNTHETIC old description"), hidden = jest.fn(() => { throw new Error("Mismatched description read"); }); Object.defineProperty(value.items[0]!, "description", { get: hidden });
  await render(<CatalogListRead page={value} offset={value.offset + value.limit} locale="ru" onClear={jest.fn()} onNext={jest.fn()} onVariant={jest.fn()} />);
  expect(screen.getByText(catalogReadCopy.ru.changed)).toBeOnTheScreen(); expect(hidden).not.toHaveBeenCalled();
});
it("does not carry list description into independent comparison; Back reads the current description", async () => {
  const first = page("SYNTHETIC previous catalog description"), next = page("SYNTHETIC refreshed catalog description"), comparison = listDraftComparison();
  const client: MobileReadClient = { workspaceOrders: jest.fn(), getOrderWorkflow: jest.fn(), searchCatalog: jest.fn().mockResolvedValueOnce(first).mockResolvedValue(next), compareOffers: jest.fn(async () => comparison) };
  const session: MarketSession = { scope: listDraftScope, organizationName: "SYNTHETIC", client };
  await render(<App session={session} />); await screen.findByText(first.items[0]!.description!);
  const item = first.items[0]!, variant = item.variants[0]!;
  await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.open}: ${item.name}, ${variant.label}` })); await screen.findByText(comparison.product.name);
  expect(screen.queryByText(first.items[0]!.description!)).toBeNull(); expect(screen.queryByText(catalogReadCopy.ru.description)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.back })); await screen.findByText(next.items[0]!.description!); expect(client.searchCatalog).toHaveBeenCalledTimes(2); expect(screen.queryByText(first.items[0]!.description!)).toBeNull();
});
it("does not keep an old description after refreshed JSON violates the shared nullable-string contract", async () => {
  const first = page("SYNTHETIC valid description"); const bad = page("placeholder"); (bad.items[0] as unknown as { description: unknown }).description = { html: "SYNTHETIC invalid source description" };
  const client: MobileReadClient = { workspaceOrders: jest.fn(), getOrderWorkflow: jest.fn(), searchCatalog: jest.fn().mockResolvedValueOnce(first).mockResolvedValue(bad), compareOffers: jest.fn() };
  await render(<App session={{ scope: listDraftScope, organizationName: "SYNTHETIC", client }} />); await screen.findByText(first.items[0]!.description!);
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await screen.findByText(copy.ru.contract); expect(screen.queryByText(first.items[0]!.description!)).toBeNull(); expect(screen.queryByText("SYNTHETIC invalid source description")).toBeNull();
});
