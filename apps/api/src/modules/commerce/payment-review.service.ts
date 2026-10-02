import { membershipPermission } from "../access-control/access-mode";
import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma, type OrderTransferClaim } from "@prisma/client";
import { supplierPaymentPolicyFieldsSchema, type SupplierPaymentPolicyFields } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { workingMinutesElapsed } from "./manual-payment-rules";

type ReviewOrder = { id: string; orderNumber: string; buyerOrganizationId: string; supplierOrganizationId: string };

export async function notifyPaymentReview(tx: Prisma.TransactionClient, order: ReviewOrder, claim: Pick<OrderTransferClaim, "id" | "reviewStartedAt">,
  recipient: string | null, stage: string, now = new Date()) {
  // A revoked employee must not remain the sole recipient of a pending case.
  const active = recipient ? await tx.organizationMembership.findFirst({ where: {
    organizationId: order.supplierOrganizationId, userId: recipient, status: "ACTIVE", user: { status: "ACTIVE" },
    ...membershipPermission(order.supplierOrganizationId, "payment.transfer.confirm"),
  }, select: { id: true } }) : null;
  const labels: Record<string, string> = { REPORTED: "Клиника заявила перевод", REMINDER: "Перевод ожидает проверки15 рабочих минут",
    BACKUP: "Перевод ожидает проверки30 рабочих минут", CHECK_DUE: "Наступило назначенное время проверки перевода" };
  const idempotencyKey = `manual-payment:${claim.id}:${claim.reviewStartedAt.toISOString()}:${stage}`;
  await tx.notification.upsert({ where: { idempotencyKey }, update: {}, create: {
    recipientOrganizationId: order.supplierOrganizationId, recipientUserId: active ? recipient : null,
    eventType: "ManualPaymentReviewRequired", channel: "IN_APP", priority: "HIGH",
    subject: `${labels[stage] ?? "Требуется проверка перевода"} · ${order.orderNumber}`,
    body: "Проверьте поступление на счёт поставщика. Квитанция не подтверждает оплату; резерв удерживается.",
    aggregateType: "SupplierOrder", aggregateId: order.id, idempotencyKey, scheduledAt: now,
    payload: { orderId: order.id, claimId: claim.id, stage, recipientUnavailable: Boolean(recipient && !active) },
  } });
}

export async function createPaymentDispute(tx: Prisma.TransactionClient, order: ReviewOrder, claim: OrderTransferClaim,
  actorId: string, reason: string, now = new Date()) {
  if (claim.supportTicketId) return claim.supportTicketId;
  const ticket = await tx.supportTicket.create({ data: {
    number: `PAY-${claim.id}`, organizationId: order.buyerOrganizationId, requesterId: actorId,
    subject: `Проверка перевода по заказу ${order.orderNumber}`, description: reason,
    category: "PAYMENT_REVIEW", priority: "HIGH",
  } });
  await tx.supportLink.create({ data: { ticketId: ticket.id, entityType: "SupplierOrder", entityId: order.id, label: order.orderNumber } });
  await tx.supportMessage.create({ data: { ticketId: ticket.id, authorId: actorId, body: reason } });
  await tx.orderTransferClaim.update({ where: { id: claim.id }, data: { supportTicketId: ticket.id } });
  await tx.auditLog.create({ data: { actorId, organizationId: order.buyerOrganizationId, action: "payment.review.escalated",
    entityType: "SupportTicket", entityId: ticket.id, after: { orderId: order.id, claimId: claim.id, reason, createdAt: now.toISOString() } } });
  await tx.outboxEvent.create({ data: { aggregateType: "SupportTicket", aggregateId: ticket.id, eventType: "SupportTicketCreated",
    payload: { ticketId: ticket.id, orderId: order.id, buyerOrganizationId: order.buyerOrganizationId, supplierOrganizationId: order.supplierOrganizationId, priority: "HIGH" } } });
  return ticket.id;
}

@Injectable()
export class PaymentReviewService {
  private running = false;
  private afterId: string | null = null;
  constructor(private readonly prisma: PrismaService) {}

  @Cron("0 * * * * *")
  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const eligible = {
        status: { in: ["PENDING", "NOT_RECEIVED"] }, reviewPolicySnapshot: { not: Prisma.DbNull },
        reviewStartedAt: { lte: now }, supportTicketId: null,
      };
      // Keyset rotation lets off-hours claims coexist without starving later cases.
      let claims = await this.prisma.orderTransferClaim.findMany({ where: { ...eligible, ...(this.afterId ? { id: { gt: this.afterId } } : {}) },
        select: { id: true, supplierOrderId: true }, orderBy: { id: "asc" }, take: 100 });
      if (!claims.length && this.afterId) {
        this.afterId = null;
        claims = await this.prisma.orderTransferClaim.findMany({ where: eligible,
          select: { id: true, supplierOrderId: true }, orderBy: { id: "asc" }, take: 100 });
      }
      for (const candidate of claims) {
        await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "SupplierOrder" WHERE id = ${candidate.supplierOrderId}::uuid FOR UPDATE`;
        const claim = await tx.orderTransferClaim.findUnique({ where: { id: candidate.id }, include: { supplierOrder: true } });
        if (!claim || !["PENDING", "NOT_RECEIVED"].includes(claim.status) || claim.supportTicketId || claim.reviewStartedAt > now) return;
        const parsed = supplierPaymentPolicyFieldsSchema.safeParse(claim.reviewPolicySnapshot);
        if (!parsed.success) return;
        const policy: SupplierPaymentPolicyFields = parsed.data;
        const minutes = workingMinutesElapsed(claim.reviewStartedAt, now, policy);
        if (claim.status === "NOT_RECEIVED" && claim.nextCheckAt && now >= claim.nextCheckAt)
          await notifyPaymentReview(tx, claim.supplierOrder, claim, policy.primaryUserId, "CHECK_DUE", now);
        if (minutes >= 15 && !claim.remindedAt) {
          await notifyPaymentReview(tx, claim.supplierOrder, claim, policy.primaryUserId, "REMINDER", now);
          await tx.orderTransferClaim.update({ where: { id: claim.id }, data: { remindedAt: now } });
        }
        if (minutes >= 30 && !claim.backupNotifiedAt) {
          await notifyPaymentReview(tx, claim.supplierOrder, claim, policy.backupUserId, "BACKUP", now);
          await tx.orderTransferClaim.update({ where: { id: claim.id }, data: { backupNotifiedAt: now } });
        }
        if (minutes >= 60 && claim.reportedById)
          await createPaymentDispute(tx, claim.supplierOrder, claim, claim.reportedById,
            "Нет реакции на заявленный перевод в течение60 рабочих минут. Поддержка координирует проверку; деньги не подтверждены.", now);
        }, { timeout: 15000 });
        this.afterId = candidate.id;
      }
    } finally { this.running = false; }
  }
}
