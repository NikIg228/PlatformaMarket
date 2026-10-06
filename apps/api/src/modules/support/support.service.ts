import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AddSupportMessageInput, CreateSupportTicketInput, UpdateSupportTicketInput } from "@marketplace/schemas";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/prisma/prisma.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { AccessControlService } from "../access-control/access-control.service";
import { workflowCommand } from "./workflow-command";
import { SupportAttachmentsService } from "./support-attachments.service";
import { supportAttachmentSchema } from "@marketplace/schemas";

const slaHours = { LOW: 72, NORMAL: 24, HIGH: 8, URGENT: 2 } as const;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessControlService, private readonly attachments: SupportAttachmentsService) {}

  private async isOperator(organizationId: string) {
    return Boolean(await this.prisma.organizationCapability.findUnique({ where: { organizationId_capability: { organizationId, capability: "MARKETPLACE_OPERATOR" } } }));
  }

  private async requireTicket(ticketId: string, context: SupplierActorContext) {
    const operator = await this.isOperator(context.organizationId);
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id: ticketId, ...(operator ? {} : { organizationId: context.organizationId }) } });
    if (!ticket) throw new NotFoundException("Support ticket not found");
    return ticket;
  }

  private async operatorAudience(tx: Prisma.TransactionClient) {
    const organizations = await tx.organizationCapability.findMany({ where: { capability: "MARKETPLACE_OPERATOR" }, select: { organizationId: true } });
    return Object.fromEntries(organizations.map((organization, index) => [`support${index}OrganizationId`, organization.organizationId]));
  }

  async create(input: CreateSupportTicketInput, context: SupplierActorContext) {
    const number = `SUP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => workflowCommand(tx, `support.create:${context.organizationId}:${context.actorId}`, input.idempotencyKey, input, async () => {
      const ticket = await tx.supportTicket.create({ data: { number, organizationId: context.organizationId, requesterId: context.actorId, subject: input.subject, description: input.description, category: input.category, priority: input.priority, slaDueAt: new Date(Date.now() + slaHours[input.priority] * 3_600_000) } });
      if (input.links.length) await tx.supportLink.createMany({ data: input.links.map((link) => ({ ticketId: ticket.id, ...link })) });
      const messageId = crypto.randomUUID();
      const attachments = input.attachments?.length ? await this.attachments.link(tx, input.attachments, context, ticket.id, messageId) : [];
      await tx.supportMessage.create({ data: { id: messageId, ticketId: ticket.id, authorId: context.actorId, body: input.description, attachments } });
      await tx.auditLog.create({ data: { ...context, action: "support.ticket.created", entityType: "SupportTicket", entityId: ticket.id, after: { number, priority: input.priority, category: input.category, links: input.links } } });
      await tx.outboxEvent.create({ data: { aggregateType: "SupportTicket", aggregateId: ticket.id, eventType: "SupportTicketCreated", payload: { ticketId: ticket.id, number, organizationId: context.organizationId, priority: input.priority, ...await this.operatorAudience(tx) } } });
      return ticket;
    }));
  }

  async list(context: SupplierActorContext, status?: string, offset = 0, options: { q?: string; sort?: "queue" | "recent" } = {}) {
    const operator = await this.isOperator(context.organizationId);
    return this.prisma.supportTicket.findMany({ where: { organizationId: operator ? undefined : context.organizationId, status: status as never, ...(options.q ? { OR: [{ number: { contains: options.q, mode: "insensitive" as const } }, { subject: { contains: options.q, mode: "insensitive" as const } }] } : {}) }, orderBy: options.sort === "recent" ? [{ updatedAt: "desc" }, { id: "desc" }] : [{ priority: "desc" }, { slaDueAt: "asc" }, { updatedAt: "desc" }, { id: "desc" }], take: 50, skip: offset });
  }

  async get(ticketId: string, context: SupplierActorContext, beforeMessageId?: string) {
    const ticket = await this.requireTicket(ticketId, context);
    const operator = await this.isOperator(context.organizationId);
    const cursor = beforeMessageId ? await this.prisma.supportMessage.findFirst({ where: { id: beforeMessageId, ticketId, isInternal: operator ? undefined : false } }) : null;
    if (beforeMessageId && !cursor) throw new NotFoundException("Message cursor not found");
    const [messages, links] = await Promise.all([this.prisma.supportMessage.findMany({ where: { ticketId, isInternal: operator ? undefined : false, ...(cursor ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 }), this.prisma.supportLink.findMany({ where: { ticketId }, orderBy: { createdAt: "asc" }, take: 20 })]);
    const members = await this.prisma.organizationMembership.findMany({ where: { organizationId: ticket.organizationId, userId: { in: messages.map(message => message.authorId) } }, select: { userId: true } });
    const customerAuthors = new Set([ticket.requesterId, ...members.map(member => member.userId)]);
    return { ...ticket, messages: messages.slice(0, 50).reverse().map(message => ({ ...message, attachments: supportAttachmentSchema.array().safeParse(message.attachments).data ?? [], authorLabel: message.authorId === context.actorId ? "Вы" : customerAuthors.has(message.authorId) ? "Сотрудник организации" : "Поддержка" })), hasOlder: messages.length > 50, links };
  }

  async addMessage(ticketId: string, input: AddSupportMessageInput, context: SupplierActorContext) {
    await this.requireTicket(ticketId, context);
    const operator = await this.isOperator(context.organizationId);
    if (input.isInternal && !operator) throw new ForbiddenException("Internal notes are available only to support operators");
    if (input.reopen && operator && !await this.access.hasAll(context.actorId, context.organizationId, ["support.ticket.manage"])) throw new ForbiddenException("Для повторного открытия оператору требуется право управления поддержкой.");
    return this.prisma.$transaction(async (tx) => workflowCommand(tx, `support.message:${context.organizationId}:${context.actorId}`, input.idempotencyKey, { ticketId, ...input }, async () => {
      await tx.$queryRaw`SELECT id FROM "SupportTicket" WHERE id = ${ticketId}::uuid FOR UPDATE`;
      const current = await tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
      const terminal = current.status === "RESOLVED" || current.status === "CLOSED";
      if (terminal && !input.isInternal && !input.reopen) throw new ConflictException("Обращение завершено. Откройте его повторно, чтобы продолжить переписку.");
      if (input.reopen && input.isInternal) throw new ConflictException("Внутренняя заметка не открывает обращение повторно.");
      const messageId = crypto.randomUUID();
      const attachments = input.attachments.length ? await this.attachments.link(tx, input.attachments, context, ticketId, messageId) : [];
      const message = await tx.supportMessage.create({ data: { id: messageId, ticketId, authorId: context.actorId, body: input.body, isInternal: input.isInternal, attachments } });
      const patch = operator && !input.isInternal && !current.firstResponseAt ? { firstResponseAt: new Date(), ...(current.status === "OPEN" ? { status: "IN_PROGRESS" as const } : {}) } : !operator && current.status === "WAITING_CUSTOMER" ? { status: "IN_PROGRESS" as const } : {};
      await tx.supportTicket.update({ where: { id: ticketId }, data: { ...patch, ...(terminal && input.reopen ? { status: "IN_PROGRESS", resolvedAt: null, closedAt: null, slaDueAt: new Date(Date.now() + slaHours[current.priority] * 3_600_000) } : {}), version: { increment: 1 } } });
      await tx.auditLog.create({ data: { ...context, action: input.isInternal ? "support.note.added" : "support.message.added", entityType: "SupportTicket", entityId: ticketId, after: { messageId: message.id, attachmentCount: input.attachments.length } } });
      if (terminal && input.reopen) await tx.auditLog.create({ data: { ...context, action: "support.ticket.reopened", entityType: "SupportTicket", entityId: ticketId, before: { status: current.status }, after: { status: "IN_PROGRESS", messageId: message.id } } });
      if (!input.isInternal) await tx.outboxEvent.create({ data: { aggregateType: "SupportTicket", aggregateId: ticketId, eventType: "SupportTicketUpdated", payload: { ticketId, number: current.number, messageId: message.id, action: terminal && input.reopen ? "REOPEN" : "MESSAGE", ...(operator ? { organizationId: current.organizationId } : await this.operatorAudience(tx)) } } });
      return message;
    }));
  }

  async update(ticketId: string, input: UpdateSupportTicketInput, context: SupplierActorContext) {
    const ticket = await this.requireTicket(ticketId, context);
    if (!(await this.isOperator(context.organizationId))) throw new ForbiddenException("Only support operators can manage ticket workflow");
    if (input.assigneeId && !await this.access.hasAll(input.assigneeId, context.organizationId, ["support.ticket.manage"])) throw new ConflictException("Assignee must be an active support operator in your organization");
    const { expectedVersion, reason, idempotencyKey, slaDueAt, ...patch } = input;
    return this.prisma.$transaction(tx => workflowCommand(tx, `support.update:${context.organizationId}:${context.actorId}`, idempotencyKey, { ticketId, ...input }, async () => {
      const now = new Date();
      const changed = await tx.supportTicket.updateMany({ where: { id: ticketId, version: expectedVersion }, data: { ...patch, version: { increment: 1 }, ...(slaDueAt !== undefined ? { slaDueAt: slaDueAt ? new Date(slaDueAt) : null } : {}), resolvedAt: input.status === "RESOLVED" ? now : input.status && input.status !== "CLOSED" ? null : ticket.resolvedAt, closedAt: input.status === "CLOSED" ? now : input.status ? null : ticket.closedAt } });
      if (changed.count !== 1) throw new ConflictException("Ticket changed; refresh before updating");
      await tx.auditLog.create({ data: { ...context, action: "support.ticket.updated", entityType: "SupportTicket", entityId: ticketId, before: { status: ticket.status, priority: ticket.priority, assigneeId: ticket.assigneeId }, after: { ...input, reason } as Prisma.InputJsonValue } });
      await tx.outboxEvent.create({ data: { aggregateType: "SupportTicket", aggregateId: ticketId, eventType: "SupportTicketUpdated", payload: { organizationId: ticket.organizationId, ticketId, status: input.status ?? ticket.status } } });
      return tx.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    }));
  }

  async history(ticketId: string, context: SupplierActorContext) {
    await this.requireTicket(ticketId, context);
    if (!await this.isOperator(context.organizationId)) throw new ForbiddenException("Ticket workflow history requires operator access");
    return this.prisma.auditLog.findMany({ where: { entityType: "SupportTicket", entityId: ticketId }, select: { id: true, action: true, actorId: true, createdAt: true, before: true, after: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30 });
  }

  async startImpersonation(input: { targetUserId: string; targetOrganizationId: string; ticketId?: string | null; reason: string; durationMinutes: number }, context: SupplierActorContext) {
    if (!(await this.isOperator(context.organizationId))) throw new ForbiddenException("Only support operators can start impersonation");
    const membership = await this.prisma.organizationMembership.findUnique({ where: { userId_organizationId: { userId: input.targetUserId, organizationId: input.targetOrganizationId } } });
    if (membership?.status !== "ACTIVE") throw new NotFoundException("Active target membership not found");
    if (input.ticketId) await this.requireTicket(input.ticketId, context);
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.supportImpersonationSession.create({ data: { operatorId: context.actorId, targetUserId: input.targetUserId, targetOrganizationId: input.targetOrganizationId, ticketId: input.ticketId, reason: input.reason, expiresAt: new Date(Date.now() + input.durationMinutes * 60_000) } });
      await tx.auditLog.create({ data: { ...context, action: "support.impersonation.started", entityType: "SupportImpersonationSession", entityId: session.id, after: { targetUserId: input.targetUserId, targetOrganizationId: input.targetOrganizationId, ticketId: input.ticketId, reason: input.reason, expiresAt: session.expiresAt } } });
      await tx.securityEvent.create({ data: { severity: "HIGH", type: "support.impersonation.started", actorId: context.actorId, organizationId: input.targetOrganizationId, sessionId: session.id, metadata: { ticketId: input.ticketId, reason: input.reason } } });
      return session;
    });
  }

  async endImpersonation(sessionId: string, context: SupplierActorContext) {
    const session = await this.prisma.supportImpersonationSession.findFirst({ where: { id: sessionId, operatorId: context.actorId, endedAt: null } });
    if (!session) throw new NotFoundException("Active impersonation session not found");
    const ended = await this.prisma.supportImpersonationSession.update({ where: { id: sessionId }, data: { endedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { ...context, action: "support.impersonation.ended", entityType: "SupportImpersonationSession", entityId: sessionId, before: { targetOrganizationId: session.targetOrganizationId }, after: { endedAt: ended.endedAt } } });
    return ended;
  }

  knowledge(audience?: string, query?: string) {
    return this.prisma.knowledgeArticle.findMany({ where: { status: "ACTIVE", publishedAt: { lte: new Date() }, audience: audience ? { has: audience } : undefined, OR: query ? [{ title: { contains: query, mode: "insensitive" } }, { summary: { contains: query, mode: "insensitive" } }, { body: { contains: query, mode: "insensitive" } }] : undefined }, select: { id: true, slug: true, title: true, summary: true, audience: true, tags: true, publishedAt: true }, orderBy: { publishedAt: "desc" }, take: 30 });
  }
}
