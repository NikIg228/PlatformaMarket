import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { workspaceOrderPageSchema } from "../../../packages/schemas/src/workspace-reads";
import NativeMarketApp from "./NativeMarketApp";
import { orderInvoiceCopy as invoiceCopy } from "./OrderInvoicesUi";
import { copy } from "./i18n";
import { sessionCopy } from "./session-copy";
import { formatMinor, type Locale } from "./format-wire";
import { api, current, response, server, user, workspace } from "./test-fixtures/market-session";
import { invoiceWorkflow, invoiceResponse, invoiceScope, invoiceIban, invoiceId as id } from "./test-fixtures/order-invoices";
import { listDraftPayload } from "./test-fixtures/list-draft";
import { reviewError } from "./test-fixtures/buyer-review";
jest.mock("expo/fetch", () => ({ fetch: jest.fn(() => { throw Error("Unexpected real native request"); }) }));
function backend(options: { failure?: number; invalid?: "root" | "snapshot" | "preview"; drift?: "version" | "pointer"; uploaded?: boolean } = {}) {
  const workflow = invoiceWorkflow(); if (options.uploaded) workflow.invoiceDocumentId = id(129998); const body = invoiceResponse(workflow);
  if (options.uploaded) body.invoices = [];
  if (options.invalid === "root") body.orderId = id(129999);
  if (options.invalid === "snapshot") body.invoices[0]!.snapshot.orderId = id(129999);
  if (options.invalid === "preview") body.invoices[0]!.status = "PREVIEW";
  if (options.drift === "version") body.orderVersion++; if (options.drift === "pointer") body.currentDocumentId = id(129998);
  const page = workspaceOrderPageSchema.parse({ items: [{ ...workflow.order, supplier: { id: workflow.order.supplierOrganizationId, displayName: "SYNTHETIC invoice supplier" }, buyer: { id: invoiceScope.organizationId, displayName: "SYNTHETIC invoice buyer" }, itemCount: workflow.order.items.length }], nextCursor: null });
  const path = `/supplier-orders/${workflow.orderId}/invoices`, fetcher = server((route, init) => {
    if (route === "/auth/current?workspace=BUYER") return response(current({ user: { ...user, id: invoiceScope.userId }, activeOrganizationId: invoiceScope.organizationId, organizationIds: [invoiceScope.organizationId], workspaces: [workspace(invoiceScope.organizationId)] }));
    if (route.startsWith("/marketplace/search")) return response(listDraftPayload("catalog-empty"));
    if (route.startsWith("/workspaces/buyer/orders")) return response(page);
    if (route === `/supplier-orders/${workflow.orderId}/workflow`) return response(workflow);
    if (route === path) { expect(init.method).toBe("GET"); return options.failure ? response(reviewError(options.failure).payload, options.failure) : response(body); }
    return undefined;
  }); return { workflow, body, fetcher, path };
}
async function open(s: ReturnType<typeof backend>, locale: Locale = "ru") { await render(<StrictMode><NativeMarketApp initialApiUrl={api} fetcher={s.fetcher} reviewUuidProvider={{}} /></StrictMode>); if (locale === "kk") await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" })); await fireEvent.press(await screen.findByRole("tab", { name: copy[locale].orders })); await fireEvent.press(await screen.findByRole("button", { name: `${copy[locale].open}: ${s.workflow.order.orderNumber}` })); await fireEvent.press(await screen.findByRole("tab", { name: copy[locale].documents })); await screen.findByRole("button", { name: invoiceCopy[locale].read }); }
async function read(locale: Locale = "ru") { await fireEvent.press(screen.getByRole("button", { name: invoiceCopy[locale].read })); }
it.each(["ru", "kk"] as const)("reads own native confirmed invoice history only on explicit action and opens exact selectable bank requisites in%s without UUID", async locale => {
  const s = backend(), t = invoiceCopy[locale]; await open(s, locale); expect(s.fetcher.mock.calls.some(([url]) => url.endsWith(s.path))).toBe(false); expect(screen.queryByText(invoiceIban)).toBeNull(); await read(locale); await screen.findByText("SYNTHETIC-INVOICE-2"); expect(screen.getByText(t.current)).toBeOnTheScreen(); expect(screen.getByText(t.superseded)).toBeOnTheScreen(); expect(screen.queryByText(invoiceIban)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-INVOICE-2` })); expect(await screen.findByText(invoiceIban)).toHaveProp("selectable", true); expect(screen.getByText(`${t.bic}: FAKEKZXX`)).toHaveProp("selectable", true); expect(screen.getByText(`${t.kbe}: 17`)).toHaveProp("selectable", true); expect(screen.getByText(`${t.supplier}: SYNTHETIC invoice supplier`)).toBeOnTheScreen(); expect(screen.getAllByText(`${t.total}: ${formatMinor("11600000000000000000", "KZT", locale)}`).length).toBeGreaterThan(0);
  const calls = s.fetcher.mock.calls.filter(([url]) => url.endsWith(s.path)); expect(calls).toHaveLength(1); expect(calls[0][1]).toMatchObject({ method: "GET", credentials: "omit", headers: { authorization: "Bearer synthetic-buyer-access-token" } }); expect(calls[0][1].headers).not.toHaveProperty("x-user-id");
  await fireEvent.press(screen.getByRole("button", { name: t.hide })); expect(screen.queryByText(invoiceIban)).toBeNull(); await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-INVOICE-1` })); await screen.findByText(`${t.number}: SYNTHETIC-INVOICE-1`); expect(s.fetcher.mock.calls.filter(([url, init]) => !url.includes("/auth/") && init.method !== "GET")).toHaveLength(0);
});
it.each(["root", "snapshot", "preview"] as const)("rejects native invoice%s response before displaying private bank requisites", async invalid => { const s = backend({ invalid }), t = invoiceCopy.ru; await open(s); await read(); await screen.findByText(t.issue.contract); expect(screen.queryByText(invoiceIban)).toBeNull(); expect(screen.queryByRole("button", { name: `${t.open}: SYNTHETIC-INVOICE-2` })).toBeNull(); });
it.each(["version", "pointer"] as const)("makes native invoice%s drift explicit and blocks bank detail opening", async drift => { const s = backend({ drift }), t = invoiceCopy.ru; await open(s); await read(); await screen.findByText(t.changed); expect(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-INVOICE-2` })).toBeDisabled(); expect(screen.queryByText(invoiceIban)).toBeNull(); expect(screen.getByRole("button", { name: t.reloadOrder })).toBeEnabled(); });
it("distinguishes a current uploaded invoice outside the generated history from no invoice", async () => { const s = backend({ uploaded: true }), t = invoiceCopy.ru; await open(s); await read(); await screen.findByText(t.missing); expect(screen.getByText(t.empty)).toBeOnTheScreen(); expect(screen.getByText(t.body)).toBeOnTheScreen(); expect(screen.queryByText(t.changed)).toBeNull(); });
it("keeps native invoice403 separate from an empty invoice list or logout", async () => { const s = backend({ failure: 403 }), t = invoiceCopy.ru; await open(s); await read(); await screen.findByText(t.issue.denied); expect(screen.queryByText(t.empty)).toBeNull(); expect(screen.queryByLabelText(sessionCopy.ru.password)).toBeNull(); expect(s.fetcher.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false); });
it("hides invoice bank details after refreshing the parent order until an explicit new invoice read", async () => { const s = backend(), t = invoiceCopy.ru; await open(s); await read(); await fireEvent.press(await screen.findByRole("button", { name: `${t.open}: SYNTHETIC-INVOICE-2` })); await screen.findByText(invoiceIban); await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh })); await screen.findByText(t.stale); expect(screen.queryByText(invoiceIban)).toBeNull(); expect(s.fetcher.mock.calls.filter(([url]) => url.endsWith(s.path))).toHaveLength(1); await fireEvent.press(screen.getByRole("button", { name: t.refresh })); await screen.findByText("SYNTHETIC-INVOICE-2"); expect(screen.queryByText(invoiceIban)).toBeNull(); });
it("clears the selected invoice and private bank details on confirmed native logout", async () => { const s = backend(), t = invoiceCopy.ru; await open(s); await read(); await fireEvent.press(await screen.findByRole("button", { name: `${t.open}: SYNTHETIC-INVOICE-2` })); await screen.findByText(invoiceIban); await fireEvent.press(screen.getByRole("button", { name: sessionCopy.ru.logout })); await screen.findByLabelText(sessionCopy.ru.password); expect(screen.queryByText(invoiceIban)).toBeNull(); expect(screen.queryByText("SYNTHETIC invoice bank")).toBeNull(); });
