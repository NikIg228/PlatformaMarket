import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateDataOverrideInput, UpsertFreshnessPolicyInput } from "@marketplace/schemas";
import { vatLegacyFields } from "@marketplace/schemas";
import { resolvePriceVat } from "../vat/vat-rules";
import { Prisma, type FreshnessDataType, type OfferSourceType } from "@prisma/client";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { SupplierAccessService, type SupplierActorContext } from "../suppliers/supplier-access.service";
import { AccessControlService } from "../access-control/access-control.service";

@Injectable()
export class DataFreshnessService {
  constructor(private readonly prisma: PrismaService, private readonly access: SupplierAccessService, private readonly permissions: AccessControlService) {}

  private async assertCanOverride(target: "PRICE" | "INVENTORY", context: SupplierActorContext) {
    const required = target === "PRICE" ? ["inventory.adjust", "pricing.manage"] : ["inventory.adjust"];
    if (!await this.permissions.hasAll(context.actorId, context.organizationId, required))
      throw new ForbiddenException("Недостаточно прав для изменения выбранных данных");
  }

  async policies(supplierOrganizationId: string, context: SupplierActorContext) {
    await this.access.assertCanManage(supplierOrganizationId, context);
    return this.prisma.freshnessPolicy.findMany({ where: { scopeKey: { in: ["global", supplierOrganizationId] }, status: "ACTIVE" }, orderBy: [{ dataType: "asc" }, { source: "asc" }, { priority: "asc" }] });
  }

  async upsertPolicy(supplierOrganizationId: string, input: UpsertFreshnessPolicyInput, context: SupplierActorContext) {
    await this.access.assertCanManage(supplierOrganizationId, context);
    await this.access.requireProfile(supplierOrganizationId);
    const policy = await this.prisma.freshnessPolicy.upsert({
      where: { scopeKey_source_dataType: { scopeKey: supplierOrganizationId, source: input.source, dataType: input.dataType } },
      update: input,
      create: { supplierOrganizationId, scopeKey: supplierOrganizationId, ...input },
    });
    await this.prisma.auditLog.create({ data: { ...context, action: "freshness.policy.upserted", entityType: "FreshnessPolicy", entityId: policy.id, after: policy } });
    return policy;
  }

  async resolvePolicy(supplierOrganizationId: string, source: OfferSourceType, dataType: FreshnessDataType) {
    const policy = await this.prisma.freshnessPolicy.findFirst({ where: { scopeKey: { in: [supplierOrganizationId, "global"] }, source, dataType, status: "ACTIVE" }, orderBy: [{ priority: "asc" }, { supplierOrganizationId: { sort: "desc", nulls: "last" } }] });
    if (policy) return policy;
    const staleAfterMinutes = source === "API" || source === "ERP" ? 15 : source === "IMPORT" ? 24 * 60 : 48 * 60;
    return { staleAfterMinutes, expirationBehavior: source === "API" || source === "ERP" ? "PAUSE" as const : "REQUIRE_CONFIRMATION" as const, confirmationRequired: !(source === "API" || source === "ERP") };
  }

  async overrides(supplierOrganizationId: string, context: SupplierActorContext) {
    await this.access.assertCanManage(supplierOrganizationId, context);
    return this.prisma.dataOverride.findMany({ where: { supplierOrganizationId }, include: { offer: true, inventoryBalance: { include: { warehouse: true } }, previousOverride: true }, orderBy: { createdAt: "desc" }, take: 200 });
  }

