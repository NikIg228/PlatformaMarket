import { conversationScope as scope, conversationWorkflow, orderConversationPage } from "./order-conversation";
import { offerConversationPage } from "./offer-conversation";
import { conversationWithSupport, conversationSupportTicket } from "./conversation-support";
import { offerWithSupport, offerSupportTicket } from "./offer-conversation-support";

/** Complete synthetic specimen for the manual offline entry; no account, token or production payload. */
export function conversationCaptureExample(kind: "ORDER" | "OFFER" = "OFFER", withSupport = false, older = false) {
  const body = kind === "OFFER" ? withSupport ? offerWithSupport() : offerConversationPage() : withSupport ? conversationWithSupport() : orderConversationPage();
  if (kind === "OFFER") body.conversation.context = { title: body.conversation.title, counterpartyName: body.conversation.counterpartyName, productId: body.conversation.productId,
    productName: "SYNTHETIC captured product", variantLabel: "SYNTHETIC captured variant", packagingLabel: null, imageUrl: "https://private.example.invalid/ignored-capture.jpg" };
  const summary = body.conversation;
  const expected = { contextType: kind, id: summary.id, contextId: summary.contextId, productId: kind === "ORDER" ? null : summary.productId,
    buyerOrganizationId: summary.buyerOrganizationId, supplierOrganizationId: summary.supplierOrganizationId, version: summary.version, latestSequence: summary.latestSequence };
  const cursor = body.messages[0]?.sequence;
  const olderDetails = older && !withSupport && cursor ? [{ method: "GET" as const, path: `/conversations/${summary.id}`, request: { conversationId: summary.id, beforeSequence: cursor }, httpStatus: 200,
    body: kind === "OFFER" ? offerConversationPage(cursor) : orderConversationPage(cursor) }] : [];
  return { formatVersion: 1 as const, scope, expected, summary, olderPageCount: olderDetails.length, olderDetails, includeSupport: withSupport,
    detail: { method: "GET" as const, path: `/conversations/${summary.id}`, request: { conversationId: summary.id, beforeSequence: undefined as number | undefined }, httpStatus: 200, body },
    ...(kind === "ORDER" ? { orderWorkflow: { method: "GET" as const, path: `/supplier-orders/${summary.contextId}/workflow`, request: { orderId: summary.contextId }, httpStatus: 200, body: conversationWorkflow() } } : {}),
    ...(withSupport ? { supportDetail: { method: "GET" as const, path: `/support/tickets/${summary.supportTicketId!}`, request: { ticketId: summary.supportTicketId! }, httpStatus: 200, body: kind === "OFFER" ? offerSupportTicket() : conversationSupportTicket() } } : {}),
  };
}
