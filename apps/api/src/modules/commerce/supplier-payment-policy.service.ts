import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { supplierPaymentPolicyFieldsSchema, type SaveSupplierPaymentPolicy, type SupplierPaymentPolicyResponse } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";

export async function paymentPolicy(db: Prisma.TransactionClient, organizationId: string) {
  const profile = await db.supplierProfile.findUnique({ where: { organizationId } });
  const parsed = supplierPaymentPolicyFieldsSchema.safeParse(profile?.paymentReviewPolicy);
  return { version: profile?.paymentReviewVersion ?? 0, policy: parsed.success ? parsed.data : null };
}

@Injectable()
export class SupplierPaymentPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  private async authorize(db: Prisma.TransactionClient, context: SupplierActorContext) {
    const member = await db.organizationMembership.findFirst({ where: {
      organizationId: context.organizationId, userId: context.actorId, status: "ACTIVE", user: { status: "ACTIVE" },
      organization: { status: "ACTIVE", capabilities: { some: { capability: "SUPPLIER" } } },
      roles: { some: { role: { organizationId: context.organizationId, permissions: { some: { permission: { code: "supplier.profile.manage" } } } } } },
    } });
    if (!member) throw new ForbiddenException("Настроить проверку оплаты может сотрудник с правом управления профилем поставщика");
  }

  private members(db: Prisma.TransactionClient, organizationId: string) {
    return db.organizationMembership.findMany({ where: { organizationId, status: "ACTIVE", user: { status: "ACTIVE" },
      roles: { some: { role: { organizationId, permissions: { some: { permission: { code: "payment.transfer.confirm" } } } } } },
    }, select: { userId: true, user: { select: { displayName: true } } }, orderBy: { userId: "asc" }, take: 500 });
  }

  async get(context: SupplierActorContext): Promise<SupplierPaymentPolicyResponse> {
    await this.authorize(this.prisma, context);
    const [state, members] = await Promise.all([paymentPolicy(this.prisma, context.organizationId), this.members(this.prisma, context.organizationId)]);
    return { organizationId: context.organizationId, ...state,
      eligibleMembers: members.map(member => ({ userId: member.userId, displayName: member.user.displayName })) };
  }

  async save(input: SaveSupplierPaymentPolicy, context: SupplierActorContext) {
    await this.authorize(this.prisma, context);
    const { expectedVersion, idempotencyKey, ...fields } = input;
    const policy = supplierPaymentPolicyFieldsSchema.parse(fields);
    const scope = `supplier-payment-policy:${context.organizationId}`;
    const requestHash = createHash("sha256").update(JSON.stringify({ policy, expectedVersion, actorId: context.actorId })).digest("hex");
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "organizationId" FROM "SupplierProfile" WHERE "organizationId" = ${context.organizationId}::uuid FOR UPDATE`;
      await this.authorize(tx, context);
      const replay = await tx.idempotencyRecord.findUnique({ where: { scope_key: { scope, key: idempotencyKey } } });
      if (replay) {
        if (replay.requestHash !== requestHash) throw new ConflictException("Ключ повтора относится к другим настройкам");
        return;
      }
      const members = await this.members(tx, context.organizationId);
      if (![policy.primaryUserId, policy.backupUserId].every(id => members.some(member => member.userId === id)))
        throw new ConflictException("Ответственные должны быть активными сотрудниками с правом подтверждения перевода");
      const changed = await tx.supplierProfile.updateMany({ where: { organizationId: context.organizationId, paymentReviewVersion: expectedVersion },
        data: { paymentReviewPolicy: policy as Prisma.InputJsonValue, paymentReviewVersion: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException("Настройки изменились. Обновите страницу");
      await tx.auditLog.create({ data: { ...context, action: "supplier.payment_review.configured", entityType: "SupplierProfile", entityId: context.organizationId,
        after: { ...policy, version: expectedVersion + 1 } } });
      await tx.outboxEvent.create({ data: { aggregateType: "SupplierProfile", aggregateId: context.organizationId,
        eventType: "SupplierPaymentReviewConfigured", payload: { supplierOrganizationId: context.organizationId, version: expectedVersion + 1 } } });
      await tx.idempotencyRecord.create({ data: { scope, key: idempotencyKey, requestHash, responseCode: 200,
        responseBody: { version: expectedVersion + 1 }, expiresAt: new Date(Date.now() + 86400_000) } });
    });
    return this.get(context);
  }
}
