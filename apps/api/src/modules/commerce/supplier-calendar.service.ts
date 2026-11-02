import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { defaultSupplierCalendar, supplierCalendarFieldsSchema, supplierCalendarResponseSchema,
  type OrderResponseCalendar, type SaveSupplierCalendar, type SupplierCalendarResponse } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { membershipPermission } from "../access-control/access-mode";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";

export async function supplierCalendarSnapshot(db: Prisma.TransactionClient, organizationId: string): Promise<OrderResponseCalendar> {
  const profile = await db.supplierProfile.findUnique({ where: { organizationId },
    select: { status: true, workingCalendar: true, workingCalendarVersion: true } });
  if (!profile || profile.status !== "ACTIVE") throw new NotFoundException("Рабочий календарь поставщика недоступен");
  if (profile.workingCalendar === null) return { version: profile.workingCalendarVersion, source: "DEFAULT", calendar: defaultSupplierCalendar() };
  const parsed = supplierCalendarFieldsSchema.safeParse(profile.workingCalendar);
  if (!parsed.success) throw new ConflictException("Рабочий календарь поставщика требует исправления");
  return { version: profile.workingCalendarVersion, source: "SUPPLIER", calendar: parsed.data };
}

@Injectable()
export class SupplierCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private async permitted(db: Prisma.TransactionClient, context: SupplierActorContext, write: boolean) {
    if (!context.actorId || !context.organizationId) return false;
    return Boolean(await db.organizationMembership.findFirst({ where: {
      organizationId: context.organizationId, userId: context.actorId, status: "ACTIVE", user: { status: "ACTIVE" },
      organization: { status: "ACTIVE", capabilities: { some: { capability: "SUPPLIER" } } },
      ...membershipPermission(context.organizationId, write ? "supplier.profile.manage" : "organization.view"),
    }, select: { id: true } }));
  }

  private async authorize(db: Prisma.TransactionClient, context: SupplierActorContext, write: boolean) {
    if (!context.actorId || !context.organizationId) throw new UnauthorizedException("Войдите в кабинет поставщика");
    if (!await this.permitted(db, context, write)) throw new ForbiddenException("Нет права на просмотр или изменение рабочего календаря");
  }

  async get(context: SupplierActorContext): Promise<SupplierCalendarResponse> {
    await this.authorize(this.prisma, context, false);
    const snapshot = await supplierCalendarSnapshot(this.prisma, context.organizationId);
    return { organizationId: context.organizationId, ...snapshot, canEdit: await this.permitted(this.prisma, context, true) };
  }

  async save(input: SaveSupplierCalendar, context: SupplierActorContext): Promise<SupplierCalendarResponse> {
    await this.authorize(this.prisma, context, true);
    const { expectedVersion, idempotencyKey, ...fields } = input;
    const calendar = supplierCalendarFieldsSchema.parse(fields);
    const scope = `supplier-calendar:${context.organizationId}`;
    const requestHash = createHash("sha256").update(JSON.stringify({ calendar, expectedVersion, actorId: context.actorId })).digest("hex");
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "organizationId" FROM "SupplierProfile" WHERE "organizationId" = ${context.organizationId}::uuid FOR UPDATE`;
      await this.authorize(tx, context, true);
      const replay = await tx.idempotencyRecord.findUnique({ where: { scope_key: { scope, key: idempotencyKey } } });
      if (replay) {
        if (replay.requestHash !== requestHash) throw new ConflictException("Ключ повтора относится к другому календарю");
        return supplierCalendarResponseSchema.parse(replay.responseBody);
      }
      const changed = await tx.supplierProfile.updateMany({ where: { organizationId: context.organizationId, status: "ACTIVE", workingCalendarVersion: expectedVersion },
        data: { workingCalendar: calendar as Prisma.InputJsonValue, workingCalendarVersion: { increment: 1 } } });
      if (changed.count !== 1) throw new ConflictException("Календарь изменился. Загрузите сохранённую версию перед повторной записью");
      const result: SupplierCalendarResponse = { organizationId: context.organizationId, version: expectedVersion + 1, source: "SUPPLIER", canEdit: true, calendar };
      await tx.auditLog.create({ data: { ...context, action: "supplier.calendar.updated", entityType: "SupplierProfile", entityId: context.organizationId,
        after: { calendar, version: result.version } } });
      await tx.outboxEvent.create({ data: { aggregateType: "SupplierProfile", aggregateId: context.organizationId, eventType: "SupplierCalendarUpdated",
        payload: { supplierOrganizationId: context.organizationId, version: result.version } } });
      await tx.idempotencyRecord.create({ data: { scope, key: idempotencyKey, requestHash, responseCode: 201,
        responseBody: result as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 86400_000) } });
      return result;
    });
  }
}
