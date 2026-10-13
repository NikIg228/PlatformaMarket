import { BadRequestException } from "@nestjs/common";
import type { Prisma, BusinessConversation, SupportTicket } from "@prisma/client";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";

export const reviewFinished = (status: string) => status === "RESOLVED" || status === "CLOSED";

export async function operatorAudience(tx: Prisma.TransactionClient) {
  const organizations = await tx.organizationCapability.findMany({ where: { capability: "MARKETPLACE_OPERATOR" }, select: { organizationId: true } });
  return Object.fromEntries(organizations.map((organization, index) => [`support${index}OrganizationId`, organization.organizationId]));
}

/** All linked workflow writers lock conversation before ticket, including message writers. */
export async function lockTicketConversation(tx: Prisma.TransactionClient, ticketId: string) {
  await tx.$queryRaw`SELECT id FROM "BusinessConversation" WHERE "supportTicketId" = ${ticketId}::uuid FOR UPDATE`;
  return tx.businessConversation.findUnique({ where: { supportTicketId: ticketId } });
}

export function requirePublicDecision(conversation: BusinessConversation | null, before: string, after: string, decision?: string) {
  if (conversation && !reviewFinished(before) && reviewFinished(after) && (!decision || decision.trim().length < 10)) {
    throw new BadRequestException("Добавьте решение оператора (не менее 10 символов). Оно будет видно обеим сторонам диалога.");
  }
}

/** Never copies ticket messages, private notes or audit reasons into the common conversation. */
export async function syncConversationReview(tx: Prisma.TransactionClient, conversation: BusinessConversation | null, before: SupportTicket, after: SupportTicket, context: SupplierActorContext, decision?: string) {
  if (!conversation || (before.status === after.status && conversation.resolved === reviewFinished(after.status))) return;
  const publish = !reviewFinished(before.status) && reviewFinished(after.status);
  requirePublicDecision(conversation, before.status, after.status, decision);
  const updated = await tx.businessConversation.update({ where: { id: conversation.id }, data: { resolved: reviewFinished(after.status), version: { increment: 1 }, ...(publish ? { latestSequence: { increment: 1 } } : {}) } });
  if (publish) {
    const author = await tx.user.findUniqueOrThrow({ where: { id: context.actorId }, select: { displayName: true } });
    const message = await tx.conversationMessage.create({ data: { conversationId: conversation.id, sequence: updated.latestSequence, authorId: context.actorId, authorOrganizationId: context.organizationId, authorName: author.displayName, authorRole: "OPERATOR", body: `Решение оператора: ${decision!.trim()}`, idempotencyKey: crypto.randomUUID() } });
    await tx.outboxEvent.create({ data: { aggregateType: "BusinessConversation", aggregateId: conversation.id, eventType: "ConversationMessageSaved", payload: { conversationId: conversation.id, messageId: message.id, authorOrganization: context.organizationId, buyerOrganizationId: conversation.buyerOrganizationId, supplierOrganizationId: conversation.supplierOrganizationId } } });
  }
  await tx.auditLog.create({ data: { ...context, action: "conversation.review.updated", entityType: "BusinessConversation", entityId: conversation.id, before: { status: before.status }, after: { status: after.status, ticketId: after.id } } });
}
