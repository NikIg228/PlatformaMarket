import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type Promotion } from "@prisma/client";
import { createHash } from "node:crypto";
import { publicPromotionSchema, type CreateOfferPromotion, type ReviseOfferPromotion, type OfferPromotionCommand, type PromotionListQuery, type PromotionTerms, type OfferPromotion } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { SupplierTermsService } from "../agreements/supplier-terms.service";
import { AccessControlService } from "../access-control/access-control.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { capturePromotionPrice, promotionResponses, promotionTerms, promotionUnitPrice } from "./offer-promotion-rules";

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService, private readonly terms: SupplierTermsService, private readonly access: AccessControlService) {}

  private async operator(context: SupplierActorContext) {
    return Boolean(await this.prisma.organizationCapability.findUnique({ where: { organizationId_capability: { organizationId: context.organizationId, capability: "MARKETPLACE_OPERATOR" } } }));
  }
  private async visible(id: string, context: SupplierActorContext) {
    const operator = await this.operator(context);
    const item = await this.prisma.promotion.findFirst({ where: { id, offerId: { not: null }, ...(operator ? {} : { supplierOrganizationId: context.organizationId }) } });
    if (!item) throw new NotFoundException("Акция не найдена");
    return { item, operator };
  }
  private async write(scope: string, key: string, input: unknown, action: (tx: Prisma.TransactionClient) => Promise<OfferPromotion>) {
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${scope + ":" + key}, 0))`;
      const previous = await tx.idempotencyRecord.findUnique({ where: { scope_key: { scope, key } } });
      if (previous) {
        if (previous.requestHash !== requestHash) throw new ConflictException("Ключ повтора использован для других условий");
        return previous.responseBody as unknown as OfferPromotion;
      }
      const result = await action(tx);
      await tx.idempotencyRecord.create({ data: { scope, key, requestHash, responseCode: 200, responseBody: result as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 86400000) } });
      return result;
    }, { timeout: 15000 });
  }
  private async termsData(tx: Prisma.TransactionClient, value: PromotionTerms, supplierId: string) {
    const evidence = await capturePromotionPrice(tx, value.offerId, supplierId);
    const main = await tx.supplierOffer.findUniqueOrThrow({ where: { id: value.offerId } });
    if (value.kind === "BUY_X_GET_Y") {
      const gift = await tx.supplierOffer.findFirst({ where: { id: value.giftOfferId!, supplierOrganizationId: supplierId, status: "ACTIVE" } });
      if (!gift) throw new ConflictException("Подарок должен быть действующим предложением этого поставщика");
      if (!new Prisma.Decimal(value.buyQuantity!).mod(main.orderIncrement).eq(0) || !new Prisma.Decimal(value.giftQuantity!).mod(gift.orderIncrement).eq(0)) throw new ConflictException("Количество покупки и подарка должно соответствовать шагу продажи предложения");
    }
    const result = { name: value.name, description: value.description, offerId: value.offerId, kind: value.kind,
      percentageBasisPoints: value.kind === "PERCENTAGE" ? value.percentageBasisPoints : null,
      fixedAmountMinor: value.kind === "FIXED_AMOUNT" ? value.fixedAmountMinor : null,
      giftOfferId: value.kind === "BUY_X_GET_Y" ? value.giftOfferId : null, giftQuantity: value.kind === "BUY_X_GET_Y" ? value.giftQuantity : null,
      buyQuantity: value.kind === "BUY_X_GET_Y" ? value.buyQuantity : null, minimumQuantity: value.minimumQuantity, quantityLimit: value.quantityLimit,
      baseAmountMinor: evidence.baseAmountMinor, currency: evidence.currency, startsAt: new Date(value.startsAt), endsAt: new Date(value.endsAt),
      scope: { offerIds: [value.offerId], productIds: [], categoryIds: [], warehouseIds: [], cityIds: [] }, oldPriceEvidence: evidence as unknown as Prisma.InputJsonValue };
    promotionUnitPrice({ ...result, baseAmountMinor: new Prisma.Decimal(result.baseAmountMinor), fixedAmountMinor: result.fixedAmountMinor === null ? null : new Prisma.Decimal(result.fixedAmountMinor) });
    if (new Prisma.Decimal(value.quantityLimit).lt(value.minimumQuantity) || result.endsAt <= new Date()) throw new ConflictException("Лимит меньше минимальной покупки или срок уже истёк");
    return { result, evidence };
  }
  private async record(tx: Prisma.TransactionClient, p: Promotion, context: SupplierActorContext, action: string, reason?: string) {
    await tx.promotionDecision.create({ data: { promotionId: p.id, revision: p.termsRevision, actorId: context.actorId, action, reason } });
    await tx.auditLog.create({ data: { ...context, action: `promotion.${action.toLowerCase()}`, entityType: "Promotion", entityId: p.id, after: { revision: p.termsRevision, version: p.version, reason } } });
    await tx.outboxEvent.create({ data: { aggregateType: "Promotion", aggregateId: p.id, eventType: "PromotionChanged", payload: { supplierOrganizationId: p.supplierOrganizationId, promotionId: p.id, action, revision: p.termsRevision, version: p.version } } });
    return (await promotionResponses(tx, [p]))[0];
  }
  async create(input: CreateOfferPromotion, context: SupplierActorContext) {
    if (!await this.prisma.supplierProfile.findUnique({ where: { organizationId: context.organizationId } })) throw new ForbiddenException("Коммерческие условия задаёт поставщик");
    return this.write(`promotion:create:${context.organizationId}:${context.actorId}`, input.idempotencyKey, input, async tx => {
      await tx.$queryRaw`SELECT id FROM "SupplierOffer" WHERE id = ${input.terms.offerId}::uuid FOR UPDATE`;
      if (input.sourceTemplateId && !await tx.promotion.findFirst({ where: { id: input.sourceTemplateId, supplierOrganizationId: context.organizationId, isTemplate: true } })) throw new NotFoundException("Шаблон не найден");
      const { result, evidence } = await this.termsData(tx, input.terms, context.organizationId);
      const p = await tx.promotion.create({ data: { ...result, supplierOrganizationId: context.organizationId, moderationStatus: "DRAFT", createdById: context.actorId } });
      await tx.promotionRevision.create({ data: { promotionId: p.id, revision: 1, terms: promotionTerms(p), evidence: evidence as unknown as Prisma.InputJsonValue } });
      return this.record(tx, p, context, input.sourceTemplateId ? "CREATED_FROM_TEMPLATE" : "CREATED");
    });
  }
  async revise(id: string, input: ReviseOfferPromotion, context: SupplierActorContext) {
    const { item } = await this.visible(id, context);
    if (item.supplierOrganizationId !== context.organizationId) throw new ForbiddenException("Оператор не назначает цену за поставщика");
    if (input.terms.offerId !== item.offerId) throw new ConflictException("Для другого предложения создайте новую акцию");
    return this.write(`promotion:${id}:${context.organizationId}:${context.actorId}`, input.idempotencyKey, input, async tx => {
      await tx.$queryRaw`SELECT id FROM "SupplierOffer" WHERE id = ${item.offerId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Promotion" WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await tx.promotion.findUniqueOrThrow({ where: { id } });
      if (current.version !== input.expectedVersion) throw new ConflictException("Акция изменилась. Обновите историю перед сохранением");
      const { result, evidence } = await this.termsData(tx, input.terms, context.organizationId);
      if (new Prisma.Decimal(input.terms.quantityLimit).lt(current.claimedQuantity)) throw new ConflictException("Лимит не может быть меньше уже оформленного количества");
      const updated = await tx.promotion.update({ where: { id }, data: { ...result, version: { increment: 1 }, termsRevision: { increment: 1 }, moderationStatus: "DRAFT", status: "DRAFT", approvedRevision: null, approvedById: null, approvedAt: null, placementStartsAt: null, placementEndsAt: null } });
      await tx.promotionRevision.create({ data: { promotionId: id, revision: updated.termsRevision, terms: input.terms, evidence: evidence as unknown as Prisma.InputJsonValue } });
      return this.record(tx, updated, context, "REVISED");
    });
  }
  async command(id: string, input: OfferPromotionCommand, context: SupplierActorContext) {
    const { item, operator } = await this.visible(id, context);
    const moderation = ["APPROVE", "REQUEST_CHANGES", "REJECT", "PLACE"].includes(input.action);
    if (moderation && !operator) throw new ForbiddenException("Решение доступно только оператору площадки");
    if (input.action === "PLACE" && !await this.access.hasAll(context.actorId, context.organizationId, ["promotion.placement.manage"])) throw new ForbiddenException("Нет права управлять витриной акций");
    if (["SUBMIT", "SAVE_TEMPLATE"].includes(input.action) && item.supplierOrganizationId !== context.organizationId) throw new ForbiddenException("Действие доступно поставщику акции");
    return this.write(`promotion:${id}:${context.organizationId}:${context.actorId}`, input.idempotencyKey, input, async tx => {
      await tx.$queryRaw`SELECT id FROM "SupplierOffer" WHERE id = ${item.offerId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Promotion" WHERE id = ${id}::uuid FOR UPDATE`;
      const p = await tx.promotion.findUniqueOrThrow({ where: { id } });
      if (p.version !== input.expectedVersion) throw new ConflictException("Версия акции изменилась. Обновите данные");
      const data: Prisma.PromotionUpdateInput = { version: { increment: 1 } };
      if (input.action === "SUBMIT") {
        if (!["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(p.moderationStatus) || p.status === "ARCHIVED") throw new ConflictException("Эта версия уже подана на проверку");
        const current = await capturePromotionPrice(tx, p.offerId!, p.supplierOrganizationId);
        if (current.baseAmountMinor !== p.baseAmountMinor?.toString() || current.currency !== p.currency) throw new ConflictException("Обычная цена изменилась. Создайте новую версию условий");
        data.moderationStatus = "PENDING";
      } else if (["APPROVE", "REQUEST_CHANGES", "REJECT"].includes(input.action)) {
        if (p.moderationStatus !== "PENDING") throw new ConflictException("Сначала поставщик должен подать эту версию на проверку");
        if (input.action === "APPROVE") {
          const current = await capturePromotionPrice(tx, p.offerId!, p.supplierOrganizationId);
          if (current.baseAmountMinor !== p.baseAmountMinor?.toString() || current.currency !== p.currency || p.endsAt <= new Date()) throw new ConflictException("Цена или срок изменились. Верните акцию поставщику");
          const overlapping = await tx.promotion.count({ where: { id: { not: id }, offerId: p.offerId, moderationStatus: "APPROVED", status: { in: ["ACTIVE", "PAUSED"] }, startsAt: { lt: p.endsAt }, endsAt: { gt: p.startsAt } } });
          if (overlapping) throw new ConflictException("На предложение уже согласована акция с пересекающимися сроками");
          data.moderationStatus = "APPROVED"; data.status = "ACTIVE"; data.approvedRevision = p.termsRevision; data.approvedById = context.actorId; data.approvedAt = new Date();
        } else { data.moderationStatus = input.action === "REJECT" ? "REJECTED" : "CHANGES_REQUESTED"; data.status = "DRAFT"; }
      } else if (input.action === "SAVE_TEMPLATE") data.isTemplate = true;
      else if (input.action === "ARCHIVE") { data.status = "ARCHIVED"; data.placementStartsAt = null; data.placementEndsAt = null; }
      else if (input.action === "PAUSE" || input.action === "RESUME") {
        if (p.moderationStatus !== "APPROVED" || p.approvedRevision !== p.termsRevision || p.endsAt <= new Date() || !["ACTIVE", "PAUSED"].includes(p.status)) throw new ConflictException("Сначала нужна действующая одобренная версия");
        data.status = input.action === "PAUSE" ? "PAUSED" : "ACTIVE";
      } else if (input.action === "PLACE") {
        if (input.startsAt && (p.moderationStatus !== "APPROVED" || p.status !== "ACTIVE" || Date.parse(input.startsAt) < p.startsAt.getTime() || Date.parse(input.endsAt!) > p.endsAt.getTime())) throw new ConflictException("Размещение должно входить в срок одобренной акции");
        data.placementStartsAt = input.startsAt ? new Date(input.startsAt) : null; data.placementEndsAt = input.endsAt ? new Date(input.endsAt) : null;
      }
      const updated = await tx.promotion.update({ where: { id }, data });
      return this.record(tx, updated, context, input.action, "reason" in input ? input.reason : undefined);
    });
  }
  async list(query: PromotionListQuery, context: SupplierActorContext) {
    const operator = await this.operator(context);
    if (!operator && query.supplierOrganizationId && query.supplierOrganizationId !== context.organizationId) throw new NotFoundException("Акции не найдены");
    const where: Prisma.PromotionWhereInput = { offerId: { not: null }, supplierOrganizationId: operator ? query.supplierOrganizationId : context.organizationId,
      ...(query.kind ? { kind: query.kind } : {}), ...(query.moderationStatus ? { moderationStatus: query.moderationStatus } : {}),
      ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}) };
    const [items, total] = await Promise.all([this.prisma.promotion.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: query.limit, skip: query.offset }), this.prisma.promotion.count({ where })]);
    return { items: await promotionResponses(this.prisma, items), total, limit: query.limit, offset: query.offset };
  }
  async storefront(query: PromotionListQuery) {
    const now = new Date(); const admitted = await this.terms.activeSupplierIds();
    const where: Prisma.PromotionWhereInput = { offerId: { not: null }, supplierOrganizationId: query.supplierOrganizationId ? { in: admitted.filter(id => id === query.supplierOrganizationId) } : { in: admitted },
      status: "ACTIVE", moderationStatus: "APPROVED", approvedRevision: { equals: this.prisma.promotion.fields.termsRevision }, startsAt: { lte: now }, endsAt: { gt: now }, kind: query.kind,
      claimedQuantity: { lt: this.prisma.promotion.fields.quantityLimit },
      AND: [{ OR: [{ kind: { not: "BUY_X_GET_Y" } }, { giftOffer: { status: "ACTIVE", publication: { is: { status: "PUBLISHED", marketplaceVisible: true } }, productVariant: { status: "ACTIVE", product: { status: "ACTIVE" } }, inventoryBalances: { some: { quantityAvailable: { gt: 0 }, warehouse: { status: "ACTIVE" }, freshnessStatus: "FRESH", OR: [{ freshnessExpiresAt: null }, { freshnessExpiresAt: { gt: now } }] } } } }] }],
      ...(query.featured ? { placementStartsAt: { lte: now }, placementEndsAt: { gt: now } } : {}),
      offer: { status: "ACTIVE", publication: { is: { status: "PUBLISHED", marketplaceVisible: true } },
        productVariant: { status: "ACTIVE", product: { id: query.productId, status: "ACTIVE", ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}) } },
        prices: { some: { status: "ACTIVE", validFrom: { lte: now }, AND: [{ OR: [{ validTo: null }, { validTo: { gt: now } }] }, { OR: [{ freshnessExpiresAt: null }, { freshnessExpiresAt: { gt: now } }] }] } },
        inventoryBalances: { some: { quantityAvailable: { gt: 0 }, freshnessStatus: "FRESH", OR: [{ freshnessExpiresAt: null }, { freshnessExpiresAt: { gt: now } }] } } },
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { offer: { productVariant: { product: { canonicalName: { contains: query.q, mode: "insensitive" } } } } }] } : {}) };
    const [items, total] = await Promise.all([this.prisma.promotion.findMany({ where, orderBy: query.sort === "NEWEST" ? [{ createdAt: "desc" }, { id: "asc" }] : [{ endsAt: "asc" }, { id: "asc" }], skip: query.offset, take: query.limit }), this.prisma.promotion.count({ where })]);
    const values = await promotionResponses(this.prisma, items);
    return { items: values.filter(p => p.temporalStatus === "ACTIVE").map(p => publicPromotionSchema.parse({ ...p, baseAmountMinor: p.evidence.baseAmountMinor })), total, limit: query.limit, offset: query.offset };
  }
}
