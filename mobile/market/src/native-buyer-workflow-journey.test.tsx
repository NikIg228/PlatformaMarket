import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { orderWorkflowCommandSchema, type OrderWorkflowResponse } from "../../../packages/schemas/src/order-workflow";
import { workspaceOrderPageSchema } from "../../../packages/schemas/src/workspace-reads";
import NativeMarketApp from "./NativeMarketApp";
import type { GoodsReturnInput } from "./order-workflow-command-fixture";
import type { MoneyReturnInput } from "./money-return-command";
import { nativeCancellationCommandCopy as cancellation } from "./OrderCancellationCommandUi";
import { nativeReceiptCommandCopy as receipt } from "./ShipmentReceiptCommandUi";
import { nativeGoodsReturnCommandCopy as goods } from "./GoodsReturnCommandUi";
import { nativeMoneyReturnCopy as money } from "./MoneyReturnCommandUi";
import { nativeReturnSendCopy as sendReturn } from "./ReturnSendCommandUi";
import { nativeRefundReceiveCopy as refund } from "./RefundReceiveCommandUi";
import { nativeReorderCopy as reorder } from "./OrderReorderCommandUi";
import { nativeCompositionCopy as composition } from "./OrderCompositionCommandUi";
import { nativeDisputeCopy as dispute } from "./PaymentDisputeCommandUi";
import { cancellationCopy } from "./OrderCancellationDraftUi";
import { receiptDraftCopy } from "./ShipmentReceiptDraftUi";
import { goodsReturnCopy } from "./GoodsReturnDraftUi";
import { copy } from "./i18n";
import { sessionCopy } from "./session-copy";
import type { Locale } from "./format-wire";
import { api, current, response, server, user, workspace } from "./test-fixtures/market-session";
import { listDraftPayload, listDraftId as id } from "./test-fixtures/list-draft";
import { commandEnvelope } from "./test-fixtures/support-commands";
import * as cancelSource from "./test-fixtures/order-cancellation-command";
import * as receiptSource from "./test-fixtures/shipment-receipt-command";
import * as goodsSource from "./test-fixtures/goods-return-command";
import * as moneySource from "./test-fixtures/money-return-command";
import * as sendSource from "./test-fixtures/return-send-command";
import * as refundSource from "./test-fixtures/refund-receive-command";
import * as reorderSource from "./test-fixtures/order-reorder-command";
import * as compositionSource from "./test-fixtures/order-composition-command";
import * as disputeSource from "./test-fixtures/payment-dispute-command";
jest.mock("expo/fetch", () => ({ fetch: jest.fn(() => { throw Error("Unexpected real native request"); }) }));
const modes = ["CANCEL", "RECEIVE_SHIPMENT", "GOODS", "CANCELLATION", "OVERPAYMENT", "SEND_RETURN_GOODS", "RECEIVE_MANUAL_REFUND", "REORDER", "ACCEPT_COMPOSITION", "OPEN_PAYMENT_DISPUTE"] as const;
type Mode = typeof modes[number];
const rawReason = "  SYNTHETIC native order reason  ";
function initial(mode: Mode): OrderWorkflowResponse {
  switch (mode) { case "CANCEL": return cancelSource.cancellationCommandWorkflow(); case "RECEIVE_SHIPMENT": return receiptSource.receiptCommandWorkflow(); case "GOODS": return goodsSource.goodsCommandWorkflow(); case "CANCELLATION": case "OVERPAYMENT": return moneySource.moneyReturnWorkflow(); case "SEND_RETURN_GOODS": return sendSource.returnSendWorkflow(); case "RECEIVE_MANUAL_REFUND": return refundSource.refundReceiveWorkflow(); case "REORDER": return reorderSource.reorderWorkflow(); case "ACCEPT_COMPOSITION": return compositionSource.compositionWorkflow(); case "OPEN_PAYMENT_DISPUTE": return disputeSource.disputeWorkflow(); }
}
function backend(mode: Mode, options: { failure?: number; foreign?: boolean } = {}) {
  let truth = initial(mode), effects = 0; const original = initial(mode), scope = cancelSource.cancellationCommandScope, writes: { body: string; init: RequestInit }[] = [], receipts = new Map<string, unknown>();
  const fetcher = server((path, init) => {
    if (path === "/auth/current?workspace=BUYER") return response(current({ user: { ...user, id: scope.userId }, activeOrganizationId: scope.organizationId, organizationIds: [scope.organizationId], workspaces: [workspace(scope.organizationId)] }));
    if (path.startsWith("/marketplace/search")) return response(listDraftPayload("catalog-empty"));
    if (path.startsWith("/workspaces/buyer/orders")) return response(workspaceOrderPageSchema.parse({ items: [{ ...truth.order, supplier: { id: truth.order.supplierOrganizationId, displayName: "SYNTHETIC supplier" }, buyer: { id: scope.organizationId, displayName: "SYNTHETIC buyer" }, itemCount: truth.order.items.length }], nextCursor: null }));
    if (path.startsWith("/workspaces/buyer/carts?")) return response(reorderSource.reorderWorkspace());
    if (path === `/supplier-orders/${truth.orderId}/workflow`) {
      if (init.method === "GET") return response(truth);
      writes.push({ body: String(init.body), init }); if (options.failure === 403 || options.failure === 409) return response(commandEnvelope(options.failure).payload, options.failure);
      const input = orderWorkflowCommandSchema.parse(JSON.parse(String(init.body))); let result: unknown = receipts.get(input.idempotencyKey);
      if (!result) {
        switch (input.action) {
          case "CANCEL": result = cancelSource.cancellationCommandResult(truth.orderId, input); truth = cancelSource.cancelledCommandWorkflow(input, truth); break;
          case "RECEIVE_SHIPMENT": result = receiptSource.receiptCommandResult(truth.orderId, input); truth = receiptSource.receivedCommandWorkflow(input, truth); break;
          case "REQUEST_RETURN": if (input.kind === "GOODS") { result = goodsSource.goodsCommandResult(truth.orderId, input as GoodsReturnInput); truth = goodsSource.requestedGoodsWorkflow(input as GoodsReturnInput, truth); } else { result = moneySource.moneyReturnResult(truth.orderId, input as MoneyReturnInput, truth); truth = moneySource.requestedMoneyReturn(input as MoneyReturnInput, truth); } break;
          case "SEND_RETURN_GOODS": result = sendSource.returnSendResult(truth.orderId, input, truth); truth = sendSource.returnSentWorkflow(input, truth); break;
          case "RECEIVE_MANUAL_REFUND": result = refundSource.refundReceiveResult(truth.orderId, input, truth); truth = refundSource.refundReceivedWorkflow(input, truth); break;
          case "REORDER": result = reorderSource.reorderResult(truth.orderId, input); truth.version = truth.order.version = input.expectedVersion + 1; break;
          case "ACCEPT_COMPOSITION": result = compositionSource.compositionResult(truth.orderId, input); truth = compositionSource.acceptedComposition(input, truth); break;
          case "OPEN_PAYMENT_DISPUTE": result = disputeSource.disputeResult(truth.orderId, input, truth); truth = disputeSource.disputedWorkflow(input, truth); break;
          default: throw Error("Unexpected selected BUYER command");
        }
        receipts.set(input.idempotencyKey, result); effects++;
      }
      if (options.failure === 500 && writes.length === 1) return response(commandEnvelope(500).payload, 500);
      return response(options.foreign ? { ...(result as object), orderId: id(129999) } : result, 201);
    }
    return undefined;
  }); return { mode, fetcher, writes, scope, original, current: () => truth, effects: () => effects };
}
function labels(mode: Mode, locale: Locale) {
  switch (mode) { case "CANCEL": return { confirm: cancellation[locale].send, received: cancellation[locale].received, unknown: cancellation[locale].unknown, replay: cancellation[locale].retry }; case "RECEIVE_SHIPMENT": return { confirm: receipt[locale].send, received: receipt[locale].received, unknown: receipt[locale].unknown, replay: receipt[locale].retry }; case "GOODS": return { confirm: goods[locale].send, received: goods[locale].received, unknown: goods[locale].unknown, replay: goods[locale].retry }; case "CANCELLATION": case "OVERPAYMENT": return { confirm: money[locale].confirm, received: money[locale].received, unknown: money[locale].unknown, replay: money[locale].replay }; case "SEND_RETURN_GOODS": return { confirm: sendReturn[locale].confirm, received: sendReturn[locale].received, unknown: sendReturn[locale].unknown, replay: sendReturn[locale].retry }; case "RECEIVE_MANUAL_REFUND": return { confirm: refund[locale].confirm, received: refund[locale].received, unknown: refund[locale].unknown, replay: refund[locale].retry }; case "REORDER": return { confirm: reorder[locale].confirm, received: reorder[locale].received, unknown: reorder[locale].unknown, replay: reorder[locale].replay }; case "ACCEPT_COMPOSITION": return { confirm: composition[locale].confirm, received: composition[locale].received, unknown: composition[locale].unknown, replay: composition[locale].replay }; case "OPEN_PAYMENT_DISPUTE": return { confirm: dispute[locale].confirm, received: dispute[locale].received, unknown: dispute[locale].unknown, replay: dispute[locale].replay }; }
}
async function open(s: ReturnType<typeof backend>, locale: Locale = "ru", entropy = true) {
  let serial = 125100; const uuid = jest.fn(() => id(++serial)); await render(<StrictMode><NativeMarketApp initialApiUrl={api} fetcher={s.fetcher} reviewUuidProvider={entropy ? { randomUUID: uuid } : {}} /></StrictMode>); if (locale === "kk") await fireEvent.press(screen.getByRole("tab", { name: "ҚАЗ" })); await screen.findByRole("tab", { name: copy[locale].orders }); await fireEvent.press(screen.getByRole("tab", { name: copy[locale].orders })); await fireEvent.press(await screen.findByRole("button", { name: `${copy[locale].open}: ${s.original.order.orderNumber}` })); return uuid;
}
async function prepare(s: ReturnType<typeof backend>, locale: Locale = "ru") {
  const c = copy[locale];
  switch (s.mode) {
    case "CANCEL": { const t = cancellationCopy[locale]; await fireEvent.press(await screen.findByRole("button", { name: t.start })); await fireEvent.changeText(screen.getByLabelText(t.reason), rawReason); await fireEvent(screen.getByRole("switch", { name: t.declaration }), "valueChange", true); await fireEvent.press(screen.getByRole("button", { name: t.review })); break; }
    case "RECEIVE_SHIPMENT": { const t = receiptDraftCopy[locale]; await fireEvent.press(await screen.findByRole("tab", { name: c.shipments })); await fireEvent.press(await screen.findByRole("button", { name: `${t.start}: SYNTHETIC receipt shipment, ${t.line} 1` })); await fireEvent.changeText(screen.getByLabelText(t.quantity), " 1,250000 "); await fireEvent.press(screen.getByRole("button", { name: t.review })); break; }
    case "GOODS": { const t = goodsReturnCopy[locale]; await fireEvent.press(await screen.findByRole("button", { name: `${t.start}: ${t.line} 1` })); await fireEvent.changeText(screen.getByLabelText(t.reason), rawReason); await fireEvent.changeText(screen.getByLabelText(t.quantityText), " 0,250000 "); await fireEvent.changeText(screen.getByLabelText(t.condition), "  SYNTHETIC native condition  "); await fireEvent.press(screen.getByRole("button", { name: t.review })); break; }
    case "CANCELLATION": case "OVERPAYMENT": { const t = money[locale]; await fireEvent.press(await screen.findByRole("button", { name: s.mode === "CANCELLATION" ? t.cancelStart : t.overpayStart })); await fireEvent.changeText(screen.getByLabelText(t.reason), rawReason); await fireEvent.press(screen.getByRole("button", { name: t.preview })); break; }
    case "SEND_RETURN_GOODS": case "RECEIVE_MANUAL_REFUND": { const t = s.mode === "SEND_RETURN_GOODS" ? sendReturn[locale] : refund[locale]; await fireEvent.press(await screen.findByRole("tab", { name: c.returns })); await fireEvent.press(await screen.findByRole("button", { name: `${t.start}: ${s.original.returns![0]!.id}` })); await fireEvent(screen.getByRole("switch", { name: t.declared }), "valueChange", true); break; }
    case "REORDER": await fireEvent.press(await screen.findByRole("button", { name: reorder[locale].start })); break;
    case "ACCEPT_COMPOSITION": await fireEvent.press(await screen.findByRole("button", { name: composition[locale].start })); break;
    case "OPEN_PAYMENT_DISPUTE": { const t = dispute[locale]; await fireEvent.press(await screen.findByRole("tab", { name: c.transfers })); await fireEvent.press(await screen.findByRole("button", { name: `${t.start}: ${t.claim} 1` })); await fireEvent.changeText(screen.getByLabelText(t.reason), rawReason); await fireEvent.press(screen.getByRole("button", { name: t.preview })); break; }
  }
  await screen.findByRole("button", { name: labels(s.mode, locale).confirm });
}
it.each(modes.flatMap(mode => (["ru", "kk"] as const).map(locale => ({ mode, locale }))))("reviews and explicitly sends actual native $mode in$locale with exact source version/key and no fabricated grants", async ({ mode, locale }) => {
  const s = backend(mode), t = labels(mode, locale), uuid = await open(s, locale); await prepare(s, locale); expect(s.writes).toHaveLength(0); expect(uuid).not.toHaveBeenCalled(); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.received);
  expect(s.writes).toHaveLength(1); const input = JSON.parse(s.writes[0].body); expect(input.expectedVersion).toBe(s.original.version); expect(input.idempotencyKey).toBe(id(125101)); expect(input.action).toBe(["GOODS", "CANCELLATION", "OVERPAYMENT"].includes(mode) ? "REQUEST_RETURN" : mode);
  if ("reason" in input) expect(input.reason).toBe(rawReason.trim()); if (mode === "GOODS") expect(input.items).toEqual([{ orderItemId: s.original.order.items[0]!.id, quantity: "0.250000", condition: "SYNTHETIC native condition" }]); if (mode === "RECEIVE_SHIPMENT") expect(input.items[0].deliveredQuantity).toBe("1.250000"); if (mode === "CANCELLATION" || mode === "OVERPAYMENT") expect(input).toMatchObject({ kind: mode, items: [] });
  expect(s.writes[0].init).toMatchObject({ method: "POST", credentials: "omit", headers: { authorization: "Bearer synthetic-buyer-access-token", "x-organization-id": s.scope.organizationId } }); expect(s.effects()).toBe(1); expect(uuid).toHaveBeenCalledTimes(1); expect(screen.queryByText(id(125101))).toBeNull();
});
it.each(["CANCEL", "RECEIVE_SHIPMENT", "GOODS", "CANCELLATION", "SEND_RETURN_GOODS", "RECEIVE_MANUAL_REFUND", "REORDER", "ACCEPT_COMPOSITION", "OPEN_PAYMENT_DISPUTE"] as const)("retains native%s original attempt through lost response and explicit identical replay", async mode => {
  const s = backend(mode, { failure: 500 }), t = labels(mode, "ru"), uuid = await open(s); await prepare(s); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.unknown); expect(s.writes).toHaveLength(1); await fireEvent.press(screen.getByRole("button", { name: t.replay })); await screen.findByText(t.received); expect(s.writes[1].body).toBe(s.writes[0].body); expect(s.effects()).toBe(1); expect(uuid).toHaveBeenCalledTimes(1);
});
it("rejects a foreign workflow result before showing a successful cancellation", async () => { const s = backend("CANCEL", { foreign: true }), t = labels("CANCEL", "ru"); await open(s); await prepare(s); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.unknown); expect(screen.queryByText(t.received)).toBeNull(); expect(s.writes).toHaveLength(1); });
it("retains unknown native cancellation separately from an independently read cancelled order", async () => { const s = backend("CANCEL", { failure: 500 }), t = labels("CANCEL", "ru"); await open(s); await prepare(s); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.unknown); await fireEvent.press(screen.getByRole("button", { name: cancellation.ru.read })); await screen.findByText(cancellation.ru.review); expect(screen.queryByText(t.received)).toBeNull(); expect(s.writes).toHaveLength(1); });
it("keeps source403 distinct and sends no native cancellation replay", async () => { const s = backend("CANCEL", { failure: 403 }), t = labels("CANCEL", "ru"); await open(s); await prepare(s); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(cancellation.ru.denied); expect(screen.queryByRole("button", { name: t.replay })).toBeNull(); expect(s.effects()).toBe(0); expect(s.writes).toHaveLength(1); });
it("keeps a local cancellation draft without native key capability", async () => { const s = backend("CANCEL"); await open(s, "ru", false); await fireEvent.press(await screen.findByRole("button", { name: cancellationCopy.ru.start })); await fireEvent.changeText(screen.getByLabelText(cancellationCopy.ru.reason), rawReason); expect(screen.queryByRole("button", { name: cancellation.ru.send })).toBeNull(); expect(s.writes).toHaveLength(0); });
it("clears an unknown native order action and raw reason on confirmed logout", async () => { const s = backend("CANCEL", { failure: 500 }), t = labels("CANCEL", "ru"); await open(s); await prepare(s); await fireEvent.press(screen.getByRole("button", { name: t.confirm })); await screen.findByText(t.unknown); await fireEvent.press(screen.getByRole("button", { name: sessionCopy.ru.logout })); await screen.findByLabelText(sessionCopy.ru.password); expect(screen.queryByText(t.unknown)).toBeNull(); expect(screen.queryByText(rawReason)).toBeNull(); expect(s.writes).toHaveLength(1); });
