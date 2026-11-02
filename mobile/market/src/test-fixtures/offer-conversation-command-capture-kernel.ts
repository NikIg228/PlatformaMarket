import { createReadController, type ReadScope } from "../read-controller";
import { bindMarketReads } from "../market-transport";
import { createConversationReadTransport } from "../conversation-read-transport";
import { createConversationCommandTransport } from "../conversation-command-transport";
import type { OfferConversationWindow } from "../offer-conversation-read";
import type { SupportTicketDetail } from "../../../../packages/schemas/src/support-workflow";
import { offerConversationAuthorization } from "./offer-conversation";
import { conversationSendAuthorization } from "./order-conversation-send";
import { syntheticSupportAuthorization } from "./support-commands";

export const offerConversationCaptureCases = ["start", "send", "mark-read", "resolve", "escalate", "support-reply"] as const;
export type OfferConversationCaptureCase = typeof offerConversationCaptureCases[number];
/** Explicit synthetic source permissions only. Neither read nor write fixture is native admission. */
export function createOfferConversationCommandCaptureKernel(scope: ReadScope, readCore: (path: string) => Promise<unknown>, readConversation: (path: string) => Promise<unknown>, exchange: (path: string, body: Readonly<object>) => Promise<unknown>, savedKey: () => string) {
  let active = true, capturedKeyReads = 0;
  const reads = createConversationReadTransport(scope, readConversation, () => active), commands = createConversationCommandTransport(scope, exchange, () => active);
  const readAuthorization = { ...offerConversationAuthorization(), scope }, authorization = { ...conversationSendAuthorization(), scope }, key = () => { capturedKeyReads++; return savedKey(); };
  const client = {
    ...bindMarketReads(readCore, scope.organizationId), offerConversationFixture: { authorization: readAuthorization, lookup: reads.lookup, get: reads.get },
    offerConversationMessagesFixture: { authorization, nextMessageKey: key, start: commands.start, send: commands.send },
    offerConversationReadMarkerFixture: { authorization: readAuthorization, markConversationRead: commands.markRead },
    offerConversationResolveFixture: { authorization, resolveOfferConversation: commands.resolve },
    offerConversationEscalateFixture: { authorization, nextSupportKey: key, escalateOfferConversation: commands.escalate },
    supportCommandFixture: { authorization: { ...syntheticSupportAuthorization(), scope, permissions: ["support.ticket.create", "support.ticket.view"] }, nextIdempotencyKey: key, addSupportMessage: commands.supportReply },
  };
  const controller = createReadController({ scope, client });
  return { controller, capturedKeyReads: () => capturedKeyReads, close() { active = false; controller.dispose(); reads.close(); commands.close(); } };
}
type Controller = ReturnType<typeof createOfferConversationCommandCaptureKernel>["controller"];
type ModelState = ReturnType<Controller["offerConversationMessages"]["stateFor"]> | ReturnType<Controller["offerConversationReadMarker"]["stateFor"]> | ReturnType<Controller["offerConversationResolve"]["stateFor"]> | ReturnType<Controller["offerConversationEscalate"]["stateFor"]> | ReturnType<Controller["supportReplyCommands"]["stateFor"]>;
type IssueOf<T> = T extends { issue?: infer I } ? I : never;
export type OfferConversationOperationProof = Readonly<{ phase: ModelState["phase"]; issue?: IssueOf<ModelState>; sourceResponseAccepted: boolean; sourceReceived: boolean; unresolved: boolean }>;
function proof(state: ModelState, sourceResponseAccepted: boolean): OfferConversationOperationProof {
  return Object.freeze({ phase: state.phase, ...("issue" in state && state.issue ? { issue: state.issue } : {}), sourceResponseAccepted, sourceReceived: "received" in state ? state.received === true : state.phase === "receipt" || state.phase === "success", unresolved: "unresolved" in state && state.unresolved === true || state.phase === "unknown" || state.phase === "invalid-result" });
}
/** Original current OFFER draft/review tokens, never a fabricated catalog or archived variant identity. */
export async function runOfferConversationCaptureReview(controller: Controller, caseId: OfferConversationCaptureCase, window: OfferConversationWindow, input: Readonly<Record<string, unknown>>, ticket?: SupportTicketDetail): Promise<OfferConversationOperationProof | null> {
  const offerId = window.context.offerId, threadId = window.conversation?.id;
  switch (caseId) {
    case "start": case "send": {
      if (typeof input.body !== "string") return null; const drafts = controller.offerConversationDrafts, model = controller.offerConversationMessages, target = drafts.begin(window); if (!target) return null;
      drafts.setText(target, input.body); if (!model.prepare(window)) return null; const review = model.stateFor(offerId).review; if (!review || review.kind !== (caseId === "start" ? "start" : "message") || !model.canConfirm(review)) return null;
      await model.confirm(review); const state = model.stateFor(offerId); return proof(state, state.phase === "result" || state.phase === "receipt");
    }
    case "mark-read": {
      if (!threadId) return null; const model = controller.offerConversationReadMarker; if (!model.prepare(window)) return null; const review = model.stateFor(threadId).review; if (!review || !model.canConfirm(review)) return null;
      await model.confirm(review); const state = model.stateFor(threadId); return proof(state, state.phase === "receipt");
    }
    case "resolve": {
      if (!threadId) return null; const model = controller.offerConversationResolve; if (!model.prepare(window)) return null; const review = model.stateFor(threadId).review; if (!review || !model.canConfirm(review)) return null;
      await model.confirm(review); const state = model.stateFor(threadId); return proof(state, state.phase === "receipt");
    }
    case "escalate": {
      const model = controller.offerConversationEscalate, token = model.begin(window); if (!token || typeof input.reason !== "string") return null;
      model.setText(offerId, token, input.reason); if (!model.prepare(window)) return null; const review = model.stateFor(offerId).review; if (!review || !model.canConfirm(review)) return null;
      await model.confirm(review); const state = model.stateFor(offerId); return proof(state, state.phase === "result" || state.phase === "receipt");
    }
    case "support-reply": {
      if (!ticket || typeof input.body !== "string") return null; const drafts = controller.supportReplyDrafts, model = controller.supportReplyCommands, target = drafts.begin(ticket); if (!target) return null;
      drafts.setText(target, input.body); if (!model.canSubmit(target) || !drafts.check(target)) return null; await model.submit(target); const state = model.stateFor(target); return proof(state, state.phase === "success");
    }
  }
}
