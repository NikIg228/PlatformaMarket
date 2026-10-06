import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type {
  CreateNotificationInput,
  NotificationPreferenceInput,
  NotificationQueryInput,
} from "@marketplace/schemas";
import { Prisma, type NotificationStatus } from "@prisma/client";
import { PrismaService } from "../../platform/prisma/prisma.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { NotificationAdapterRegistry } from "./notification-adapter-registry.service";
import { BackgroundQueueService } from "../../platform/jobs/background-queue.service";
import type { OutboxEvent } from "@prisma/client";
import { OutboxHandlerRegistry } from "../../platform/outbox/outbox-handler.registry";
import { createHash } from "node:crypto";
import { NotificationInboxReader } from "./notification-inbox";
import type { notificationInboxQuerySchema } from "@marketplace/schemas";
import type { z } from "zod";

@Injectable()
export class NotificationsService implements OnModuleInit {
  private activeTick: Promise<void> | null = null;
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: NotificationAdapterRegistry,
    private readonly backgroundQueue: BackgroundQueueService,
    private readonly outboxHandlers: OutboxHandlerRegistry,
  ) {}

  onModuleInit() {
    this.backgroundQueue.register("notifications.tick", async () =>
      this.tick(),
    );
    this.outboxHandlers.register({
      name: "notifications.projection",
      supports: () => true,
      handle: async (event) => {
        await this.projectOutboxEvent(event);
      },
    });
  }

  private async isOperator(organizationId: string) {
    return Boolean(
      await this.prisma.organizationCapability.findUnique({
        where: {
          organizationId_capability: {
            organizationId,
            capability: "MARKETPLACE_OPERATOR",
          },
        },
      }),
    );
  }

  private async assertOrganizationAccess(
    organizationId: string,
    context: SupplierActorContext,
  ) {
    if (
      organizationId !== context.organizationId &&
      !(await this.isOperator(context.organizationId))
    )
      throw new ForbiddenException(
        "Notifications belong to another organization",
      );
    if (
      !(await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Organization not found");
  }

  async preferences(organizationId: string, context: SupplierActorContext) {
    await this.assertOrganizationAccess(organizationId, context);
    return this.prisma.notificationPreference.findMany({
      where: { organizationId },
      orderBy: [{ eventType: "asc" }, { channel: "asc" }],
    });
  }

  async upsertPreference(
    organizationId: string,
    input: NotificationPreferenceInput,
    context: SupplierActorContext,
  ) {
    await this.assertOrganizationAccess(organizationId, context);
    const scopeKey = input.userId ?? "organization";
    const preference = await this.prisma.notificationPreference.upsert({
      where: {
        organizationId_scopeKey_eventType_channel: {
          organizationId,
          scopeKey,
          eventType: input.eventType,
          channel: input.channel,
        },
      },
      update: {
        enabled: input.enabled,
        destination: input.destination,
        quietHours:
          input.quietHours == null ? Prisma.JsonNull : input.quietHours,
      },
      create: {
        organizationId,
        userId: input.userId,
        scopeKey,
        eventType: input.eventType,
        channel: input.channel,
        enabled: input.enabled,
        destination: input.destination,
        quietHours:
          input.quietHours == null ? Prisma.JsonNull : input.quietHours,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        ...context,
        action: "notification.preference.updated",
        entityType: "NotificationPreference",
        entityId: preference.id,
        after: {
          eventType: preference.eventType,
          channel: preference.channel,
          enabled: preference.enabled,
        },
      },
    });
    return preference;
  }

  async create(input: CreateNotificationInput, context: SupplierActorContext) {
    await this.assertOrganizationAccess(input.recipientOrganizationId, context);
    if (input.recipientUserId && !await this.prisma.organizationMembership.findFirst({ where: { organizationId: input.recipientOrganizationId, userId: input.recipientUserId, status: "ACTIVE", user: { status: "ACTIVE" } }, select: { id: true } })) throw new NotFoundException("Active notification recipient not found");
    const idempotencyKey = `manual:${context.organizationId}:${context.actorId}:${createHash("sha256").update(input.idempotencyKey).digest("hex")}`;
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const notification = await this.prisma.notification.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        ...input,
        idempotencyKey,
        requestHash,
        scheduledAt: input.scheduledAt
          ? new Date(input.scheduledAt)
          : new Date(),
        payload:
          input.payload == null
            ? Prisma.JsonNull
            : (input.payload as Prisma.InputJsonValue),
      },
    });
    if (notification.requestHash !== requestHash) throw new ConflictException("Notification key was already used for different content");
    return notification;
  }

  async list(
    organizationId: string,
    input: NotificationQueryInput,
    context: SupplierActorContext,
  ) {
    await this.assertOrganizationAccess(organizationId, context);
    return this.prisma.notification.findMany({
      where: {
        recipientOrganizationId: organizationId,
        OR: [{ recipientUserId: null }, { recipientUserId: context.actorId }],
        channel: input.channel,
        status: input.status,
        ...(input.unreadOnly ? { readAt: null } : {}),
      },
      include: { deliveryAttempts: { orderBy: { attempt: "desc" }, take: 3 } },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
    });
  }

  async markRead(notificationId: string, context: SupplierActorContext) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException("Notification not found");
    if (notification.recipientUserId && notification.recipientUserId !== context.actorId) throw new NotFoundException("Notification not found");
    await this.assertOrganizationAccess(
      notification.recipientOrganizationId,
      context,
    );
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: notification.readAt ?? new Date() },
    });
  }

  async retry(notificationId: string, context: SupplierActorContext) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException("Notification not found");
    await this.assertOrganizationAccess(
      notification.recipientOrganizationId,
      context,
    );
    if (
      !(["FAILED", "DEAD"] as NotificationStatus[]).includes(
        notification.status,
      )
    )
      throw new ConflictException("Only failed notifications can be retried");
    return this.prisma.$transaction(async tx => {
      const updated = await tx.notification.updateMany({ where: { id: notificationId, status: notification.status, attempts: notification.attempts }, data: { status: "PENDING", scheduledAt: new Date(), lastError: null, ...(notification.status === "DEAD" ? { maxAttempts: notification.attempts + 5 } : {}) } });
      if (updated.count !== 1) throw new ConflictException("Notification changed before retry");
      await tx.auditLog.create({ data: { ...context, action: "notification.retry.requested", entityType: "Notification", entityId: notificationId, after: { previousStatus: notification.status, attempts: notification.attempts } } });
      return tx.notification.findUniqueOrThrow({ where: { id: notificationId } });
    });
  }

  capabilities() {
    return this.registry.capabilities();
  }

  async inbox(organizationId: string, query: z.output<typeof notificationInboxQuerySchema>, context: SupplierActorContext) {
    await this.assertOrganizationAccess(organizationId, context);
    return new NotificationInboxReader(this.prisma).read({ ...context, organizationId }, query);
  }
  async readInbox(organizationId: string, before: string, context: SupplierActorContext) {
    await this.assertOrganizationAccess(organizationId, context);
    return new NotificationInboxReader(this.prisma).readAll({ ...context, organizationId }, before);
  }

  async processForOperator(context: SupplierActorContext) {
    if (!await this.isOperator(context.organizationId)) throw new ForbiddenException("Only operators can process the delivery queue");
    return this.tick();
  }

  @Cron("*/5 * * * * *")
  async scheduledTick() {
    const slot = Math.floor(Date.now() / 5_000);
    if (
      !(await this.backgroundQueue.enqueue(
        "notifications.tick",
        {},
        { jobId: `notifications-${slot}` },
      ))
    )
      await this.tick();
  }

  async tick() {
    if (this.activeTick) return this.activeTick;
    this.activeTick = (async () => {
      await this.processPending();
    })();
    try {
      await this.activeTick;
    } finally {
      this.activeTick = null;
    }
  }

  async projectOutboxEvents() {
    const events = await this.prisma.outboxEvent.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000) },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    let created = 0;
    for (const event of events) {
      created += await this.projectOutboxEvent(event);
    }
    return { scanned: events.length, created };
  }

  async projectOutboxEvent(
    event: Pick<
      OutboxEvent,
      "id" | "aggregateType" | "aggregateId" | "eventType" | "payload"
    >,
  ) {
    const payload =
      event.payload &&
      typeof event.payload === "object" &&
      !Array.isArray(event.payload)
        ? (event.payload as Record<string, unknown>)
        : {};
    const organizationIds = [
      ...new Set(
        Object.entries(payload)
          .filter(
            ([key, value]) =>
              /(?:^organizationId$|OrganizationId$)/.test(key) && typeof value === "string",
          )
          .map(([, value]) => value as string)
          .filter(id => event.eventType !== "ConversationMessageSaved" || id !== payload.authorOrganization),
      ),
    ];
    let created = 0;
    for (const organizationId of organizationIds) {
      if (
        !(await this.prisma.organization.findUnique({
          where: { id: organizationId },
          select: { id: true },
        }))
      )
        continue;
      const preferences = await this.prisma.notificationPreference.findMany({
        where: {
          organizationId,
          eventType: { in: [event.eventType, "*"] },
        },
      });
      const preferencesByScope = new Map<string, typeof preferences[number]>();
      for (const preference of preferences) {
        const key = `${preference.userId ?? "org"}:${preference.channel}`;
        if (!preferencesByScope.has(key) || preference.eventType === event.eventType) preferencesByScope.set(key, preference);
      }
      const channels = preferences.length > 0
        ? [...preferencesByScope.values()].filter(preference => preference.enabled)
        : [{ userId: null, channel: "IN_APP" as const, destination: null }];
      for (const preference of channels) {
        const result = await this.prisma.notification.createMany({
          skipDuplicates: true,
          data: {
            recipientOrganizationId: organizationId,
            recipientUserId: preference.userId,
            eventType: event.eventType,
            channel: preference.channel,
            priority: this.priorityFor(event.eventType),
            subject: this.subjectFor(event.eventType),
            body: this.bodyFor(event.eventType, payload),
            destination: preference.destination,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            idempotencyKey: `outbox:${event.id}:${organizationId}:${preference.userId ?? "org"}:${preference.channel}`,
            payload: payload as Prisma.InputJsonValue,
          },
        });
        created += result.count;
      }
    }
    return created;
  }

  async processPending() {
    const notifications = await this.prisma.notification.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        scheduledAt: { lte: new Date() },
      },
      orderBy: [{ priority: "desc" }, { scheduledAt: "asc" }],
      take: 50,
    });
    let sent = 0;
    let failed = 0;
    for (const notification of notifications) {
      const claimed = await this.prisma.notification.updateMany({
        where: {
          id: notification.id,
          status: notification.status,
          attempts: notification.attempts,
        },
        data: { status: "PROCESSING", attempts: { increment: 1 } },
      });
      if (claimed.count !== 1) continue;
      const attempt = notification.attempts + 1;
      try {
        const adapter = this.registry.resolve(notification.channel);
        const result = await adapter.send({
          id: notification.id,
          channel: notification.channel,
          destination: notification.destination,
          subject: notification.subject,
          body: notification.body,
          payload: notification.payload,
        });
        await this.prisma.$transaction([
          this.prisma.notification.update({
            where: { id: notification.id },
            data: { status: "SENT", sentAt: new Date(), lastError: null },
          }),
          this.prisma.notificationDeliveryAttempt.create({
            data: {
              notificationId: notification.id,
              attempt,
              status: "SENT",
              provider: result.provider,
              externalMessageId: result.externalMessageId,
              requestPayload: {
                channel: notification.channel,
                destination: notification.destination,
              },
              responsePayload: result.response,
            },
          }),
        ]);
        sent += 1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Notification delivery failed";
        const final = attempt >= notification.maxAttempts;
        await this.prisma.$transaction([
          this.prisma.notification.update({
            where: { id: notification.id },
            data: {
              status: final ? "DEAD" : "FAILED",
              lastError: message.slice(0, 4_000),
              scheduledAt: new Date(
                Date.now() + Math.min(60 * 60_000, 5_000 * 2 ** attempt),
              ),
            },
          }),
          this.prisma.notificationDeliveryAttempt.create({
            data: {
              notificationId: notification.id,
              attempt,
              status: final ? "DEAD" : "FAILED",
              provider: notification.channel.toLowerCase(),
              requestPayload: {
                channel: notification.channel,
                destination: notification.destination,
              },
              error: message.slice(0, 4_000),
            },
          }),
        ]);
        failed += 1;
      }
    }
    return { processed: notifications.length, sent, failed };
  }

  private priorityFor(
    eventType: string,
  ): "LOW" | "NORMAL" | "HIGH" | "CRITICAL" {
    if (/Blocked|Recall|Expired|Failed|Dead/i.test(eventType))
      return /Recall|Blocked/i.test(eventType) ? "CRITICAL" : "HIGH";
    if (/Payment|Shipment|Document/i.test(eventType)) return "HIGH";
    return "NORMAL";
  }

  private subjectFor(eventType: string) {
    const subjects: Record<string, string> = {
      ConversationMessageSaved: "Новое сообщение",
      SupportTicketCreated: "Обращение принято",
      SupportTicketUpdated: "Обращение обновлено",
      OrderWorkflowChanged: "Заказ обновлён",
      OrderReceived: "Получение заказа подтверждено",
      ComplianceBlocked: "Продажа заблокирована compliance-проверкой",
      ComplianceReviewRequired: "Требуется ручная compliance-проверка",
      DocumentSigned: "Документ подписан",
      ShipmentStatusChanged: "Статус доставки изменён",
      OrganizationCredentialExpired: "Срок действия документа истёк",
      RefundCompleted: "Возврат выполнен",
    };
    return subjects[eventType] ?? `Событие Marketplace: ${eventType}`;
  }

  private bodyFor(eventType: string, payload: Record<string, unknown>) {
    if (eventType === "ConversationMessageSaved") return "В диалоге по предложению или заказу появилось новое сообщение.";
    if (eventType === "SupportTicketCreated") return "Обращение зарегистрировано. Его статус и ответы доступны в поддержке.";
    if (eventType === "SupportTicketUpdated") return payload.action === "MESSAGE" ? "В обращении появилось новое сообщение. Откройте переписку." : payload.action === "REOPEN" ? "Обращение снова открыто. Посмотрите уточнение в переписке." : "Оператор обновил обращение. Откройте его для просмотра решения.";
    if (eventType === "OrderWorkflowChanged") {
      const actions: Record<string, string> = { ACCEPT_COMPOSITION: "Клиника согласовала состав заказа.", ISSUE_INVOICE: "Поставщик выставил счёт.", REPORT_TRANSFER: "Клиника сообщила о переводе оплаты.", REQUEST_PAYMENT_DETAILS: "Поставщик запросил уточнение оплаты.", CONFIRM_TRANSFER: "Поставщик подтвердил поступление оплаты.", CANCEL: "Заказ отменён.", REQUEST_RETURN: "Клиника запросила возврат.", DECIDE_RETURN: "Поставщик рассмотрел возврат.", RECEIVE_MANUAL_REFUND: "Клиника подтвердила получение возврата денег.", REORDER: "Создана корзина для повторной закупки." };
      return actions[String(payload.action)] ?? "Условия или исполнение заказа обновлены. Проверьте состояние заказа.";
    }
    if (eventType === "ShipmentStatusChanged") {
      const shipment = typeof payload.shipmentNumber === "string" ? payload.shipmentNumber : "отгрузка";
      const order = typeof payload.orderNumber === "string" ? ` по заказу ${payload.orderNumber}` : "";
      const previous = typeof payload.previousStatus === "string" ? payload.previousStatus : null;
      const current = typeof payload.status === "string" ? payload.status : null;
      const transition = previous && current ? `${previous} → ${current}` : (current ?? "изменён");
      const tracking = typeof payload.trackingNumber === "string" && payload.trackingNumber ? ` Трек-номер: ${payload.trackingNumber}.` : "";
      return `Отгрузка ${shipment}${order}: ${transition}.${tracking}`.trim();
    }
    const status =
      typeof payload.status === "string" ? ` Статус: ${payload.status}.` : "";
    const reasons = Array.isArray(payload.reasons)
      ? ` Причины: ${payload.reasons.join("; ")}.`
      : "";
    return `${this.subjectFor(eventType)}.${status}${reasons}`.trim();
  }
}
