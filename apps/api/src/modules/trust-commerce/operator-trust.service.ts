import { ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { operatorTrustSchema, operatorTrustEventsSchema, operatorTrustResolvedSchema, type OperatorTrustQuery, type OperatorTrustResolve } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PlatformAuthorityPolicy, type AuthorityActorContext } from "../access-control/platform-authority.policy";

const limit = 25;
const appealSelect = { id: true, status: true, reason: true, decision: true, createdAt: true, decidedAt: true, evidence: true } as const;
const appealView = (row: { id: string; status: string; reason: string; decision: string | null; createdAt: Date; decidedAt: Date | null; evidence: unknown }) => ({
  id: row.id, status: row.status, reason: row.reason, decision: row.decision, createdAt: row.createdAt.toISOString(), decidedAt: row.decidedAt?.toISOString() ?? null, hasEvidence: row.evidence != null,
});

@Injectable()
export class OperatorTrustService {
  constructor(private readonly prisma: PrismaService, private readonly authority: PlatformAuthorityPolicy, private readonly access: AccessControlService) {}

  private allowed(context: AuthorityActorContext, permission: string) { return this.access.hasAll(context.actorId, context.organizationId, [permission]); }
  private async platform(context: AuthorityActorContext) {
    if (!context.actorId || !context.organizationId) throw new UnauthorizedException("Active user and organization context are required");
    await this.authority.assertPlatformOperator(context);
  }
  private async require(context: AuthorityActorContext, permission: string) {
    await this.platform(context);
    if (!await this.allowed(context, permission)) throw new ForbiddenException("Insufficient permissions");
  }
  private async source<T>(allowed: boolean, read: () => Promise<T>) {
    if (!allowed) return { status: "FORBIDDEN" as const, data: null };
    try { return { status: "AVAILABLE" as const, data: await read() }; }
    catch (cause) {
      if (cause instanceof HttpException && [401, 403].includes(cause.getStatus())) throw cause;
      return { status: "UNAVAILABLE" as const, data: null };
    }
  }

