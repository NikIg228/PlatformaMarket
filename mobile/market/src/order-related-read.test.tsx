import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import App from "../App";
import { orderDocumentKindSchema, orderDocumentResponseSchema, shipmentResponseSchema, shipmentStatusSchema } from "../../../packages/schemas/src/core-api";
import { orderWorkflowResponseSchema } from "../../../packages/schemas/src/order-workflow";
import { orderReturnSchema, returnKindSchema, returnStatusSchema } from "../../../packages/schemas/src/order-returns";
import { paymentReviewStatusSchema } from "../../../packages/schemas/src/manual-payments";
import { createMobileReadSlot } from "../../../contracts/mobile-read/read-adapter";
import type { MarketSession, MobileReadClient, ReadScope } from "./read-controller";
import { claimStatusLabel, copy, documentKindLabel, returnKindLabel, returnStatusLabel, shipmentStatusLabel } from "./i18n";
import { formatMinor, formatTimestamp } from "./format-wire";
const corpus = JSON.parse(readFileSync(resolve(__dirname, "../../../contracts/mobile-read/fixtures.json"), "utf8")) as { cases: { id: string; payload: unknown }[] };
const fixture = (id: string): unknown => JSON.parse(JSON.stringify(corpus.cases.find(item => item.id === id)!.payload));
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: "00000000-0000-4000-8000-000000000004", generation: 1 };
const id = "00000000-0000-4000-8000-000000000060", other = "00000000-0000-4000-8000-000000000061";
const date = "2026-10-29T01:02:03.000Z";
function workflow() {
  const data = orderWorkflowResponseSchema.parse(fixture("order-workflow-minimal"));
  const item = data.order.items[0]!;
  data.order.shipments = [shipmentResponseSchema.parse({ id, supplierOrderId: data.orderId, warehouseId: item.warehouseId,
    shipmentNumber: "SYNTHETIC shipment", method: "CARRIER", status: "PARTIALLY_DELIVERED", trackingNumber: "SYNTHETIC track", carrierName: "SYNTHETIC carrier", pickup: false,
    deliveryWindowStart: date, deliveryWindowEnd: null, recipientName: "SYNTHETIC recipient private", recipientPhone: "SYNTHETIC private phone", dispatchedAt: date, deliveredAt: null, failureReason: null, version: 2,
    items: [{ id: other, shipmentId: id, supplierOrderItemId: item.id, quantity: "9007199254740993.000001", deliveredQuantity: "0.000001" }],
    fulfillmentSteps: [{ id: other, shipmentId: id, type: "DELIVERY", status: "PENDING", sequence: 1, scheduledAt: null, startedAt: null, completedAt: null, notes: null }], createdAt: date, updatedAt: date })];
  data.order.documents = [orderDocumentResponseSchema.parse({ id, supplierOrderId: data.orderId, shipmentId: id, kind: "WAYBILL", format: "PDF", status: "SYNTHETIC_UNVERIFIED_SIGNED", title: "SYNTHETIC waybill", documentNumber: "SYNTHETIC doc 7", version: 7, fileName: "SYNTHETIC private filename", checksumSha256: "a".repeat(64), generatedAt: date, createdAt: date, updatedAt: date, storageKey: "SYNTHETIC private storage", downloadUrl: "https://private.example.invalid/secret" })];
  data.returns = [orderReturnSchema.parse({ id, supplierOrderId: data.orderId, kind: "GOODS", status: "GOODS_RECEIVED", reason: "SYNTHETIC return reason", decisionReason: null, amountMinor: "90071992547409931234", currency: "USD", items: [{ orderItemId: item.id, quantity: "0.000001", condition: "SYNTHETIC condition" }], requestedById: scope.userId, createdAt: date, decidedAt: null, goodsSentAt: date, goodsReceivedAt: date, refundDocumentId: null, refundSentAt: null, refundReceivedAt: null })];
  data.claims = [orderWorkflowResponseSchema.shape.claims.element.parse({ id, invoiceDocumentId: id, documentId: other, amountMinor: "90071992547409931234", currency: "USD", paidAt: date, comment: "SYNTHETIC claim comment", status: "PENDING", createdAt: date, confirmedAt: null, confirmedById: null })];
  return data;
}
function client(body: unknown = workflow()) {
  return { searchCatalog: jest.fn<MobileReadClient["searchCatalog"]>().mockResolvedValue(fixture("catalog-empty")), compareOffers: jest.fn<MobileReadClient["compareOffers"]>().mockResolvedValue(fixture("comparison-exact-offer")), workspaceOrders: jest.fn<MobileReadClient["workspaceOrders"]>().mockResolvedValue(fixture("workspace-orders-page")), getOrderWorkflow: jest.fn<MobileReadClient["getOrderWorkflow"]>().mockResolvedValue(body) };
}
function session(api = client(), active = scope): MarketSession { return { client: api, scope: active, organizationName: "SYNTHETIC organization" }; }
async function open(locale: "ru" | "kk", api: ReturnType<typeof client>) {
  const rendered = await render(<App session={session(api)} locale={locale} />); const t = copy[locale];
  await fireEvent.press(screen.getByRole("tab", { name: t.orders })); await screen.findByText("SYNTHETIC-READ-001");
  await fireEvent.press(screen.getByRole("button", { name: `${t.open}: SYNTHETIC-READ-001` }));
  await screen.findByText(`${t.payment}: ${t.unpaid}`); return rendered;
}

