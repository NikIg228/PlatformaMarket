import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { operatorAuditPageSchema, type OperatorAuditQuery } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PlatformAuthorityPolicy, type AuthorityActorContext } from "../access-control/platform-authority.policy";
import { auditChanges, auditObjectHref } from "./operator-audit.projection";

@Injectable()
export class OperatorAuditService {
  constructor(private readonly prisma: PrismaService, private readonly authority: PlatformAuthorityPolicy, private readonly access: AccessControlService) {}
  async list(query: OperatorAuditQuery, context: AuthorityActorContext) {
    await this.authority.assertPlatformOperator(context);
    if (!await this.access.hasAll(context.actorId, context.organizationId, ["audit.view"])) throw new ForbiddenException("Insufficient permissions");
    const rights = ["organization.view", "order.confirm", "support.ticket.view", "import.manage"];
    const allowed = await Promise.all(rights.map(right => this.access.hasAll(context.actorId, context.organizationId, [right])));
    const permissions = new Set(rights.filter((_, index) => allowed[index]));
    const where: Prisma.AuditLogWhereInput = {
      organizationId: query.organizationId, actorId: query.actorId, entityType: query.entityType, entityId: query.entityId,
      action: query.action ? { contains: query.action, mode: "insensitive" } : undefined,
      ...(query.dateFrom || query.dateTo ? { createdAt: {
        ...(query.dateFrom ? { gte: new Date(`${query.dateFrom}T00:00:00+05:00`) } : {}),
        ...(query.dateTo ? { lt: new Date(new Date(`${query.dateTo}T00:00:00+05:00`).getTime() + 86400000) } : {}),
      } } : {}),
    };
    return this.prisma.$transaction(async tx => {
      const total = await tx.auditLog.count({ where });
      const rows = await tx.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: query.offset, take: query.limit,
        select: { id: true, actorId: true, organizationId: true, action: true, entityType: true, entityId: true, before: true, after: true, createdAt: true } });
      const actorIds = [...new Set(rows.flatMap(row => row.actorId ? [row.actorId] : []))], orgIds = [...new Set(rows.flatMap(row => row.organizationId ? [row.organizationId] : []))];
      const actors = actorIds.length ? await tx.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, displayName: true } }) : [];
      const organizations = orgIds.length ? await tx.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, displayName: true } }) : [];
      return operatorAuditPageSchema.parse({ items: rows.map(row => ({ id: row.id, action: row.action, entityType: row.entityType, entityId: row.entityId,
        createdAt: row.createdAt.toISOString(), actor: row.actorId ? { id: row.actorId, name: actors.find(actor => actor.id === row.actorId)?.displayName ?? null } : null,
        organization: row.organizationId ? { id: row.organizationId, name: organizations.find(org => org.id === row.organizationId)?.displayName ?? null } : null,
        ...auditChanges(row.before, row.after), href: auditObjectHref(row.entityType, row.entityId, permissions) })), total, offset: query.offset, limit: query.limit });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
