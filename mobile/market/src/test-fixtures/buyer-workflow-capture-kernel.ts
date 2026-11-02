import type { OrderWorkflowResponse } from "../../../../packages/schemas/src/order-workflow";
import { createReadController, type ReadScope } from "../read-controller";
import { bindMarketReads } from "../market-transport";
import { createBuyerWorkflowTransport } from "../buyer-workflow-transport";
import type { BuyerWorkflowInput } from "../order-workflow-command-fixture";
import { cancellationCommandAuthorization } from "./order-cancellation-command";

export const buyerCaptureActions = ["CANCEL", "RECEIVE_SHIPMENT", "REQUEST_RETURN", "SEND_RETURN_GOODS", "RECEIVE_MANUAL_REFUND", "REORDER", "ACCEPT_COMPOSITION", "OPEN_PAYMENT_DISPUTE"] as const;
export type BuyerCaptureAction = typeof buyerCaptureActions[number];
/** Isolated synthetic authority and explicit saved UUID; never a native business binding. */
export function createBuyerWorkflowCaptureKernel(scope: ReadScope, read: (path: string) => Promise<unknown>, exchange: (path: string, body: Readonly<object>) => Promise<unknown>, savedKey: () => string) {
  let active = true, capturedKeyReads = 0;
  const raw = createBuyerWorkflowTransport(scope, exchange, () => active), client = {
    ...bindMarketReads(read, scope.organizationId),
    buyerWorkflowCommandFixture: { authorization: { ...cancellationCommandAuthorization(), scope }, executeOrderWorkflow: raw.execute, nextWorkflowIdempotencyKey: () => { capturedKeyReads++; return savedKey(); } },
  };
  const controller = createReadController({ scope, client });
  return { controller, capturedKeyReads: () => capturedKeyReads, close() { active = false; controller.dispose(); raw.close(); } };
}
type Controller = ReturnType<typeof createBuyerWorkflowCaptureKernel>["controller"];
export function buyerCaptureState(controller: Controller, input: BuyerWorkflowInput, id: string) {
  switch (input.action) {
    case "CANCEL": return controller.cancellationCommands.stateFor(id);
    case "RECEIVE_SHIPMENT": return controller.receiptCommands.stateFor(id);
    case "REQUEST_RETURN": return input.kind === "GOODS" ? controller.goodsReturnCommands.stateFor(id) : controller.moneyReturnCommands.stateFor(id);
    case "SEND_RETURN_GOODS": return controller.returnSendCommands.stateFor(id);
    case "RECEIVE_MANUAL_REFUND": return controller.refundReceiveCommands.stateFor(id);
    case "REORDER": return controller.orderReorderCommands.stateFor(id);
    case "ACCEPT_COMPOSITION": return controller.orderCompositionCommands.stateFor(id);
    case "OPEN_PAYMENT_DISPUTE": return controller.paymentDisputeCommands.stateFor(id);
  }
}
/** Simulated explicit source reviews only. Source single-line drafts do not represent a multi-line intent. */
export async function runBuyerCaptureReview(controller: Controller, workflow: OrderWorkflowResponse, input: BuyerWorkflowInput, beforeSend: () => void): Promise<boolean> {
  const id = workflow.orderId;
  switch (input.action) {
    case "CANCEL": {
      const draft = controller.cancellationDrafts, model = controller.cancellationCommands, target = draft.begin(workflow); if (!target) return false;
      draft.setReason(target, input.reason); draft.setDeclaration(target, input.transferNotMade); if (!draft.review(target) || !model.canSubmit(workflow, target)) return false;
      beforeSend(); await model.submit(workflow, target); return true;
    }
    case "RECEIVE_SHIPMENT": {
      if (input.items.length !== 1) return false; const line = input.items[0]!, shipment = workflow.order.shipments?.find(row => row.id === input.shipmentId), item = shipment?.items.find(row => row.id === line.shipmentItemId); if (!shipment || !item) return false;
      const draft = controller.receiptDrafts, model = controller.receiptCommands, target = draft.begin(workflow, shipment, item); if (!target) return false;
      draft.change(target, line.deliveredQuantity); if (!draft.review(target) || !model.canSubmit(workflow, target)) return false; beforeSend(); await model.submit(workflow, target); return true;
    }
    case "REQUEST_RETURN": {
      if (input.kind === "GOODS") {
        if (input.items.length !== 1) return false; const line = input.items[0]!, item = workflow.order.items.find(row => row.id === line.orderItemId); if (!item) return false;
        const draft = controller.goodsReturnDrafts, model = controller.goodsReturnCommands, target = draft.begin(workflow, item); if (!target) return false;
        draft.change(target, "reason", input.reason); draft.change(target, "quantityText", line.quantity); draft.change(target, "condition", line.condition);
        if (!draft.review(target) || !model.canSubmit(workflow, target)) return false; beforeSend(); await model.submit(workflow, target); return true;
      }
      const model = controller.moneyReturnCommands; if (!model.begin(workflow, input.kind)) return false; const token = model.stateFor(id).editToken; if (!token) return false;
      model.setReason(id, token, input.reason); if (!model.prepare(id)) return false; const review = model.stateFor(id).review; if (!review || !model.canConfirm(id, review)) return false;
      beforeSend(); await model.confirm(id, review); return true;
    }
    case "SEND_RETURN_GOODS": case "RECEIVE_MANUAL_REFUND": {
      const record = workflow.returns?.find(row => row.id === input.returnId), model = input.action === "SEND_RETURN_GOODS" ? controller.returnSendCommands : controller.refundReceiveCommands;
      if (!record || !model.prepare(workflow, record)) return false; model.declare(id, true); if (!model.canConfirm(id)) return false; beforeSend(); await model.confirm(id); return true;
    }
    case "REORDER": {
      const model = controller.orderReorderCommands; if (!await model.prepare(workflow) || !model.canConfirm(id)) return false; beforeSend(); await model.confirm(id); return true;
    }
    case "ACCEPT_COMPOSITION": {
      const model = controller.orderCompositionCommands; if (!model.prepare(workflow)) return false; const source = model.stateFor(id).source; if (!source || !model.canConfirm(id, source)) return false;
      beforeSend(); await model.confirm(id, source); return true;
    }
    case "OPEN_PAYMENT_DISPUTE": {
      const claim = workflow.claims.find(row => row.id === input.claimId), model = controller.paymentDisputeCommands; if (!claim || !model.begin(workflow, claim)) return false; const token = model.stateFor(id).editToken; if (!token) return false;
      model.setReason(id, token, input.reason); if (!model.prepare(id)) return false; const review = model.stateFor(id).review; if (!review || !model.canConfirm(id, review)) return false;
      beforeSend(); await model.confirm(id, review); return true;
    }
  }
}
