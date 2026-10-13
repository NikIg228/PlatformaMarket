import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type BusinessConversation } from "@prisma/client";
import type { ConversationDetail, ConversationEscalation, ConversationMessageInput, ConversationQuery, ConversationSummary, StartConversation, UploadConversationAttachmentInput, ConversationLookup } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { MediaAccessService } from "../../platform/storage/media-access.service";
import { ConversationAttachmentsService } from "./conversation-attachments.service";
import { conversationContextInfo, conversationOfferSelection, conversationRelations as withParties, type ConversationWithParties as WithParties } from "./conversation-context";
import { operatorAudience, requirePublicDecision, reviewFinished, syncConversationReview } from "./conversation-review";
import { workflowCommand } from "./workflow-command";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService,
    private readonly attachments: ConversationAttachmentsService, private readonly media: MediaAccessService) {}

  private async operator(context: SupplierActorContext) {
    return Boolean(await this.prisma.organizationCapability.findUnique({ where: { organizationId_capability: { organizationId: context.organizationId, capability: "MARKETPLACE_OPERATOR" } } })) && await this.access.hasAll(context.actorId, context.organizationId, ["support.ticket.manage"]);
  }

  private async authorize(context: SupplierActorContext, write = false) {
    if (!await this.access.hasAll(context.actorId, context.organizationId, [write ? "support.ticket.create" : "support.ticket.view"])) throw new ForbiddenException("Conversation permission is required");
  }

  private async requireConversation(id: string, context: SupplierActorContext, write = false) {
    await this.authorize(context, write);
    const operator = await this.operator(context);
    const conversation = await this.prisma.businessConversation.findFirst({ where: { id, OR: [{ buyerOrganizationId: context.organizationId }, { supplierOrganizationId: context.organizationId }, ...(operator ? [{ supportTicketId: { not: null } }] : [])] }, include: withParties });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return conversation;
  }

  async start(input: StartConversation, context: SupplierActorContext) {
    await this.authorize(context, true);
    let buyerOrganizationId: string;
    let supplierOrganizationId: string;
    let title: string;
    if (input.contextType === "OFFER") {
      const buyer = await this.prisma.organizationCapability.findUnique({ where: { organizationId_capability: { organizationId: context.organizationId, capability: "BUYER" } } });
      if (!buyer) throw new ForbiddenException("Only a buyer can start an offer conversation");
      const offer = await this.prisma.supplierOffer.findFirst({ where: { id: input.contextId, status: "ACTIVE", publication: { status: "PUBLISHED", marketplaceVisible: true } }, select: { supplierOrganizationId: true, supplierSku: true } });
      if (!offer || offer.supplierOrganizationId === context.organizationId) throw new NotFoundException("Published offer not found");
      buyerOrganizationId = context.organizationId;
      supplierOrganizationId = offer.supplierOrganizationId;
      title = `Предложение ${offer.supplierSku ?? input.contextId}`;
    } else {
      const order = await this.prisma.supplierOrder.findFirst({ where: { id: input.contextId, OR: [{ buyerOrganizationId: context.organizationId }, { supplierOrganizationId: context.organizationId }] }, select: { buyerOrganizationId: true, supplierOrganizationId: true, orderNumber: true } });
      if (!order) throw new NotFoundException("Order not found");
      ({ buyerOrganizationId, supplierOrganizationId } = order);
      title = `Заказ ${order.orderNumber}`;
    }
    return this.prisma.$transaction(async tx => {
      const key = { contextType: input.contextType, contextId: input.contextId, buyerOrganizationId, supplierOrganizationId };
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(key)}, 0))`;
      const conversation = await tx.businessConversation.upsert({ where: { contextType_contextId_buyerOrganizationId_supplierOrganizationId: key }, create: { ...key, title, ...(input.contextType === "OFFER" ? { offerId: input.contextId } : { orderId: input.contextId }) }, update: {} });
      return this.append(tx, conversation, input, context);
    });
  }

  async lookup(input: Pick<StartConversation, "contextType" | "contextId">, context: SupplierActorContext): Promise<ConversationLookup> {
    await this.authorize(context);
    const operator = await this.operator(context);
    const conversation = await this.prisma.businessConversation.findFirst({ where: { ...input, OR: [{ buyerOrganizationId: context.organizationId }, { supplierOrganizationId: context.organizationId }, ...(operator ? [{ supportTicketId: { not: null } }] : [])] }, include: withParties });
    if (conversation) return { conversationId: conversation.id, context: this.summary(conversation, context, "", false).context };
    if (input.contextType === "OFFER") {
      const buyer = await this.prisma.organizationCapability.findUnique({ where: { organizationId_capability: { organizationId: context.organizationId, capability: "BUYER" } } });
      if (!buyer) throw new ForbiddenException("Only a buyer can start an offer conversation");
      const offer = await this.prisma.supplierOffer.findFirst({ where: { id: input.contextId, status: "ACTIVE", publication: { status: "PUBLISHED", marketplaceVisible: true } }, select: conversationOfferSelection });
      if (!offer || offer.supplierOrganizationId === context.organizationId) throw new NotFoundException("Published offer not found");
      return { conversationId: null, context: conversationContextInfo(`Предложение ${offer.supplierSku ?? input.contextId}`, offer.supplier.organization.displayName, offer, this.media) };
    }
    const order = await this.prisma.supplierOrder.findFirst({ where: { id: input.contextId, OR: [{ buyerOrganizationId: context.organizationId }, { supplierOrganizationId: context.organizationId }] }, select: { orderNumber: true, buyerOrganizationId: true, buyer: { select: { displayName: true } }, supplier: { select: { displayName: true } } } });
    if (!order) throw new NotFoundException("Order not found");
    return { conversationId: null, context: conversationContextInfo(`Заказ ${order.orderNumber}`, context.organizationId === order.buyerOrganizationId ? order.supplier.displayName : order.buyer.displayName, null, this.media) };
  }

  async uploadAttachment(input: UploadConversationAttachmentInput, context: SupplierActorContext) {
    await this.authorize(context, true);
    await this.lookup({ contextType: input.contextType, contextId: input.contextId }, context);
    return this.attachments.upload(input, context);
  }

  async downloadAttachment(id: string, messageId: string, assetId: string, context: SupplierActorContext) {
    const conversation = await this.requireConversation(id, context);
    return this.attachments.download(conversation, id, messageId, assetId);
  }

  async send(id: string, input: ConversationMessageInput, context: SupplierActorContext) {
    const conversation = await this.requireConversation(id, context, true);
    return this.prisma.$transaction(tx => this.append(tx, conversation, input, context));
  }

  private async append(tx: Prisma.TransactionClient, conversation: BusinessConversation, input: ConversationMessageInput, context: SupplierActorContext, notifyOperators = true) {
    // Serialize sequence allocation, resolve/reopen and replay checks on the conversation row.
    await tx.$queryRaw`SELECT id FROM "BusinessConversation" WHERE id = ${conversation.id}::uuid FOR UPDATE`;
    const previous = await tx.conversationMessage.findUnique({ where: { conversationId_authorId_idempotencyKey: { conversationId: conversation.id, authorId: context.actorId, idempotencyKey: input.idempotencyKey } } });
    if (previous) {
      if (previous.body !== input.body || previous.authorOrganizationId !== context.organizationId ||
        !await this.attachments.sameReferences(tx, conversation.id, previous.id, input.attachments ?? [])) throw new ConflictException("Message key was already used with different content");
      return { conversationId: conversation.id };
    }
    const current = await tx.businessConversation.findUniqueOrThrow({ where: { id: conversation.id } });
    const ticket = current.supportTicketId ? await tx.supportTicket.findUniqueOrThrow({ where: { id: current.supportTicketId } }) : null;
    const author = await tx.user.findUniqueOrThrow({ where: { id: context.actorId }, select: { displayName: true } });
    const updated = await tx.businessConversation.update({ where: { id: conversation.id }, data: { latestSequence: { increment: 1 }, version: { increment: 1 }, resolved: ticket ? reviewFinished(ticket.status) : false } });
    const authorRole = context.organizationId === conversation.buyerOrganizationId ? "BUYER" : context.organizationId === conversation.supplierOrganizationId ? "SUPPLIER" : "OPERATOR";
    if (ticket && !reviewFinished(ticket.status) && ((authorRole === "OPERATOR" && !ticket.firstResponseAt) || ticket.status === "WAITING_CUSTOMER" && authorRole !== "OPERATOR")) {
      await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: "IN_PROGRESS", ...(authorRole === "OPERATOR" ? { firstResponseAt: new Date() } : {}), version: { increment: 1 } } });
    }
    const message = await tx.conversationMessage.create({ data: { conversationId: conversation.id, sequence: updated.latestSequence, authorId: context.actorId, authorOrganizationId: context.organizationId, authorName: author.displayName, authorRole, body: input.body, idempotencyKey: input.idempotencyKey } });
    await this.attachments.link(tx, input.attachments ?? [], context, conversation, conversation.id, message.id);
    await tx.auditLog.create({ data: { ...context, action: "conversation.message.saved", entityType: "BusinessConversation", entityId: conversation.id, after: { messageId: message.id, sequence: message.sequence, authorRole } } });
    await tx.outboxEvent.create({ data: { aggregateType: "BusinessConversation", aggregateId: conversation.id, eventType: "ConversationMessageSaved", payload: { conversationId: conversation.id, messageId: message.id, authorOrganization: context.organizationId, buyerOrganizationId: conversation.buyerOrganizationId, supplierOrganizationId: conversation.supplierOrganizationId, ...(notifyOperators && ticket && !reviewFinished(ticket.status) ? await operatorAudience(tx) : {}) } } });
    return { conversationId: conversation.id };
  }

  private summary(conversation: WithParties, context: SupplierActorContext, lastMessage: string, unread: boolean): ConversationSummary {
    const counterpartyName = context.organizationId === conversation.buyerOrganizationId ? conversation.supplier.displayName : context.organizationId === conversation.supplierOrganizationId ? conversation.buyer.displayName : `${conversation.buyer.displayName} / ${conversation.supplier.displayName}`;
    return { id: conversation.id, productId: conversation.offer?.productVariant.productId ?? null, contextType: conversation.contextType as "OFFER" | "ORDER", contextId: conversation.contextId, title: conversation.title, buyerOrganizationId: conversation.buyerOrganizationId, supplierOrganizationId: conversation.supplierOrganizationId, counterpartyName, resolved: conversation.supportTicket ? reviewFinished(conversation.supportTicket.status) : conversation.resolved, version: conversation.version, latestSequence: conversation.latestSequence, lastMessage, updatedAt: conversation.updatedAt.toISOString(), unread, supportTicketId: conversation.supportTicketId, supportStatus: conversation.supportTicket?.status ?? null,
      context: conversationContextInfo(conversation.title, counterpartyName, conversation.offer, this.media) };
  }

  async list(query: ConversationQuery, context: SupplierActorContext) {
    await this.authorize(context);
    const operator = await this.operator(context);
    const accessible = Prisma.sql`(c."buyerOrganizationId" = ${context.organizationId}::uuid OR c."supplierOrganizationId" = ${context.organizationId}::uuid OR (${operator} AND c."supportTicketId" IS NOT NULL)) AND c."latestSequence" > 0`;
    const unread = Prisma.sql`EXISTS (SELECT 1 FROM "ConversationMessage" m WHERE m."conversationId" = c.id AND m."authorOrganizationId" <> ${context.organizationId}::uuid AND m.sequence > COALESCE((SELECT r."throughSequence" FROM "ConversationRead" r WHERE r."conversationId" = c.id AND r."userId" = ${context.actorId}::uuid AND r."organizationId" = ${context.organizationId}::uuid), 0))`;
    const [rows, counts] = await Promise.all([
      this.prisma.$queryRaw<{ id: string; unread: boolean }[]>(Prisma.sql`SELECT c.id, ${unread} AS unread FROM "BusinessConversation" c WHERE ${accessible} AND (${query.filter !== "ORDERS"} OR c."contextType" = 'ORDER') AND (${query.filter !== "UNREAD"} OR ${unread}) ORDER BY c."updatedAt" DESC, c.id DESC LIMIT ${query.limit + 1} OFFSET ${query.offset}`),
      this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS count FROM "BusinessConversation" c WHERE ${accessible} AND ${unread}`),
    ]);
    const conversations = await this.prisma.businessConversation.findMany({ where: { id: { in: rows.slice(0, query.limit).map(row => row.id) } }, include: { ...withParties, messages: { orderBy: { sequence: "desc" }, take: 1 } } });
    const byId = new Map(conversations.map(item => [item.id, item]));
    return { items: rows.slice(0, query.limit).map(row => { const item = byId.get(row.id)!; return this.summary(item, context, item.messages[0]?.body || "Вложение", row.unread); }), hasMore: rows.length > query.limit, unreadCount: Number(counts[0]?.count ?? 0) };
  }

  async get(id: string, context: SupplierActorContext, beforeSequence?: number): Promise<ConversationDetail> {
    const conversation = await this.requireConversation(id, context);
    const [messages, reads, unread] = await Promise.all([
      this.prisma.conversationMessage.findMany({ where: { conversationId: id, ...(beforeSequence ? { sequence: { lt: beforeSequence } } : {}) }, orderBy: { sequence: "desc" }, take: 51 }),
      this.prisma.conversationRead.groupBy({ by: ["organizationId"], where: { conversationId: id }, _max: { throughSequence: true } }),
      this.prisma.conversationRead.findUnique({ where: { conversationId_userId_organizationId: { conversationId: id, userId: context.actorId, organizationId: context.organizationId } } }),
    ]);
    const incoming = await this.prisma.conversationMessage.count({ where: { conversationId: id, authorOrganizationId: { not: context.organizationId }, sequence: { gt: unread?.throughSequence ?? 0 } } });
    const files = await this.attachments.list(id, messages.slice(0, 50).map(message => message.id));
    return { conversation: this.summary(conversation, context, messages[0]?.body || "Вложение", incoming > 0), hasOlder: messages.length > 50, messages: messages.slice(0, 50).reverse().map(message => ({ ...message, attachments: files.get(message.id) ?? [], authorRole: message.authorRole as "BUYER" | "SUPPLIER" | "OPERATOR", createdAt: message.createdAt.toISOString(), readByCounterparty: reads.some(read => read.organizationId !== message.authorOrganizationId && [conversation.buyerOrganizationId, conversation.supplierOrganizationId].includes(read.organizationId) && (read._max.throughSequence ?? 0) >= message.sequence) })) };
  }

  async read(id: string, throughSequence: number, context: SupplierActorContext) {
    const conversation = await this.requireConversation(id, context);
    if (throughSequence > conversation.latestSequence) throw new BadRequestException("Read cursor exceeds saved messages");
    // GREATEST prevents slower tabs from moving the personal cursor backwards.
    const rows = await this.prisma.$queryRaw<{ throughSequence: number }[]>`INSERT INTO "ConversationRead" ("conversationId", "userId", "organizationId", "throughSequence", "updatedAt") VALUES (${id}::uuid, ${context.actorId}::uuid, ${context.organizationId}::uuid, ${throughSequence}, NOW()) ON CONFLICT ("conversationId", "userId", "organizationId") DO UPDATE SET "throughSequence" = GREATEST("ConversationRead"."throughSequence", EXCLUDED."throughSequence"), "updatedAt" = NOW() RETURNING "throughSequence"`;
    return rows[0];
  }

  async resolve(id: string, expectedVersion: number, context: SupplierActorContext, decision?: string) {
    await this.requireConversation(id, context, true);
    const operator = await this.operator(context);
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "BusinessConversation" WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await tx.businessConversation.findUniqueOrThrow({ where: { id } });
      if (current.version !== expectedVersion) throw new ConflictException("Conversation changed; refresh before resolving");
      if (current.supportTicketId) {
        if (!operator) throw new ForbiddenException("Рассмотрение завершает оператор поддержки.");
        const ticket = await tx.supportTicket.findUniqueOrThrow({ where: { id: current.supportTicketId } });
        if (reviewFinished(ticket.status)) return { conversationId: id };
        requirePublicDecision(current, ticket.status, "RESOLVED", decision);
        const updated = await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: "RESOLVED", resolvedAt: new Date(), closedAt: null, firstResponseAt: ticket.firstResponseAt ?? new Date(), version: { increment: 1 } } });
        await syncConversationReview(tx, current, ticket, updated, context, decision);
        await tx.auditLog.create({ data: { ...context, action: "support.ticket.updated", entityType: "SupportTicket", entityId: ticket.id, before: { status: ticket.status }, after: { status: updated.status, decision } } });
        await tx.outboxEvent.create({ data: { aggregateType: "SupportTicket", aggregateId: ticket.id, eventType: "SupportTicketUpdated", payload: { organizationId: ticket.organizationId, ticketId: ticket.id, status: updated.status } } });
        return { conversationId: id };
      }
      const result = await tx.businessConversation.updateMany({ where: { id, version: expectedVersion }, data: { resolved: true, version: { increment: 1 } } });
      if (result.count !== 1) throw new ConflictException("Conversation changed; refresh before resolving");
      await tx.auditLog.create({ data: { ...context, action: "conversation.resolved", entityType: "BusinessConversation", entityId: id, after: { expectedVersion } } });
      return { conversationId: id };
    });
  }

  async escalate(id: string, input: ConversationEscalation, context: SupplierActorContext) {
    const conversation = await this.requireConversation(id, context, true);
    if (![conversation.buyerOrganizationId, conversation.supplierOrganizationId].includes(context.organizationId)) throw new ForbiddenException("Only a conversation party can request operator support");
    return this.prisma.$transaction(async tx => workflowCommand(tx, `conversation.escalate:${context.organizationId}:${context.actorId}`, input.idempotencyKey, { id, ...input }, async () => {
      await tx.$queryRaw`SELECT id FROM "BusinessConversation" WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await tx.businessConversation.findUniqueOrThrow({ where: { id } });
      if (current.supportTicketId) {
        const ticket = await tx.supportTicket.findUniqueOrThrow({ where: { id: current.supportTicketId } });
        if (!reviewFinished(ticket.status)) return { ticketId: ticket.id };
        const slaHours = { LOW: 72, NORMAL: 24, HIGH: 8, URGENT: 2 }[ticket.priority];
        const updated = await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: "OPEN", resolvedAt: null, closedAt: null, firstResponseAt: null, slaDueAt: new Date(Date.now() + slaHours * 3_600_000), version: { increment: 1 } } });
        await syncConversationReview(tx, current, ticket, updated, context);
        await this.append(tx, current, { body: `Повторное обращение к оператору: ${input.reason}`, idempotencyKey: input.idempotencyKey }, context, false);
        await tx.outboxEvent.create({ data: { aggregateType: "SupportTicket", aggregateId: ticket.id, eventType: "SupportTicketUpdated", payload: { ticketId: ticket.id, status: "OPEN", action: "REOPEN", ...await operatorAudience(tx) } } });
        return { ticketId: ticket.id };
      }
      const ticket = await tx.supportTicket.create({ data: { number: `SUP-${crypto.randomUUID()}`, organizationId: context.organizationId, requesterId: context.actorId, subject: conversation.title, description: input.reason, category: "CONVERSATION", priority: "NORMAL", slaDueAt: new Date(Date.now() + 86_400_000) } });
      await tx.supportLink.create({ data: { ticketId: ticket.id, entityType: "BusinessConversation", entityId: id, label: conversation.title } });
      await tx.supportMessage.create({ data: { ticketId: ticket.id, authorId: context.actorId, body: input.reason } });
      await tx.businessConversation.update({ where: { id }, data: { supportTicketId: ticket.id, version: { increment: 1 } } });
      await this.append(tx, conversation, { body: `Обращение к оператору: ${input.reason}`, idempotencyKey: input.idempotencyKey }, context, false);
      await tx.auditLog.create({ data: { ...context, action: "conversation.escalated", entityType: "BusinessConversation", entityId: id, after: { ticketId: ticket.id, reason: input.reason } } });
      await tx.outboxEvent.create({ data: { aggregateType: "SupportTicket", aggregateId: ticket.id, eventType: "SupportTicketCreated", payload: { ticketId: ticket.id, number: ticket.number, organizationId: context.organizationId, priority: ticket.priority, ...await operatorAudience(tx) } } });
      return { ticketId: ticket.id };
    }));
  }
}