  async createOverride(supplierOrganizationId: string, input: CreateDataOverrideInput, context: SupplierActorContext) {
    if (input.tax && supplierOrganizationId !== context.organizationId) throw new ForbiddenException("Налоговые условия подтверждает представитель поставщика");
    await this.access.assertCanManage(supplierOrganizationId, context);
    await this.assertCanOverride(input.target, context);
    const now = new Date();
    const validUntil = input.validUntil ? new Date(input.validUntil) : null;
    if (validUntil && validUntil <= now) throw new BadRequestException("Override validUntil must be in the future");
    const offer = input.offerId ? await this.prisma.supplierOffer.findFirst({ where: { id: input.offerId, supplierOrganizationId } }) : null;
    const balance = input.inventoryBalanceId ? await this.prisma.inventoryBalance.findFirst({ where: { id: input.inventoryBalanceId, supplierOrganizationId } }) : null;
    if (input.target === "PRICE" && !offer) throw new NotFoundException("Supplier offer not found");
    if (input.target === "INVENTORY" && !balance) throw new NotFoundException("Supplier inventory balance not found");
    const current = await this.prisma.dataOverride.findFirst({ where: { status: "ACTIVE", target: input.target, ...(input.target === "PRICE" ? { offerId: input.offerId } : { inventoryBalanceId: input.inventoryBalanceId }) }, orderBy: { createdAt: "desc" } });
    const value = input.value;
    if (input.target === "INVENTORY") {
      const quantityOnHand = Number(value.quantityOnHand);
      const quantityReserved = balance ? Number(value.quantityReserved ?? balance.quantityReserved) : 0;
      const safetyStock = balance ? Number(value.safetyStock ?? balance.safetyStock) : 0;
      if (![quantityOnHand, quantityReserved, safetyStock].every((number) => Number.isFinite(number) && number >= 0) || quantityReserved + safetyStock > quantityOnHand) throw new BadRequestException("Inventory override violates on-hand/reserved/safety-stock invariant");
    }
    return this.prisma.$transaction(async (tx) => {
      if (current) await tx.dataOverride.update({ where: { id: current.id }, data: { status: "CANCELLED", cancelledAt: now } });
      const override = await tx.dataOverride.create({ data: { supplierOrganizationId, offerId: input.offerId, inventoryBalanceId: input.inventoryBalanceId, previousOverrideId: current?.id, target: input.target, mode: input.mode, value: value as Prisma.InputJsonValue, reason: input.reason, validFrom: now, validUntil, createdById: context.actorId } });
      if (input.target === "PRICE" && offer) {
        await tx.$queryRaw`SELECT "id" FROM "SupplierOffer" WHERE "id" = ${offer.id}::uuid FOR UPDATE`;
        const previous = await tx.offerPrice.findFirst({ where: { offerId: offer.id, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
        const tax = await resolvePriceVat(tx, supplierOrganizationId, context.actorId, previous, input.tax);
        const taxFields = tax ? { ...vatLegacyFields(tax.selection), taxSnapshot: tax as unknown as Prisma.InputJsonValue }
          : { includesVat: typeof value.includesVat === "boolean" ? value.includesVat : previous?.includesVat ?? true, vatRate: typeof value.vatRate === "number" ? value.vatRate : previous?.vatRate ?? null };
        if (tax && !input.tax && ((typeof value.includesVat === "boolean" && value.includesVat !== taxFields.includesVat) ||
          (value.vatRate !== undefined && String(value.vatRate) !== String(taxFields.vatRate))))
          throw new ConflictException("Подтвердите новые налоговые условия предложения перед изменением режима НДС");
        if (typeof value.amountMinor !== "string") throw new BadRequestException("Price override amountMinor must be an exact integer string");
        const amountMinor = new Prisma.Decimal(value.amountMinor);
        const currency = typeof value.currency === "string" && /^[A-Z]{3}$/.test(value.currency) ? value.currency : "KZT";
        await tx.offerPrice.updateMany({ where: { offerId: offer.id, status: "ACTIVE" }, data: { status: "INACTIVE", validTo: now } });
        await tx.offerPrice.create({ data: { offerId: offer.id, amountMinor, currency, ...taxFields, source: "MANUAL", lastConfirmedAt: now, freshnessExpiresAt: validUntil } });
        await tx.offerPriceHistory.create({ data: { offerId: offer.id, amountMinor, currency, ...taxFields, source: "MANUAL", changedById: context.actorId, reason: `Override ${override.id}: ${input.reason}` } });
        await tx.supplierOffer.update({ where: { id: offer.id }, data: { version: { increment: 1 } } });
      }
      if (input.target === "INVENTORY" && balance) {
        const quantityOnHand = Number(value.quantityOnHand);
        const quantityReserved = Number(value.quantityReserved ?? balance.quantityReserved);
        const safetyStock = Number(value.safetyStock ?? balance.safetyStock);
        const quantityAvailable = quantityOnHand - quantityReserved - safetyStock;
        await tx.inventoryBalance.update({ where: { id: balance.id }, data: { quantityOnHand, quantityReserved, safetyStock, quantityAvailable, availabilityStatus: quantityAvailable <= 0 ? "OUT_OF_STOCK" : quantityAvailable <= Math.max(1, safetyStock) ? "LOW_STOCK" : "IN_STOCK", freshnessStatus: "FRESH", freshnessExpiresAt: validUntil, source: "MANUAL", externalUpdatedAt: now, lastSuccessfulSyncAt: now, version: { increment: 1 } } });
      }
      await tx.auditLog.create({ data: { ...context, action: "data.override.created", entityType: "DataOverride", entityId: override.id, before: current ?? Prisma.JsonNull, after: override } });
      await tx.outboxEvent.create({ data: { aggregateType: "DataOverride", aggregateId: override.id, eventType: "DataOverrideCreated", payload: { supplierOrganizationId, overrideId: override.id, target: override.target, mode: override.mode, offerId: override.offerId, inventoryBalanceId: override.inventoryBalanceId } } });
      return override;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async cancelOverride(supplierOrganizationId: string, overrideId: string, context: SupplierActorContext) {
    await this.access.assertCanManage(supplierOrganizationId, context);
    const current = await this.prisma.dataOverride.findFirst({ where: { id: overrideId, supplierOrganizationId } });
    if (!current) throw new NotFoundException("Data override not found");
    await this.assertCanOverride(current.target, context);
    if (current.status !== "ACTIVE") throw new ConflictException("Only an active override can be cancelled");
    const cancelled = await this.prisma.dataOverride.update({ where: { id: overrideId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    await this.prisma.auditLog.create({ data: { ...context, action: "data.override.cancelled", entityType: "DataOverride", entityId: overrideId, before: current, after: cancelled } });
    return cancelled;
  }

  async resolveSyncOverride(target: "PRICE" | "INVENTORY", entityId: string) {
    const override = await this.prisma.dataOverride.findFirst({ where: { status: "ACTIVE", target, ...(target === "PRICE" ? { offerId: entityId } : { inventoryBalanceId: entityId }) }, orderBy: { createdAt: "desc" } });
    if (!override) return { protected: false, override: null };
    const now = new Date();
    if (override.validUntil && override.validUntil <= now) {
      await this.prisma.dataOverride.updateMany({ where: { id: override.id, status: "ACTIVE" }, data: { status: "EXPIRED", consumedAt: now } });
      return { protected: false, override };
    }
    if (override.mode === "UNTIL_NEXT_SYNC") {
      await this.prisma.dataOverride.updateMany({ where: { id: override.id, status: "ACTIVE" }, data: { status: "CONSUMED", consumedAt: now } });
      return { protected: false, override };
    }
    if (override.mode === "ONE_TIME") {
      await this.prisma.dataOverride.updateMany({ where: { id: override.id, status: "ACTIVE" }, data: { status: "CONSUMED", consumedAt: now } });
      return { protected: true, override };
    }
    return { protected: true, override };
  }
}