it.each(["ru", "kk"] as const)("reads supplied shipments/doc metadata/returns/claims as separate facts in %s without extra requests", async locale => {
  const data = workflow(), api = client(data), t = copy[locale]; await open(locale, api);
  await fireEvent.press(screen.getByRole("tab", { name: t.shipments }));
  expect(screen.getByText(`${t.shipment}: SYNTHETIC shipment`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.shippedQuantity}: 9007199254740993.000001`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.deliveredQuantity}: 0.000001`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.deliveredAt}: ${t.dateUnknown}`)).toBeOnTheScreen();
  expect(screen.queryByText("SYNTHETIC private phone")).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: t.documents }));
  expect(screen.getByText("SYNTHETIC waybill")).toBeOnTheScreen();
  expect(screen.getByText(`${t.documentVersion}: 7`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.documentHash}: ${"a".repeat(64)}`)).toBeOnTheScreen();
  expect(screen.queryByText("SYNTHETIC_UNVERIFIED_SIGNED")).toBeNull();
  expect(screen.queryByText("SYNTHETIC private storage")).toBeNull();
  expect(screen.queryByText("SYNTHETIC private filename")).toBeNull();
  expect(screen.queryByText(/https:\/\/private/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Скачать|Подписать|Жүктеу|Қол қою/ })).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: t.returns }));
  expect(screen.getByText(`${t.returnAmount}: ${formatMinor(data.returns![0]!.amountMinor, "USD", locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.goodsReceivedAt}: ${formatTimestamp(date, locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.refundReceivedAt}: ${t.dateUnknown}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.quantity}: 0.000001`)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("tab", { name: t.transfers }));
  expect(screen.getByText(`${t.reportedAmount}: ${formatMinor(data.claims[0]!.amountMinor, "USD", locale)}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.transferReceivedAmount}: ${t.amountUnknown}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.confirmedAt}: ${t.dateUnknown}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.payment}: ${t.unpaid}`)).toBeOnTheScreen();
  expect(api.getOrderWorkflow).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: t.back }));
  await screen.findByText("SYNTHETIC-READ-001");
  expect(screen.queryByRole("tab", { name: t.transfers })).toBeNull();
});