  async overview(query: OperatorTrustQuery, context: AuthorityActorContext) {
    await this.platform(context);
    const [incidentsAllowed, ratingsAllowed, warehousesAllowed, canResolve] = await Promise.all([
      "trust.incident.view", "trust.rating.view", "inventory.view", "trust.incident.manage",
    ].map(permission => this.allowed(context, permission)));
    if (!incidentsAllowed && !ratingsAllowed) throw new ForbiddenException("Insufficient permissions");
    const [incidents, suppliers, warehouses] = await Promise.all([
      this.source(incidentsAllowed, () => this.prisma.$transaction(async tx => {
        const [total, open, hardBlocks, pendingAppeals, rows] = await Promise.all([
          tx.productGapIncident.count(), tx.productGapIncident.count({ where: { status: { not: "RESOLVED" } } }),
          tx.productGapIncident.count({ where: { status: { not: "RESOLVED" }, actionType: "HARD_BLOCK" } }),
          tx.productGapAppeal.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
          tx.productGapIncident.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: query.incidentOffset, take: limit,
            include: { _count: { select: { appeals: true } }, appeals: { select: appealSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit } } }),
        ]);
        const ids = [...new Set(rows.flatMap(row => row.impactedOrganizationId ? [row.impactedOrganizationId] : []))];
        const organizations = ids.length ? await tx.organization.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } }) : [];
        return { total, open, hardBlocks, pendingAppeals, offset: query.incidentOffset, limit, items: rows.map(row => ({
          id: row.id, version: row.version, organizationId: row.impactedOrganizationId, organizationName: organizations.find(org => org.id === row.impactedOrganizationId)?.displayName ?? null,
          subjectType: row.subjectType, subjectId: row.subjectId, type: row.type, severity: row.severity, status: row.status, reasonCode: row.reasonCode,
          explanation: row.explanation, actionType: row.actionType, actionExpiresAt: row.actionExpiresAt?.toISOString() ?? null, remediation: row.remediation, restorationCondition: row.restorationCondition,
          hardBlockReason: row.hardBlockReason, resolution: row.resolution, createdAt: row.createdAt.toISOString(), sourceEntityType: row.sourceEntityType, sourceEntityId: row.sourceEntityId,
          appeals: row.appeals.map(appealView), appealCount: row._count.appeals,
        })) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })),
      this.source(ratingsAllowed, () => this.prisma.$transaction(async tx => {
        const total = await tx.supplierProfile.count();
        const profiles = await tx.supplierProfile.findMany({ orderBy: { organizationId: "asc" }, skip: query.supplierOffset, take: limit, select: { organizationId: true, organization: { select: { displayName: true } } } });
        const ids = profiles.map(row => row.organizationId);
        const snapshots = ids.length ? await tx.supplierTrustSnapshot.findMany({ where: { supplierOrganizationId: { in: ids } },
          include: { _count: { select: { appeals: true } }, appeals: { select: appealSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit } } }) : [];
        return { total, offset: query.supplierOffset, limit, items: profiles.map(profile => {
          const snapshot = snapshots.find(row => row.supplierOrganizationId === profile.organizationId);
          return { id: profile.organizationId, name: profile.organization.displayName,
            snapshot: snapshot ? { status: snapshot.status, score: snapshot.score?.toString() ?? null, confidence: snapshot.confidence.toString(), eventCount: snapshot.eventCount,
              computedAt: snapshot.computedAt.toISOString(), formulaVersion: snapshot.formulaVersion, windowDays: snapshot.windowDays } : null,
            appeals: snapshot?.appeals.map(appealView) ?? [], appealCount: snapshot?._count.appeals ?? 0 };
        }) };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })),
      this.source(warehousesAllowed, () => this.prisma.$transaction(async tx => ({ total: await tx.warehouse.count(), verified: await tx.warehouse.count({ where: { geoStatus: "VERIFIED" } }) }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })),
    ]);
    return operatorTrustSchema.parse({ observedAt: new Date().toISOString(), automaticFlow: "NOT_VERIFIED", canResolve, incidents, suppliers, warehouses });
  }

  async events(supplierOrganizationId: string, offset: number, context: AuthorityActorContext) {
    await this.require(context, "trust.rating.view");
    return this.prisma.$transaction(async tx => {
      if (!await tx.supplierProfile.findUnique({ where: { organizationId: supplierOrganizationId }, select: { organizationId: true } })) throw new NotFoundException("Supplier not found");
      const where = { supplierOrganizationId };
      const total = await tx.supplierTrustMetricEvent.count({ where });
      const rows = await tx.supplierTrustMetricEvent.findMany({ where, orderBy: [{ occurredAt: "desc" }, { id: "desc" }], skip: offset, take: limit,
        select: { id: true, metricCode: true, value: true, occurredAt: true, sourceEntityType: true, sourceEntityId: true, disputed: true, excludedAt: true } });
      // A source label is caller-controlled. Only an audit record proves use of the manual command;
      // neither a label nor an existing referenced object proves an automatic producer.
      const audits = rows.length ? await tx.auditLog.findMany({ where: { action: "trust.metric.recorded", entityType: "SupplierTrustMetricEvent", entityId: { in: rows.map(row => row.id) } }, distinct: ["entityId"], select: { entityId: true } }) : [];
      const manual = new Set(audits.map(row => row.entityId));
      return operatorTrustEventsSchema.parse({ total, offset, limit, automaticFlow: "NOT_VERIFIED", items: rows.map(row => ({ ...row, value: row.value.toString(), occurredAt: row.occurredAt.toISOString(), excludedAt: row.excludedAt?.toISOString() ?? null, origin: manual.has(row.id) ? "MANUAL_RECORDED" : "UNVERIFIED" })) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async resolve(id: string, input: OperatorTrustResolve, context: AuthorityActorContext) {
    await this.require(context, "trust.incident.manage");
    return this.prisma.$transaction(async tx => {
      const row = await tx.productGapIncident.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("Incident not found");
      if (row.version !== input.version || row.status === "RESOLVED") throw new ConflictException("Incident changed; reload before updating");
      if (await tx.productGapAppeal.count({ where: { incidentId: id, status: { in: ["OPEN", "UNDER_REVIEW"] } } })) throw new ConflictException("An appeal requires a decision before restoration");
      const updated = await tx.productGapIncident.updateMany({ where: { id, version: input.version }, data: { status: "RESOLVED", actionType: "NONE", resolution: input.resolution, resolvedAt: new Date(), resolvedById: context.actorId, version: { increment: 1 } } });
      if (updated.count !== 1) throw new ConflictException("Incident changed; reload before updating");
      await tx.auditLog.create({ data: { ...context, action: "trust.incident.updated", entityType: "ProductGapIncident", entityId: id, before: { status: row.status, actionType: row.actionType, version: row.version }, after: { status: "RESOLVED", actionType: "NONE", version: row.version + 1, resolution: input.resolution } } });
      return operatorTrustResolvedSchema.parse({ id, version: row.version + 1, status: "RESOLVED" });
    });
  }
}
