import type { OrderWorkflowResponse } from "../../../../packages/schemas/src/order-workflow";
import type { BuyerWorkflowInput, GoodsReturnInput } from "../order-workflow-command-fixture";
import type { MoneyReturnInput } from "../money-return-command";
import { buyerCaptureState, createBuyerWorkflowCaptureKernel, runBuyerCaptureReview, type BuyerCaptureAction } from "./buyer-workflow-capture-kernel";
import { cancellationCommandScope, cancellationCommandWorkflow, cancellationCommandResult } from "./order-cancellation-command";
import { receiptCommandWorkflow, receiptCommandResult } from "./shipment-receipt-command";
import { goodsCommandWorkflow, goodsCommandResult } from "./goods-return-command";
import { moneyReturnWorkflow, moneyReturnResult } from "./money-return-command";
import { returnSendWorkflow, returnSendResult } from "./return-send-command";
import { refundReceiveWorkflow, refundReceiveResult } from "./refund-receive-command";
import { reorderWorkflow, reorderWorkspace, reorderResult } from "./order-reorder-command";
import { compositionWorkflow, compositionResult } from "./order-composition-command";
import { disputeWorkflow, disputeResult } from "./payment-dispute-command";

export const buyerWorkflowCaptureCases = ["cancel", "receive-shipment", "return-goods", "return-cancellation", "return-overpayment", "send-return", "receive-refund", "reorder", "accept-composition", "open-dispute"] as const;
export type BuyerWorkflowCaptureCase = typeof buyerWorkflowCaptureCases[number];
type CaptureRecord = { method: "GET" | "POST"; path: string; httpStatus: number; body: unknown; requestBody?: unknown };
export type BuyerWorkflowCaptureExample = { formatVersion: 1; kind: "buyer-workflow"; action: BuyerCaptureAction; scope: typeof cancellationCommandScope; expected: { orderId: string; orderVersion: number }; parent: CaptureRecord; workspace?: CaptureRecord; operation: CaptureRecord };
function seed(caseId: BuyerWorkflowCaptureCase, workflow: OrderWorkflowResponse): BuyerWorkflowInput {
  const common = { expectedVersion: workflow.version, idempotencyKey: "00000000-0000-4000-8000-000000099801" }, reason = "SYNTHETIC reviewed buyer reason";
  switch (caseId) {
    case "cancel": return { ...common, action: "CANCEL", reason, transferNotMade: true };
    case "receive-shipment": { const shipment = workflow.order.shipments![0]!; return { ...common, action: "RECEIVE_SHIPMENT", shipmentId: shipment.id, items: [{ shipmentItemId: shipment.items[0]!.id, deliveredQuantity: "1.500001" }] }; }
    case "return-goods": return { ...common, action: "REQUEST_RETURN", kind: "GOODS", reason, items: [{ orderItemId: workflow.order.items[0]!.id, quantity: "0.500001", condition: "SYNTHETIC reviewed return condition" }] };
    case "return-cancellation": case "return-overpayment": return { ...common, action: "REQUEST_RETURN", kind: caseId === "return-cancellation" ? "CANCELLATION" : "OVERPAYMENT", reason, items: [] };
    case "send-return": return { ...common, action: "SEND_RETURN_GOODS", returnId: workflow.returns![0]!.id };
    case "receive-refund": return { ...common, action: "RECEIVE_MANUAL_REFUND", returnId: workflow.returns![0]!.id };
    case "reorder": return { ...common, action: "REORDER" };
    case "accept-composition": return { ...common, action: "ACCEPT_COMPOSITION" };
    case "open-dispute": return { ...common, action: "OPEN_PAYMENT_DISPUTE", claimId: workflow.claims[0]!.id, reason };
  }
}
function sourceResult(workflow: OrderWorkflowResponse, input: BuyerWorkflowInput): unknown {
  switch (input.action) {
    case "CANCEL": return cancellationCommandResult(workflow.orderId, input);
    case "RECEIVE_SHIPMENT": return receiptCommandResult(workflow.orderId, input);
    case "REQUEST_RETURN": return input.kind === "GOODS" ? goodsCommandResult(workflow.orderId, input as GoodsReturnInput) : moneyReturnResult(workflow.orderId, input as MoneyReturnInput, workflow);
    case "SEND_RETURN_GOODS": return returnSendResult(workflow.orderId, input, workflow);
    case "RECEIVE_MANUAL_REFUND": return refundReceiveResult(workflow.orderId, input, workflow);
    case "REORDER": return reorderResult(workflow.orderId, input, workflow.status, workflow.paymentStatus);
    case "ACCEPT_COMPOSITION": return compositionResult(workflow.orderId, input);
    case "OPEN_PAYMENT_DISPUTE": return disputeResult(workflow.orderId, input, workflow);
  }
}
/** Supplied synthetic receipts; no fulfillment/refund computation or server execution. */
export async function buyerWorkflowCaptureExample(caseId: BuyerWorkflowCaptureCase = "cancel"): Promise<BuyerWorkflowCaptureExample> {
  const scope = Object.freeze({ ...cancellationCommandScope, environment: "https://market.example.invalid/api" });
  const workflow = caseId === "cancel" ? cancellationCommandWorkflow() : caseId === "receive-shipment" ? receiptCommandWorkflow() : caseId === "return-goods" ? goodsCommandWorkflow() : caseId === "return-cancellation" || caseId === "return-overpayment" ? moneyReturnWorkflow() : caseId === "send-return" ? returnSendWorkflow() : caseId === "receive-refund" ? refundReceiveWorkflow() : caseId === "reorder" ? reorderWorkflow() : caseId === "accept-composition" ? compositionWorkflow() : disputeWorkflow();
  const input = seed(caseId, workflow); let parent: CaptureRecord | undefined, workspace: CaptureRecord | undefined, operation: CaptureRecord | undefined;
  const kernel = createBuyerWorkflowCaptureKernel(scope, async path => {
    if (!parent) { parent = { method: "GET", path, httpStatus: 200, body: workflow }; return workflow; }
    if (caseId !== "reorder" || workspace) throw Error("Unexpected synthetic workflow read"); const body = reorderWorkspace(); workspace = { method: "GET", path, httpStatus: 200, body }; return body;
  }, async (path, requestBody) => {
    if (operation) throw Error("Unexpected repeated synthetic workflow operation"); const body = sourceResult(workflow, requestBody as BuyerWorkflowInput); operation = { method: "POST", path, httpStatus: 200, requestBody, body }; return body;
  }, () => input.idempotencyKey);
  try {
    const controller = kernel.controller; await controller.load({ kind: "workflow", orderId: workflow.orderId }); const state = controller.getSnapshot().state; if (!("read" in state) || state.read.kind !== "workflow") throw Error("Synthetic workflow parent rejected");
    const selected = await runBuyerCaptureReview(controller, state.read.value, input, () => {}), current = buyerCaptureState(controller, input, workflow.orderId);
    if (!selected || !parent || !operation || current.phase !== "receipt" || kernel.capturedKeyReads() !== 1 || Number(!!workspace) !== Number(caseId === "reorder")) throw Error("Synthetic workflow review/receipt rejected: " + caseId);
    return { formatVersion: 1, kind: "buyer-workflow", action: input.action, scope, expected: { orderId: workflow.orderId, orderVersion: workflow.version }, parent, ...(workspace ? { workspace } : {}), operation };
  } finally { kernel.close(); }
}