it.each(["shipments", "documents", "returns"] as const)("distinguishes absent vs explicitly empty %s", async panel => {
  const data = workflow(), api = client(data); const t = copy.ru;
  delete data.order.shipments; delete data.order.documents; delete data.returns;
  const emptyKey = { shipments: t.shipmentsEmpty, documents: t.documentsEmpty, returns: t.returnsEmpty };
  const unknownKey = { shipments: t.shipmentsUnknown, documents: t.documentsUnknown, returns: t.returnsUnknown };
  api.getOrderWorkflow.mockResolvedValue(data);
  await open("ru", api); await fireEvent.press(screen.getByRole("tab", { name: t[panel] }));
  expect(screen.getByText(unknownKey[panel])).toBeOnTheScreen();
  data.order.shipments = []; data.order.documents = []; data.returns = [];
  await fireEvent.press(screen.getByRole("button", { name: t.refresh }));
  await screen.findByText(emptyKey[panel]); expect(screen.queryByText(unknownKey[panel])).toBeNull();
});

const mismatch = {
  shipmentOrder: (data: ReturnType<typeof workflow>) => { data.order.shipments![0]!.supplierOrderId = other; },
  shipmentLine: (data: ReturnType<typeof workflow>) => { data.order.shipments![0]!.items[0]!.shipmentId = other; },
  shipmentStep: (data: ReturnType<typeof workflow>) => { data.order.shipments![0]!.fulfillmentSteps[0]!.shipmentId = other; },
  documentOrder: (data: ReturnType<typeof workflow>) => { data.order.documents![0]!.supplierOrderId = other; },
  returnOrder: (data: ReturnType<typeof workflow>) => { data.returns![0]!.supplierOrderId = other; },
};
it.each(Object.entries(mismatch))("rejects foreign nested %s before rendering a related read", async (_name, change) => {
  const data = workflow(); change(data); const api = client(data);
  await render(<App session={session(api)} />);
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.orders })); await screen.findByText("SYNTHETIC-READ-001");
  await fireEvent.press(screen.getByRole("button", { name: `${copy.ru.open}: SYNTHETIC-READ-001` }));
  await screen.findByRole("alert", { name: `${copy.ru.contract}. ${copy.ru.contractBody}` });
  expect(screen.queryByRole("tab", { name: copy.ru.shipments })).toBeNull();
  expect(screen.queryByText("SYNTHETIC waybill")).toBeNull();
});
it("uses the same nested identity validation for direct order reads; does not invent required shipment membership for documents", () => {
  const data = workflow(); delete data.order.shipments;
  const slot = createMobileReadSlot(scope);
  slot.complete(slot.begin({ kind: "order", orderId: data.orderId }), { status: 200, body: data.order });
  expect(slot.getState().phase).toBe("ready");
  data.order.documents![0]!.supplierOrderId = other;
  slot.complete(slot.begin({ kind: "order", orderId: data.orderId }), { status: 200, body: data.order });
  expect(slot.getState().phase).toBe("contract-error");
});

