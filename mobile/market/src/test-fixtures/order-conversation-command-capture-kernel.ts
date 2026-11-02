import { createReadController, type ReadScope } from "../read-controller";
import { bindMarketReads } from "../market-transport";
import { createConversationReadTransport } from "../conversation-read-transport";
import { createConversationCommandTransport } from "../conversation-command-transport";
import { conversationSendAuthorization } from "./order-conversation-send";
import { syntheticSupportAuthorization } from "./support-commands";
import type { OrderConversationWindow } from "../order-conversation-read";
import type { SupportTicketDetail } from "../../../../packages/schemas/src/support-workflow";

export const orderConversationCaptureCases = ["start", "send", "mark-read", "resolve", "escalate", "support-reply"] as const;
export type OrderConversationCaptureCase = typeof orderConversationCaptureCases[number];
/** Standalone source fixtures only. Six raw candidates do not become native operation capabilities. */
export function createOrderConversationCommandCaptureKernel(scope: ReadScope, readCore: (path: string) => Promise<unknown>, readConversation: (path: string) => Promise<unknown>, exchange: (path: string, body: Readonly<object>) => Promise<unknown>, savedKey: () => string) {
  let active = true, capturedKeyReads = 0;
  const reads = createConversationReadTransport(scope, readConversation, () => active), commands = createConversationCommandTransport(scope, exchange, () => active);
  const authorization = { ...conversationSendAuthorization(), scope }, key = () => { capturedKeyReads++; return savedKey(); };
  const client = {
    ...bindMarketReads(readCore, scope.organizationId), orderConversationLookupFixture: reads.lookup, orderConversationDetailFixture: reads.get,
    orderConversationStartFixture: { authorization, nextConversationMessageKey: key, startOrderConversation: commands.start },
    orderConversationSendFixture: { authorization, nextConversationMessageKey: key, sendConversationMessage: commands.send },
    orderConversationReadMarkerFixture: { authorization, markConversationRead: commands.markRead },
    orderConversationResolveFixture: { authorization, resolveOrderConversation: commands.resolve },
    orderConversationEscalateFixture: { authorization, nextConversationSupportKey: key, escalateOrderConversation: commands.escalate },
    supportCommandFixture: { authorization: { ...syntheticSupportAuthorization(), scope, permissions: ["support.ticket.create", "support.ticket.view"] }, nextIdempotencyKey: key, addSupportMessage: commands.supportReply },
  };
  const controller = createReadController({ scope, client });
  return { controller, capturedKeyReads: () => capturedKeyReads, close() { active = false; controller.dispose(); reads.close(); commands.close(); } };
}
type Controller = ReturnType<typeof createOrderConversationCommandCaptureKernel>["controller"];
type ModelState = ReturnType<Controller["orderConversationStart"]["stateFor"]> | ReturnType<Controller["orderConversationSend"]["stateFor"]> | ReturnType<Controller["orderConversationResolve"]["stateFor"]> | ReturnType<Controller["orderConversationReadMarker"]["stateFor"]> | ReturnType<Controller["orderConversationEscalate"]["stateFor"]> | ReturnType<Controller["supportReplyCommands"]["stateFor"]>;
type IssueOf<T> = T extends { issue?: infer I } ? I : never;
export type OrderConversationOperationProof = Readonly<{ phase: ModelState["phase"]; issue?: IssueOf<ModelState>; sourceResponseAccepted: boolean; sourceReceived: boolean; unresolved: boolean }>;
function proof(state: ModelState, sourceResponseAccepted: boolean): OrderConversationOperationProof {
  return Object.freeze({ phase: state.phase, ...("issue" in state && state.issue ? { issue: state.issue } : {}), sourceResponseAccepted, sourceReceived: "received" in state ? state.received === true : state.phase === "receipt" || state.phase === "success", unresolved: "unresolved" in state && state.unresolved === true || state.phase === "unknown" || state.phase === "invalid-result" });
}
/** Simulated explicit source review; returned candidates remain unbound until the original independent parent read. */
export async function runOrderConversationCaptureReview(controller: Controller, caseId: OrderConversationCaptureCase, window: OrderConversationWindow, input: Readonly<Record<string, unknown>>, ticket?: SupportTicketDetail): Promise<OrderConversationOperationProof | null> {
  const orderId = window.context.orderId, threadId = window.conversation?.id;
  switch (caseId) {
    case "start": {
      const model = controller.orderConversationStart, token = model.begin(window); if (!token || typeof input.body !== "string") return null;
      model.setText(orderId, token, input.body); if (!model.prepare(window)) return null; const review = model.stateFor(orderId).review; if (!review || !model.canConfirm(review)) return null; await model.confirm(review);
      const state = model.stateFor(orderId); return proof(state, state.phase === "result" || state.phase === "receipt");
    }
    case "send": {
      if (!threadId || typeof input.body !== "string") return null; const drafts = controller.orderConversationDrafts, model = controller.orderConversationSend, target = drafts.begin(window); if (!target) return null;
      drafts.setText(target, input.body); if (!model.prepare(window)) return null; const review = model.stateFor(threadId).review; if (!review || !model.canConfirm(review)) return null; await model.confirm(review); const state = model.stateFor(threadId); return proof(state, state.phase === "receipt");
    }
    case "mark-read": {
      if (!threadId) return null; const model = controller.orderConversationReadMarker; if (!model.prepare(window)) return null; const review = model.stateFor(threadId).review; if (!review || !model.canConfirm(review)) return null;
      await model.confirm(review); const state = model.stateFor(threadId); return proof(state, state.phase === "receipt");
    }
    case "resolve": {
      if (!threadId) return null; const model = controller.orderConversationResolve; if (!model.prepare(window)) return null; const review = model.stateFor(threadId).review; if (!review || !model.canConfirm(review)) return null;
      await model.confirm(review); const state = model.stateFor(threadId); return proof(state, state.phase === "receipt");
    }
    case "escalate": {
      const model = controller.orderConversationEscalate, token = model.begin(window); if (!token || typeof input.reason !== "string") return null;
      model.setText(orderId, token, input.reason); if (!model.prepare(window)) return null; const review = model.stateFor(orderId).review; if (!review || !model.canConfirm(review)) return null; await model.confirm(review);
      const state = model.stateFor(orderId); return proof(state, state.phase === "result" || state.phase === "receipt");
    }
    case "support-reply": {
      if (!ticket || typeof input.body !== "string") return null; const drafts = controller.supportReplyDrafts, model = controller.supportReplyCommands, target = drafts.begin(ticket); if (!target) return null;
      drafts.setText(target, input.body); if (!model.canSubmit(target) || !drafts.check(target)) return null; await model.submit(target); const state = model.stateFor(target); return proof(state, state.phase === "success");
    }
  }
}
