import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import App from "../App";
import type { MobileReadClient, ReadScope } from "./read-controller";
import { orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { paymentSummarySchema } from "../../../packages/schemas/src/manual-payments";
import { copy, paymentSummaryLabel } from "./i18n";
import { formatMinor } from "./format-wire";
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const fixture = (id: string): unknown => JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === id)!.payload));
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: "00000000-0000-4000-8000-000000000004", generation: 1 };
function client(body: unknown) {
  return {
    searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-empty")),
    compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")),
    workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")),
    getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(body),
  };
}
async function open(locale: "ru" | "kk", api: ReturnType<typeof client>) {
  const t = copy[locale];
  await render(<App session={{ scope, client: api, organizationName: "SYNTHETIC organization" }} locale={locale} />);
  await fireEvent.press(screen.getByRole("tab", { name: t.orders }));
  await screen.findByText("SYNTHETIC-READ-001");
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` }));
}

it.each(["ru", "kk"] as const)("shows exact server payment amounts in %s independently of order/payment status", async locale => {
  const t = copy[locale]; const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
  workflow.paymentStatus = "PAID";
  workflow.paymentSummary = paymentSummarySchema.parse({ status: "PARTIALLY_RECEIVED", confirmedAmountMinor: "90071992547409931234", remainingAmountMinor: "12345678901234567890", overpaidAmountMinor: "0" });
  const api = client(workflow); await open(locale, api);
  await screen.findByText(t.paymentSummary);
  expect(screen.getByText(`${t.payment}: ${t.paid}`)).toBeOnTheScreen();
  expect(screen.getByText(paymentSummaryLabel("PARTIALLY_RECEIVED", locale))).toBeOnTheScreen();
  expect(screen.getByText(`${t.receivedAmount}: ${formatMinor(workflow.paymentSummary.confirmedAmountMinor, workflow.order.currency, locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.remainingAmount}: ${formatMinor(workflow.paymentSummary.remainingAmountMinor, workflow.order.currency, locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.overpaidAmount}: ${formatMinor("0", workflow.order.currency, locale)}`)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: /Оплатить|Подтвердить|Төлеу|Растау/ })).toBeNull();
  expect(api.getOrderWorkflow).toHaveBeenCalledTimes(1);
});

it.each(["ru", "kk"] as const)("keeps missing payment summary unknown in %s even when basic payment status is paid", async locale => {
  const t = copy[locale]; const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
  workflow.paymentStatus = "PAID"; delete workflow.paymentSummary;
  await open(locale, client(workflow));
  await screen.findByText(t.paymentSummaryUnknown);
  expect(screen.getByText(`${t.payment}: ${t.paid}`)).toBeOnTheScreen();
  expect(screen.queryByText(new RegExp(`^${t.receivedAmount}:`))).toBeNull();
  expect(screen.queryByText(new RegExp(`^${t.remainingAmount}:`))).toBeNull();
});

it("never replaces an unknown payment-summary enum with a guessed paid/zero state", async () => {
  const workflow = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
  const api = client({ ...workflow, paymentSummary: { status: "FUTURE_UNSUPPORTED", confirmedAmountMinor: "0", remainingAmountMinor: "0", overpaidAmountMinor: "0" } });
  await open("ru", api);
  await screen.findByRole("alert", { name: `${copy.ru.contract}. ${copy.ru.contractBody}` });
  expect(screen.queryByText(copy.ru.paymentSummary)).toBeNull();
  expect(screen.queryByText("FUTURE_UNSUPPORTED")).toBeNull();
});

it("provides both locales for every actual closed payment-summary status", () => {
  for (const status of paymentSummarySchema.shape.status.options) {
    for (const locale of ["ru", "kk"] as const) {
      expect(paymentSummaryLabel(status, locale).trim().length).toBeGreaterThan(0);
      expect(paymentSummaryLabel(status, locale)).not.toBe(status);
    }
  }
});