it("retains selected workflow section through pending refresh, current-locale error/retry and tabs without refetching on selection", async () => {
  const data = workflow(), api = client(data), t = copy.ru;
  const rendered = await open("ru", api);
  await fireEvent.press(screen.getByRole("tab", { name: t.documents }));
  let resolve!: (value: unknown) => void;
  api.getOrderWorkflow.mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
  await fireEvent.press(screen.getByRole("button", { name: t.refresh }));
  expect(screen.queryByText("SYNTHETIC waybill")).toBeNull();
  await rendered.rerender(<App session={session(api)} locale="kk" />);
  await act(async () => resolve(data));
  await screen.findByText("SYNTHETIC waybill");
  expect(screen.getByRole("tab", { name: copy.kk.documents })).toHaveProp("accessibilityState", expect.objectContaining({ selected: true }));
  api.getOrderWorkflow.mockRejectedValueOnce(new Error("SYNTHETIC offline"));
  await fireEvent.press(screen.getByRole("button", { name: copy.kk.refresh }));
  await screen.findByRole("alert", { name: `${copy.kk.error}. ${copy.kk.errorBody}` });
  await fireEvent.press(screen.getByRole("button", { name: copy.kk.retry }));
  await screen.findByText("SYNTHETIC waybill");
  expect(screen.getByRole("tab", { name: copy.kk.documents })).toHaveProp("accessibilityState", expect.objectContaining({ selected: true }));
  expect(api.getOrderWorkflow).toHaveBeenCalledTimes(4);
});
it("discards a late related response after session generation reset", async () => {
  const api = client(); const rendered = await open("ru", api);
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.documents }));
  let resolve!: (value: unknown) => void;
  api.getOrderWorkflow.mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
  await fireEvent.press(screen.getByRole("button", { name: copy.ru.refresh }));
  await rendered.rerender(<App session={session(api, { ...scope, generation: 2 })} />);
  await screen.findByText(copy.ru.emptyCatalog);
  await act(async () => resolve(workflow()));
  expect(screen.queryByText("SYNTHETIC waybill")).toBeNull();
  expect(screen.queryByRole("tab", { name: copy.ru.documents })).toBeNull();
});
it("keeps invalid hashes/unknown received amounts untrusted and never infers a receipt from a confirmed claim", async () => {
  const data = workflow(); data.order.documents![0]!.checksumSha256 = "SYNTHETIC fake checksum";
  data.claims[0]!.status = "CONFIRMED"; data.claims[0]!.receivedAmountMinor = null;
  const api = client(data); await open("ru", api);
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.documents }));
  expect(screen.getByText(`${copy.ru.documentHash}: ${copy.ru.hashUnknown}`)).toBeOnTheScreen();
  expect(screen.queryByText("SYNTHETIC fake checksum")).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: copy.ru.transfers }));
  expect(screen.getByText(`${copy.ru.transferReceivedAmount}: ${copy.ru.amountUnknown}`)).toBeOnTheScreen();
  expect(screen.getByText(`${copy.ru.payment}: ${copy.ru.unpaid}`)).toBeOnTheScreen();
});
it("has RU/KK labels for all closed shipment/document/return/review schemas", () => {
  for (const locale of ["ru", "kk"] as const) {
    for (const status of shipmentStatusSchema.options) expect(shipmentStatusLabel(status, locale)).not.toBe(status);
    for (const kind of orderDocumentKindSchema.options) expect(documentKindLabel(kind, locale)).not.toBe(kind);
    for (const kind of returnKindSchema.options) expect(returnKindLabel(kind, locale)).not.toBe(kind);
    for (const status of returnStatusSchema.options) expect(returnStatusLabel(status, locale)).not.toBe(status);
    for (const status of paymentReviewStatusSchema.options) expect(claimStatusLabel(status, locale)).not.toBe(status);
  }
});

it.each([
  ["ru", null], ["ru", "0"], ["ru", "0.000001"],
  ["kk", null], ["kk", "0"], ["kk", "0.000001"],
] as const)("keeps agreed quantity %s/%s distinct from requested and never derives it from status", async (locale, accepted) => {
  const data = workflow(), t = copy[locale]; const item = data.order.items[0]!;
  item.acceptedQuantity = accepted; item.decisionReason = "SYNTHETIC composition reason"; item.status = "FUTURE_LINE_STATE";
  await open(locale, client(data));
  expect(screen.getByText(`${t.quantity}: ${item.quantity}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.acceptedQuantity}: ${accepted ?? t.acceptedUnknown}`)).toBeOnTheScreen();
  expect(screen.getByText(`${t.decisionReason}: SYNTHETIC composition reason`)).toBeOnTheScreen();
  expect(screen.queryByText("FUTURE_LINE_STATE")).toBeNull();
  expect(screen.queryByRole("button", { name: /Согласовать|Подтвердить|Келісу|Растау/ })).toBeNull();
});
