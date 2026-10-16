import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import type {
  OutboxDeadLetterListResponse,
  OutboxDeadLetterQuery,
  OutboxReplayInput,
  OutboxReplayResponse,
} from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";

type OperationsContext = { actorId: string; organizationId: string };
const OUTBOX_REPLAY_SCOPE = "outbox.dead-letter.replay";
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1_000;

const deadLetterSelect = {
  id: true,
  aggregateType: true,
  aggregateId: true,
  eventType: true,
  status: true,
  attempts: true,
  maxAttempts: true,
  availableAt: true,
  lockedAt: true,
  publishedAt: true,
  lastError: true,
  createdAt: true,
} as const;

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOperator(organizationId: string) {
    const capability = await this.prisma.organizationCapability.findUnique({
      where: {
        organizationId_capability: {
          organizationId,
          capability: "MARKETPLACE_OPERATOR",
        },
      },
      select: { organizationId: true },
    });
    if (!capability)
      throw new ForbiddenException("Marketplace operator access is required");
  }

  async listDeadLetters(
    query: OutboxDeadLetterQuery,
    context: OperationsContext,
  ): Promise<OutboxDeadLetterListResponse> {
    await this.assertOperator(context.organizationId);
    const where = {
      status: "DEAD_LETTER" as const,
      eventType: query.eventType,
    };
    const [events, total] = await Promise.all([
      this.prisma.outboxEvent.findMany({
        where,
        select: deadLetterSelect,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: query.limit,
      }),
      this.prisma.outboxEvent.count({ where }),
    ]);
    return {
      items: events.map((event) => ({
        id: event.id,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        status: "DEAD_LETTER" as const,
        attempts: event.attempts,
        maxAttempts: event.maxAttempts,
        availableAt: event.availableAt.toISOString(),
        lockedAt: event.lockedAt?.toISOString() ?? null,
        publishedAt: event.publishedAt?.toISOString() ?? null,
        lastError: event.lastError,
        createdAt: event.createdAt.toISOString(),
      })),
      total,
      limit: query.limit,
      generatedAt: new Date().toISOString(),
    };
  }

  private replayRequestHash(eventId: string, reason: string) {
    return createHash("sha256")
      .update(JSON.stringify({ eventId, reason }))
      .digest("hex");
  }

  private readExistingReplay(
    existing: {
      requestHash: string;
      responseCode: number | null;
      responseBody: unknown;
    },
    requestHash: string,
  ): OutboxReplayResponse {
    if (existing.requestHash !== requestHash) {
      throw new ConflictException(
        "Outbox replay idempotency key is already used for another request",
      );
    }
    if (existing.responseCode !== 200 || !existing.responseBody) {
      throw new ConflictException("Outbox replay is already in progress");
    }
    return existing.responseBody as OutboxReplayResponse;
  }

  private isUniqueViolation(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  async replayDeadLetter(
    eventId: string,
    input: OutboxReplayInput,
    context: OperationsContext,
  ): Promise<OutboxReplayResponse> {
    await this.assertOperator(context.organizationId);
    const requestHash = this.replayRequestHash(eventId, input.reason);
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        scope_key: { scope: OUTBOX_REPLAY_SCOPE, key: input.idempotencyKey },
      },
    });
    if (existing) return this.readExistingReplay(existing, requestHash);

    const replayedAt = new Date();
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const idempotency = await tx.idempotencyRecord.create({
            data: {
              scope: OUTBOX_REPLAY_SCOPE,
              key: input.idempotencyKey,
              requestHash,
              expiresAt: new Date(replayedAt.getTime() + IDEMPOTENCY_TTL_MS),
            },
          });
          const event = await tx.outboxEvent.findUnique({
            where: { id: eventId },
            select: deadLetterSelect,
          });
          if (!event) throw new NotFoundException("Outbox event not found");
          if (event.status !== "DEAD_LETTER") {
            throw new ConflictException(
              "Only DEAD_LETTER outbox events can be replayed",
            );
          }
          const updated = await tx.outboxEvent.updateMany({
            where: { id: eventId, status: "DEAD_LETTER" },
            data: {
              status: "PENDING",
              attempts: 0,
              availableAt: replayedAt,
              lockedAt: null,
              lockedBy: null,
              publishedAt: null,
              lastError: null,
            },
          });
          if (updated.count !== 1) {
            throw new ConflictException(
              "Outbox event changed before replay could be claimed",
            );
          }
          await tx.auditLog.create({
            data: {
              actorId: context.actorId,
              organizationId: context.organizationId,
              action: "outbox.dead_letter.replayed",
              entityType: "OutboxEvent",
              entityId: event.id,
              before: {
                status: event.status,
                attempts: event.attempts,
                lastError: event.lastError,
              } as Prisma.InputJsonValue,
              after: {
                status: "PENDING",
                attempts: 0,
                availableAt: replayedAt.toISOString(),
                reason: input.reason,
                idempotencyKey: input.idempotencyKey,
              } as Prisma.InputJsonValue,
              correlationId: randomUUID(),
            },
          });
          const response: OutboxReplayResponse = {
            eventId: event.id,
            status: "PENDING",
            attempts: 0,
            replayedAt: replayedAt.toISOString(),
          };
          await tx.idempotencyRecord.update({
            where: { id: idempotency.id },
            data: {
              responseCode: 200,
              responseBody: response as Prisma.InputJsonValue,
            },
          });
          return response;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const concurrent = await this.prisma.idempotencyRecord.findUnique({
        where: {
          scope_key: { scope: OUTBOX_REPLAY_SCOPE, key: input.idempotencyKey },
        },
      });
      if (!concurrent) throw error;
      return this.readExistingReplay(concurrent, requestHash);
    }
  }

}
