import { ForbiddenException, HttpException, Injectable } from "@nestjs/common";
import { operatorTechnicalSchema } from "@marketplace/schemas";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { BackgroundQueueService } from "../../platform/jobs/background-queue.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PlatformAuthorityPolicy, type AuthorityActorContext } from "../access-control/platform-authority.policy";

@Injectable()
export class OperatorTechnicalService {
  constructor(private readonly prisma: PrismaService, private readonly authority: PlatformAuthorityPolicy, private readonly access: AccessControlService, private readonly backgroundQueue: BackgroundQueueService) {}
  private async source<T>(allowed: boolean, read: () => Promise<T>) {
    if (!allowed) return { status: "FORBIDDEN" as const, data: null, reason: "INSUFFICIENT_PERMISSIONS" as const };
    try { return { status: "AVAILABLE" as const, data: await read() }; }
    catch (cause) {
      if (cause instanceof HttpException && [401, 403].includes(cause.getStatus())) throw cause;
      return { status: "UNAVAILABLE" as const, data: null, reason: "SOURCE_UNAVAILABLE" as const };
    }
  }
  async get(context: AuthorityActorContext) {
    await this.authority.assertPlatformOperator(context);
    if (!await this.access.hasAll(context.actorId, context.organizationId, ["operations.outbox.view"])) throw new ForbiddenException("Insufficient permissions");
    const [canSearch, canNotifications, canReplay] = await Promise.all(["catalog.product.moderate", "notification.view", "operations.outbox.replay"].map(permission => this.access.hasAll(context.actorId, context.organizationId, [permission])));
    const [search, outbox, notifications, background] = await Promise.all([
      this.source(canSearch, () => this.prisma.$transaction(async tx => {
        const products = await tx.product.count(), indexed = await tx.productSearchDocument.count(), missing = await tx.product.count({ where: { searchDocument: null } });
        const last = await tx.productSearchDocument.aggregate({ _max: { updatedAt: true } });
        return { products, indexed, missing, lastIndexedAt: last._max.updatedAt?.toISOString() ?? null };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })),
      this.source(true, async () => {
        const groups = await this.prisma.outboxEvent.groupBy({ by: ["status"], _count: { _all: true } });
        const count = (status: string) => groups.find(group => group.status === status)?._count._all ?? 0;
        return { pending: count("PENDING"), processing: count("PROCESSING"), failed: count("FAILED"), deadLetter: count("DEAD_LETTER"), published: count("PUBLISHED") };
      }),
      this.source(canNotifications, async () => {
        const groups = await this.prisma.notification.groupBy({ by: ["status"], _count: { _all: true } });
        const count = (status: string) => groups.find(group => group.status === status)?._count._all ?? 0;
        return { pending: count("PENDING"), processing: count("PROCESSING"), failed: count("FAILED"), dead: count("DEAD"), sent: count("SENT"), cancelled: count("CANCELLED") };
      }),
      this.source(true, async () => {
        const health = await this.backgroundQueue.health(), counts = "counts" in health ? health.counts : undefined;
        return { scope: "CURRENT_PROCESS" as const, status: health.status, configured: health.configured, producer: health.producer, consumer: health.consumer,
          counts: counts ? { waiting: counts.waiting ?? 0, active: counts.active ?? 0, failed: counts.failed ?? 0, delayed: counts.delayed ?? 0 } : null };
      }),
    ]);
    return operatorTechnicalSchema.parse({ observedAt: new Date().toISOString(), scope: "PLATFORM_CURRENT_STATE", canReplay, search, outbox, notifications, background });
  }
}
