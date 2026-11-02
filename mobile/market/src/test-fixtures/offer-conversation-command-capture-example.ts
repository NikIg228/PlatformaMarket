import { conversationReadResultSchema, conversationResultSchema, type StartConversation, type ConversationMessageInput, type ConversationEscalation } from "../../../../packages/schemas/src/conversations";
import type { AddSupportInput } from "../support-command-fixture";
import { offerConversationScope, offerConversationId, offerComparison, offerConversationThreadId, offerConversationLookup, offerConversationPage } from "./offer-conversation";
import { offerMessagesProtocol } from "./offer-conversation-messages";
import { escalationPage, escalationProtocol } from "./offer-conversation-escalate";
import { offerWithSupport, offerSupportTicket, offerSupportTicketId } from "./offer-conversation-support";
import { postedSupportMessage } from "./support-commands";
import { createOfferConversationCommandCaptureKernel, runOfferConversationCaptureReview, type OfferConversationCaptureCase } from "./offer-conversation-command-capture-kernel";

type CaptureRecord = { method: "GET" | "POST"; path: string; httpStatus: number; body: unknown; requestBody?: unknown };
export type OfferConversationCommandCaptureExample = { formatVersion: 1; kind: "offer-conversation-command"; caseId: OfferConversationCaptureCase; scope: typeof offerConversationScope; expected: { offerId: string }; comparisonQuery: { kind: "comparison"; input: { productId: string; variantId: string; quantity: string } }; parent: CaptureRecord; lookup: CaptureRecord; detail?: CaptureRecord; support?: CaptureRecord; operation: CaptureRecord };
/** Current comparison selection only; no invented archived variant, automatic candidate-ID read or business effect. */
export async function offerConversationCommandCaptureExample(caseId: OfferConversationCaptureCase = "send"): Promise<OfferConversationCommandCaptureExample> {
  const scope = Object.freeze({ ...offerConversationScope, environment: "https://market.example.invalid/api" }), comparisonBody = offerComparison();
  const comparisonQuery = { kind: "comparison" as const, input: { productId: comparisonBody.product.id, variantId: comparisonBody.selectedVariantId!, quantity: "1.000000" } };
  const lookupBody = offerConversationLookup(caseId === "start"), detailBody = caseId === "start" ? null : caseId === "support-reply" ? offerWithSupport() : caseId === "escalate" ? escalationPage() : offerConversationPage();
  let parent: CaptureRecord | undefined, lookup: CaptureRecord | undefined, detail: CaptureRecord | undefined, support: CaptureRecord | undefined, operation: CaptureRecord | undefined;
  const kernel = createOfferConversationCommandCaptureKernel(scope, async path => {
    if (!parent) { parent = { method: "GET", path, httpStatus: 200, body: comparisonBody }; return comparisonBody; }
    if (caseId !== "support-reply" || support) throw Error("Unexpected synthetic OFFER core read"); const body = offerSupportTicket(); support = { method: "GET", path, httpStatus: 200, body }; return body;
  }, async path => {
    if (!lookup) { lookup = { method: "GET", path, httpStatus: 200, body: lookupBody }; return lookupBody; }
    if (!detailBody || detail) throw Error("Unexpected synthetic OFFER detail read"); detail = { method: "GET", path, httpStatus: 200, body: detailBody }; return detailBody;
  }, async (path, requestBody) => {
    if (operation) throw Error("Unexpected repeated synthetic OFFER command");
    const body = caseId === "start" ? offerMessagesProtocol().start(scope, requestBody as StartConversation)
      : caseId === "send" ? offerMessagesProtocol().send(scope, offerConversationThreadId, requestBody as ConversationMessageInput)
      : caseId === "resolve" ? conversationResultSchema.parse({ conversationId: offerConversationThreadId })
      : caseId === "mark-read" ? conversationReadResultSchema.parse({ throughSequence: (requestBody as { throughSequence: number }).throughSequence })
      : caseId === "escalate" ? escalationProtocol().accept(scope, offerConversationThreadId, requestBody as ConversationEscalation)
      : postedSupportMessage(offerSupportTicketId, requestBody as AddSupportInput);
    operation = { method: "POST", path, httpStatus: 200, requestBody, body }; return body;
  }, () => offerConversationId(53000));
  try {
    const controller = kernel.controller; await controller.load(comparisonQuery); let state = controller.getSnapshot().state; if (!("read" in state) || state.read.kind !== "comparison") throw Error("Synthetic OFFER comparison rejected"); const comparison = state.read.value, offerId = comparison.offers[0]!.offerId;
    const target = comparison.selectedVariantId ? controller.selectOfferConversation(comparison.product.id, comparison.selectedVariantId, offerId) : null; if (!target) throw Error("Synthetic OFFER selection unavailable");
    await controller.load({ kind: "offer-conversation", target }); state = controller.getSnapshot().state; if (!("read" in state) || state.read.kind !== "offer-conversation") throw Error("Synthetic OFFER read rejected"); const window = state.read.value; let ticket;
    if (caseId === "support-reply") {
      const selection = controller.offerConversationSupportLinks.select(window), origin = selection ? controller.offerConversationSupportLinks.take(selection) : null; if (!origin) throw Error("Synthetic OFFER support origin unavailable");
      await controller.load({ kind: "offer-conversation-support-ticket", origin }); state = controller.getSnapshot().state; if (!("read" in state) || state.read.kind !== "support-ticket") throw Error("Synthetic OFFER linked ticket rejected"); ticket = state.read.value;
    }
    const proof = await runOfferConversationCaptureReview(controller, caseId, window, { body: "SYNTHETIC вопрос по предложению\nҰсыныс туралы сұрақ", reason: "SYNTHETIC reviewed offer discrepancy" }, ticket);
    if (!proof?.sourceResponseAccepted || !parent || !lookup || !operation || Number(!!detail) !== Number(caseId !== "start") || Number(!!support) !== Number(caseId === "support-reply") || kernel.capturedKeyReads() !== Number(caseId !== "mark-read" && caseId !== "resolve")) throw Error("Synthetic initial OFFER command rejected: " + caseId);
    return { formatVersion: 1, kind: "offer-conversation-command", caseId, scope, expected: { offerId }, comparisonQuery, parent, lookup, ...(detail ? { detail } : {}), ...(support ? { support } : {}), operation };
  } finally { kernel.close(); }
}
