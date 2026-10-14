import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { applyOfferVatSchema, previewOfferVatSchema, saveSupplierVatSettingsSchema, vatCalendarDate, vatLegacyFields,
  type ApplyOfferVatInput, type OfferVatApplyResult, type OfferVatPreview, type PreviewOfferVatInput, type SaveSupplierVatSettingsInput,
  type SupplierVatSettings, type VatPriceSnapshot } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { assertVatCurrent, currentVatProfile, declareVat, storedVat, vatConflict } from "./vat-rules";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
@Injectable()
export class SupplierVatService {
  constructor(private readonly prisma: PrismaService, private readonly permissions: AccessControlService) {}
  private async authorize(supplierId: string, context: SupplierActorContext, write: boolean) {
    if (supplierId !== context.organizationId) throw new ForbiddenException("Налоговые условия подтверждает представитель поставщика");
    if (!await this.permissions.hasAll(context.actorId, supplierId, [write ? "pricing.manage" : "catalog.product.view"]))
      throw new ForbiddenException(write ? "Нет права изменять цены и НДС" : "Нет права просмотра предложений");
    if (!await this.prisma.supplierProfile.findFirst({ where: { organizationId: supplierId, status: "ACTIVE", organization: { status: "ACTIVE" } }, select: { organizationId: true } }))
      throw new ForbiddenException("Нет доступа к действующему кабинету поставщика");
  }
  private async state(db: Prisma.TransactionClient, supplierId: string, canEdit: boolean): Promise<SupplierVatSettings> {
    const settings = await db.supplierVatSettings.findUnique({ where: { supplierOrganizationId: supplierId } });
    let profile: SupplierVatSettings["profile"] = null, profileIssue: string | null = null;
    try { profile = await currentVatProfile(db, supplierId); } catch (error) { if (!(error instanceof ConflictException)) throw error; profileIssue = error.message; }
    const defaultTax = storedVat(settings?.defaultTax);
    let defaultIssue: string | null = null;
    if (defaultTax && !profileIssue) {
      try { await assertVatCurrent(db, supplierId, defaultTax); } catch (error) {
        if (!(error instanceof ConflictException) && !(error instanceof BadRequestException)) throw error;
        defaultIssue = error.message;
      }
    }
    return { supplierOrganizationId: supplierId, version: settings?.version ?? 0, defaultTax, profile, profileIssue, defaultIssue, canEdit, date: vatCalendarDate() };
  }
  async current(supplierId: string, context: SupplierActorContext): Promise<SupplierVatSettings> {
    await this.authorize(supplierId, context, false);
    const canEdit = await this.permissions.hasAll(context.actorId, supplierId, ["pricing.manage"]);
    return this.prisma.$transaction(tx => this.state(tx, supplierId, canEdit), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  private async transaction<T>(run: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try { return await this.prisma.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (["P2034", "P2002"].includes(error.code) ||
        (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))))) throw vatConflict("Налоговые условия изменились параллельно. Обновите данные и повторите действие");
      throw error;
    }
  }
  private async replay<T>(db: Prisma.TransactionClient, scope: string, key: string, requestHash: string): Promise<T | null> {
    const previous = await db.idempotencyRecord.findUnique({ where: { scope_key: { scope, key } } });
    if (!previous) return null;
    if (previous.requestHash !== requestHash) throw vatConflict("Ключ повтора уже использован для другого изменения НДС");
    return previous.responseBody as T;
  }
  private async remember(db: Prisma.TransactionClient, scope: string, key: string, requestHash: string, response: object) {
    await db.idempotencyRecord.create({ data: { scope, key, requestHash, responseBody: response as Prisma.InputJsonValue,
      responseCode: 201, expiresAt: new Date(Date.now() + 86400_000) } });
  }
  async save(supplierId: string, input: SaveSupplierVatSettingsInput, context: SupplierActorContext): Promise<SupplierVatSettings> {
    await this.authorize(supplierId, context, true);
    const parsed = saveSupplierVatSettingsSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Проверьте настройки НДС и подтверждение");
    const command = parsed.data, scope = `supplier-vat:${supplierId}:${context.actorId}`, requestHash = hash(command);
    return this.transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${supplierId}::uuid FOR UPDATE`;
      const replay = await this.replay<SupplierVatSettings>(tx, scope, command.idempotencyKey, requestHash); if (replay) return replay;
      const existing = await tx.supplierVatSettings.findUnique({ where: { supplierOrganizationId: supplierId } });
      if ((existing?.version ?? 0) !== command.expectedVersion) throw vatConflict("Общая настройка НДС изменилась. Обновите форму");
      let declaration: VatPriceSnapshot | null = null;
      if (command.selection) {
        const profile = await currentVatProfile(tx, supplierId);
        if (profile.version !== command.expectedRequisitesVersion) throw vatConflict("Реквизиты изменились. Обновите форму");
        declaration = declareVat(command.selection, profile, context.actorId, "SUPPLIER_DEFAULT", command.expectedVersion + 1);
      }
      await tx.supplierVatSettings.upsert({ where: { supplierOrganizationId: supplierId },
        create: { supplierOrganizationId: supplierId, version: 1, defaultTax: declaration ?? Prisma.DbNull, updatedById: context.actorId },
        update: { version: { increment: 1 }, defaultTax: declaration ?? Prisma.DbNull, updatedById: context.actorId } });
      await tx.auditLog.create({ data: { ...context, action: "supplier.vat.default.changed", entityType: "SupplierVatSettings", entityId: supplierId,
        after: { version: command.expectedVersion + 1, selection: command.selection } } });
      await tx.outboxEvent.create({ data: { aggregateType: "SupplierProfile", aggregateId: supplierId, eventType: "SupplierVatDefaultChanged",
        payload: { supplierOrganizationId: supplierId, version: command.expectedVersion + 1 } } });
      const result = await this.state(tx, supplierId, true); await this.remember(tx, scope, command.idempotencyKey, requestHash, result); return result;
    });
  }
  private async prepare(db: Prisma.TransactionClient, supplierId: string, input: PreviewOfferVatInput, context: SupplierActorContext) {
    const profile = await currentVatProfile(db, supplierId);
    if (profile.version !== input.tax.expectedRequisitesVersion) throw vatConflict("Реквизиты изменились. Обновите предпросмотр");
    const declaration = declareVat(input.tax.selection, profile, context.actorId);
    const ids = [...input.offerIds].sort();
    const offers = await db.supplierOffer.findMany({ where: { id: { in: ids }, supplierOrganizationId: supplierId },
      include: { prices: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1 }, productVariant: { include: { product: { select: { canonicalName: true } } } } }, orderBy: { id: "asc" } });
    if (offers.length !== ids.length) throw new NotFoundException("Одно из выбранных предложений не найдено в вашей организации");
    const rows = offers.map(offer => {
      const price = offer.prices[0];
      if (["BLOCKED", "ARCHIVED"].includes(offer.status) || !["MANUAL", "IMPORT"].includes(offer.sourceType) || !price || price.currency !== "KZT")
        throw new ConflictException("Выберите доступные ручные или импортированные предложения с ценой в тенге. Для ERP измените настройки источника");
      const previous = storedVat(price.taxSnapshot);
      const changed = !previous || JSON.stringify(previous.selection) !== JSON.stringify(declaration.selection) ||
        JSON.stringify(previous.profile) !== JSON.stringify(declaration.profile) || previous.ruleId !== declaration.ruleId;
      return { offer, price, previous, changed };
    });
    const previewHash = hash({ supplierId, actorId: context.actorId, selection: declaration.selection, profile, rule: declaration.ruleId, date: vatCalendarDate(),
      rows: rows.map(({ offer, price }) => ({ id: offer.id, version: offer.version, priceId: price.id, amount: price.amountMinor.toString(), currency: price.currency, tax: price.taxSnapshot })) });
    const result: OfferVatPreview = { previewHash, selection: declaration.selection,
      items: rows.map(({ offer, price, previous, changed }) => ({ offerId: offer.id, name: offer.productVariant.product.canonicalName, offerVersion: offer.version,
        amountMinor: price.amountMinor.toString(), previous: previous?.selection ?? null, changed })),
      changedCount: rows.filter(row => row.changed).length, unchangedCount: rows.filter(row => !row.changed).length };
    return { result, rows, declaration };
  }
  async preview(supplierId: string, input: PreviewOfferVatInput, context: SupplierActorContext): Promise<OfferVatPreview> {
    await this.authorize(supplierId, context, true);
    const parsed = previewOfferVatSchema.safeParse(input); if (!parsed.success) throw new BadRequestException("Проверьте выбранные предложения и НДС");
    return this.prisma.$transaction(async tx => (await this.prepare(tx, supplierId, parsed.data, context)).result, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async apply(supplierId: string, input: ApplyOfferVatInput, context: SupplierActorContext): Promise<OfferVatApplyResult> {
    await this.authorize(supplierId, context, true);
    const parsed = applyOfferVatSchema.safeParse(input); if (!parsed.success) throw new BadRequestException("Сначала проверьте предпросмотр изменения НДС");
    const command = parsed.data, scope = `offer-vat-bulk:${supplierId}:${context.actorId}`, requestHash = hash({ ...command, offerIds: [...command.offerIds].sort() });
    return this.transaction(async tx => {
      const replay = await this.replay<OfferVatApplyResult>(tx, scope, command.idempotencyKey, requestHash); if (replay) return replay;
      const ids = [...command.offerIds].sort();
      await tx.$queryRaw`SELECT id FROM "SupplierOffer" WHERE "supplierOrganizationId" = ${supplierId}::uuid AND id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`;
      const prepared = await this.prepare(tx, supplierId, command, context);
      if (prepared.result.previewHash !== command.previewHash) throw vatConflict("Предложения изменились после предпросмотра. Проверьте новый результат");
      const result: OfferVatApplyResult = { updatedOfferIds: [], unchangedCount: prepared.result.unchangedCount }, now = new Date();
      for (const { offer, price, changed } of prepared.rows) {
        if (!changed) continue;
        await tx.offerPrice.update({ where: { id: price.id }, data: { status: "INACTIVE", validTo: now } });
        const fields = vatLegacyFields(prepared.declaration.selection);
        await tx.offerPrice.create({ data: { offerId: offer.id, amountMinor: price.amountMinor, currency: price.currency, ...fields,
          taxSnapshot: prepared.declaration, source: price.source, validFrom: now, validTo: price.validTo,
          lastConfirmedAt: price.lastConfirmedAt, freshnessExpiresAt: price.freshnessExpiresAt } });
        await tx.offerPriceHistory.create({ data: { offerId: offer.id, amountMinor: price.amountMinor, currency: price.currency, ...fields,
          taxSnapshot: prepared.declaration, source: price.source, changedById: context.actorId, reason: "Подтверждённое массовое изменение НДС" } });
        await tx.supplierOffer.update({ where: { id: offer.id }, data: { version: { increment: 1 } } });
        await tx.outboxEvent.create({ data: { aggregateType: "SupplierOffer", aggregateId: offer.id, eventType: "OfferTaxChanged", payload: { supplierOrganizationId: supplierId, offerId: offer.id } } });
        result.updatedOfferIds.push(offer.id);
      }
      await tx.auditLog.create({ data: { ...context, action: "offer.vat.bulk.changed", entityType: "SupplierProfile", entityId: supplierId,
        after: { offerIds: result.updatedOfferIds, selection: prepared.declaration.selection, profileVersion: prepared.declaration.profile.version } } });
      await this.remember(tx, scope, command.idempotencyKey, requestHash, result); return result;
    });
  }
}
