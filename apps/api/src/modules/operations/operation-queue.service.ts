import { ForbiddenException, Injectable } from "@nestjs/common";
import type { OperationQueueItem, OperationWorkQueue, OperationWorkQueueQuery } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PlatformAuthorityPolicy, type AuthorityActorContext } from "../access-control/platform-authority.policy";
import { environment } from "../../platform/config/environment";
import { operationQueueQuery } from "./operation-queue.query";

type QueueRow = {
  totalOpenItems: number; total: number; id: string | null; queueType: OperationQueueItem["queueType"];
  title: string; organizationId: string; organizationName: string; relatedOrganizationId: string | null; relatedOrganizationName: string | null;
  openedAt: Date; updatedAt: Date; priority: OperationQueueItem["priority"]; dueAt: Date | null; reason: string; target: string;
  assignmentId: string | null; assignmentVersion: number; assignmentReason: string; assignmentUpdatedAt: Date;
  assigneeId: string | null; assigneeName: string | null;
};

@Injectable()
export class OperationQueueService {
  constructor(private readonly prisma: PrismaService, private readonly authority: PlatformAuthorityPolicy, private readonly access: AccessControlService) {}

  async list(query: OperationWorkQueueQuery, context: AuthorityActorContext): Promise<OperationWorkQueue> {
    await this.authority.assertPlatformOperator(context);
    if (!await this.access.hasAll(context.actorId, context.organizationId, ["organization.view"])) throw new ForbiddenException("Operator queue permission is required");
    const now = new Date();
    const rows = await this.prisma.$queryRaw<QueueRow[]>(operationQueueQuery(query, context, now, environment().DEPLOYMENT_PROFILE === "go_live"));
    const total = rows[0]?.total ?? 0, totalOpenItems = rows[0]?.totalOpenItems ?? 0;
    const items: OperationQueueItem[] = rows.filter(row => row.id !== null).map(row => ({
      id: row.id!, caseKey: `${row.queueType}:${row.id}`, queueType: row.queueType, title: row.title,
      organizations: [{ id: row.organizationId, name: row.organizationName },
        ...(row.relatedOrganizationId && row.relatedOrganizationId !== row.organizationId ? [{ id: row.relatedOrganizationId, name: row.relatedOrganizationName! }] : [])],
      openedAt: row.openedAt.toISOString(), updatedAt: row.updatedAt.toISOString(), priority: row.priority,
      dueAt: row.dueAt?.toISOString() ?? null, isOverdue: Boolean(row.dueAt && row.dueAt < now), reason: row.reason,
      href: `/admin?section=${row.target}&queueType=${row.queueType}&object=${row.id}`,
      assignment: row.assignmentId ? { id: row.assignmentId, version: row.assignmentVersion, priority: row.priority,
        assigneeId: row.assigneeId, assigneeName: row.assigneeName, dueAt: row.dueAt?.toISOString() ?? null,
        reason: row.assignmentReason, updatedAt: row.assignmentUpdatedAt.toISOString() } : null,
    }));
    return { generatedAt: now.toISOString(), operatorOrganizationId: context.organizationId, totalOpenItems, total, offset: query.offset, limit: query.limit, hasMore: query.offset + items.length < total, items };
  }
}
