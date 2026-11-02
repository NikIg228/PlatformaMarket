import type { ConversationMessageInput, StartConversation, ConversationEscalation } from "../../../../packages/schemas/src/conversations";
import type { AddSupportInput } from "../support-command-fixture";
import { conversationScope, conversationId, conversationWorkflow, existingConversationId, orderConversationLookup } from "./order-conversation";
import { conversationSendPage, conversationSendProtocol } from "./order-conversation-send";
import { conversationStartProtocol } from "./order-conversation-start";
import { conversationResolvePage, conversationResolveProtocol } from "./order-conversation-resolve";
import { readMarkerProtocol } from "./order-conversation-read-marker";
import { escalationPage, escalationProtocol } from "./order-conversation-escalate";
import { conversationWithSupport, conversationSupportTicket, conversationSupportTicketId } from "./conversation-support";
import { postedSupportMessage } from "./support-commands";
import { createOrderConversationCommandCaptureKernel, runOrderConversationCaptureReview, type OrderConversationCaptureCase } from "./order-conversation-command-capture-kernel";

type CaptureRecord = { method: "GET" | "POST"; path: string; httpStatus: number; body: unknown; requestBody?: unknown };
export type OrderConversationCommandCaptureExample = { formatVersion: 1; kind: "order-conversation-command"; caseId: OrderConversationCaptureCase; scope: typeof conversationScope; expected: { orderId: string; orderVersion: number }; parent: CaptureRecord; lookup: CaptureRecord; detail?: CaptureRecord; support?: CaptureRecord; operation: CaptureRecord };
/** Independent synthetic first-attempt cases; candidates never cause an invented follow-up GET or visible message. */
export async function orderConversationCommandCaptureExample(caseId: OrderConversationCaptureCase = "send"): Promise<OrderConversationCommandCaptureExample> {
  const scope = Object.freeze({ ...conversationScope, environment: "https://market.example.invalid/api" }), workflow = conversationWorkflow();
  const lookupBody = orderConversationLookup(caseId === "start"), detailBody = caseId === "start" ? null : caseId === "support-reply" ? conversationWithSupport() : caseId === "escalate" ? escalationPage() : caseId === "resolve" ? conversationResolvePage() : conversationSendPage();
  let parent: CaptureRecord | undefined, lookup: CaptureRecord | undefined, detail: CaptureRecord | undefined, support: CaptureRecord | undefined, operation: CaptureRecord | undefined;
  const kernel = createOrderConversationCommandCaptureKernel(scope, async path => {
    if (!parent) { parent = { method: "GET", path, httpStatus: 200, body: workflow }; return workflow; }
    if (caseId !== "support-reply" || support) throw Error("Unexpected synthetic conversation core read"); const body = conversationSupportTicket(); support = { method: "GET", path, httpStatus: 200, body }; return body;
  }, async path => {
    if (!lookup) { lookup = { method: "GET", path, httpStatus: 200, body: lookupBody }; return lookupBody; }
    if (!detailBody || detail) throw Error("Unexpected synthetic conversation detail read"); detail = { method: "GET", path, httpStatus: 200, body: detailBody }; return detailBody;
  }, async (path, requestBody) => {
    if (operation) throw Error("Unexpected repeated synthetic conversation command");
    const body = caseId === "start" ? conversationStartProtocol().accept(scope, requestBody as StartConversation)
      : caseId === "send" ? conversationSendProtocol().accept(scope, existingConversationId, requestBody as ConversationMessageInput)
      : caseId === "resolve" ? conversationResolveProtocol().accept(scope, existingConversationId, requestBody as { expectedVersion: number })
      : caseId === "mark-read" ? readMarkerProtocol().accept(scope, existingConversationId, requestBody as { throughSequence: number })
      : caseId === "escalate" ? escalationProtocol().accept(scope, existingConversationId, requestBody as ConversationEscalation)
      : postedSupportMessage(conversationSupportTicketId, requestBody as AddSupportInput);
    operation = { method: "POST", path, httpStatus: 200, requestBody, body }; return body;
  }, () => conversationId(37000));
  try {
    const controller = kernel.controller; await controller.load({ kind: "workflow", orderId: workflow.orderId }); const target = controller.selectOrderConversation(); if (!target) throw Error("Synthetic conversation workflow rejected");
    await controller.load({ kind: "order-conversation", target }); let state = controller.getSnapshot().state; if (!("read" in state) || state.read.kind !== "order-conversation") throw Error("Synthetic conversation read rejected"); const window = state.read.value;
    let ticket;
    if (caseId === "support-reply") {
      const selection = controller.conversationSupportLinks.select(window), origin = selection ? controller.conversationSupportLinks.take(selection) : null; if (!origin) throw Error("Synthetic support origin unavailable");
      await controller.load({ kind: "conversation-support-ticket", origin }); state = controller.getSnapshot().state; if (!("read" in state) || state.read.kind !== "support-ticket") throw Error("Synthetic linked ticket rejected"); ticket = state.read.value;
    }
    const proof = await runOrderConversationCaptureReview(controller, caseId, window, { body: "SYNTHETIC новое сообщение\nЖаңа хабар", reason: "SYNTHETIC reviewed conversation discrepancy" }, ticket);
    if (!proof?.sourceResponseAccepted || !parent || !lookup || !operation || Number(!!detail) !== Number(caseId !== "start") || Number(!!support) !== Number(caseId === "support-reply") || kernel.capturedKeyReads() !== Number(caseId !== "mark-read" && caseId !== "resolve")) throw Error("Synthetic initial conversation command rejected: " + caseId);
    return { formatVersion: 1, kind: "order-conversation-command", caseId, scope, expected: { orderId: workflow.orderId, orderVersion: workflow.version }, parent, lookup, ...(detail ? { detail } : {}), ...(support ? { support } : {}), operation };
  } finally { kernel.close(); }
}
