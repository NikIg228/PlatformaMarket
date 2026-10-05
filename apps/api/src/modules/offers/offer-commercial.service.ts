import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type { OfferCommercialState, SaveOfferCommercialInput, SaveOfferStockInput, SaveOfferPriceInput } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import { SupplierAccessService, type SupplierActorContext } from "../suppliers/supplier-access.service";
import { InventoryService } from "../inventory/inventory.service";
import { OffersService } from "./offers.service";

@Injectable()
export class OfferCommercialService {
  constructor(private readonly prisma: PrismaService, private readonly access: SupplierAccessService,
    private readonly permissions: AccessControlService, private readonly offers: OffersService, private readonly inventory: InventoryService) {}

  private async state(db: Prisma.TransactionClient, supplierId: string, offerId: string, warehouseId: string): Promise<OfferCommercialState> {
    const offer = await db.supplierOffer.findFirst({ where: { id: offerId, supplierOrganizationId: supplierId },
      include: { prices: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1 }, publication: true } });
    if (!offer) throw new NotFoundException("Предложение не найдено");
    const warehouse = await db.warehouse.findFirst({ where: { id: warehouseId, supplierOrganizationId: supplierId, status: "ACTIVE" } });
    if (!warehouse) throw new NotFoundException("Действующий склад не найден");
    const balance = await db.inventoryBalance.findUnique({ where: { supplierOrganizationId_warehouseId_productVariantId: {
      supplierOrganizationId: supplierId, warehouseId, productVariantId: offer.productVariantId,
    } } });
    if (balance && balance.offerId !== offerId) throw new ConflictException("Остаток этого варианта на складе относится к другому предложению");
    const price = offer.prices[0];
    return { offerId, offerVersion: offer.version, warehouseId,
      publicationStatus: offer.publication?.status ?? "DRAFT", marketplaceVisible: offer.publication?.marketplaceVisible ?? false,
      price: price ? { amountMinor: price.amountMinor.toString(), currency: price.currency, includesVat: price.includesVat, vatRate: price.vatRate?.toString() ?? null } : null,
      balance: balance ? { id: balance.id, version: balance.version, quantityOnHand: balance.quantityOnHand.toString(), quantityReserved: balance.quantityReserved.toString(),
        safetyStock: balance.safetyStock.toString(), quantityAvailable: balance.quantityAvailable.toString(), availabilityStatus: balance.availabilityStatus } : null };
  }

  async get(supplierId: string, offerId: string, warehouseId: string, context: SupplierActorContext) {
    await this.access.assertCanManage(supplierId, context);
    if (!await this.permissions.hasAll(context.actorId, context.organizationId, ["catalog.product.view"])) throw new ForbiddenException("Недостаточно прав для просмотра предложения");
    return this.state(this.prisma, supplierId, offerId, warehouseId);
  }

  async save(supplierId: string, offerId: string, input: SaveOfferCommercialInput, context: SupplierActorContext): Promise<OfferCommercialState> {
    return this.write(supplierId, offerId, input, context, "commercial");
  }

  async saveStock(supplierId: string, offerId: string, input: SaveOfferStockInput, context: SupplierActorContext): Promise<OfferCommercialState> {
    return this.write(supplierId, offerId, input, context, "stock");
  }

  async savePrice(supplierId: string, offerId: string, input: SaveOfferPriceInput, context: SupplierActorContext): Promise<OfferCommercialState> {
    return this.write(supplierId, offerId, input, context, "price");
  }

  private async write(supplierId: string, offerId: string, input: SaveOfferCommercialInput | SaveOfferStockInput | SaveOfferPriceInput,
    context: SupplierActorContext, mode: "commercial" | "stock" | "price"): Promise<OfferCommercialState> {
    await this.access.assertCanManage(supplierId, context);
    const required = mode === "stock" ? ["inventory.adjust"] : mode === "price" ? ["pricing.manage"] : ["pricing.manage", "inventory.adjust"];
    if (!await this.permissions.hasAll(context.actorId, context.organizationId, required))
      throw new ForbiddenException("Недостаточно прав для сохранения выбранных условий");
    const scope = `offer-${mode}:${supplierId}:${offerId}:${context.actorId}`;
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const replay = (record: { requestHash: string | null; responseBody: Prisma.JsonValue | null }) => {
      if (record.requestHash !== requestHash) throw new ConflictException("Ключ повтора уже использован для других условий");
      return record.responseBody as unknown as OfferCommercialState;
    };
    try {
      return await this.prisma.$transaction(async tx => {
        // All manual price writers take the offer lock before price rows.
        await tx.$queryRaw`SELECT id FROM "SupplierOffer" WHERE id = ${offerId}::uuid AND "supplierOrganizationId" = ${supplierId}::uuid FOR UPDATE`;
        const previous = await tx.idempotencyRecord.findUnique({ where: { scope_key: { scope, key: input.idempotencyKey } } });
        if (previous) return replay(previous);
        const current = await this.state(tx, supplierId, offerId, input.warehouseId);
        const offer = await tx.supplierOffer.findUniqueOrThrow({ where: { id: offerId } });
        if (!["MANUAL", "IMPORT"].includes(offer.sourceType) || ["BLOCKED", "ARCHIVED"].includes(offer.status))
          throw new ConflictException("Это предложение недоступно для ручного изменения условий");
        if (current.offerVersion !== input.expectedOfferVersion || (current.balance?.version ?? null) !== input.expectedBalanceVersion)
          throw new ConflictException({ code: "OFFER_COMMERCIAL_CHANGED", message: "Условия изменились после открытия формы. Сравните текущие значения с введёнными.", current });
        if (mode !== "stock" && "amountMinor" in input) {
        const samePrice = current.price && new Prisma.Decimal(current.price.amountMinor).eq(input.amountMinor) && current.price.currency === input.currency &&
          current.price.includesVat === input.includesVat && (current.price.vatRate === null ? input.vatRate === null : input.vatRate !== null && new Prisma.Decimal(current.price.vatRate).eq(input.vatRate));
        if (!samePrice) await this.offers.setPrice(supplierId, offerId, { amountMinor: input.amountMinor, currency: input.currency,
          includesVat: input.includesVat, vatRate: input.vatRate, source: "MANUAL" }, context, tx);
        }
        if (mode !== "price" && "quantityOnHand" in input) await this.inventory.setBalance(supplierId, { warehouseId: input.warehouseId, productVariantId: offer.productVariantId, offerId,
          quantityOnHand: input.quantityOnHand, quantityReserved: 0, safetyStock: 0, initialForOffer: true, source: "MANUAL" }, context, tx, input.expectedBalanceVersion);
        const result = await this.state(tx, supplierId, offerId, input.warehouseId);
        await tx.idempotencyRecord.create({ data: { scope, key: input.idempotencyKey, requestHash, responseCode: 200,
          responseBody: result as unknown as Prisma.InputJsonValue, expiresAt: new Date(Date.now() + 86400_000) } });
        return result;
      // The offer lock serializes price writers; the selected balance uses an
      // explicit expected-version CAS. ReadCommitted observes the preceding
      // lock holder's commit, including its idempotency receipt.
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (["P2002", "P2034"].includes(error.code) ||
        (error.code === "P2010" && ["40001", "40P01"].includes(String(error.meta?.code))))) {
        const previous = await this.prisma.idempotencyRecord.findUnique({ where: { scope_key: { scope, key: input.idempotencyKey } } });
        if (previous) return replay(previous);
        throw new ConflictException("Условия меняются другим запросом. Обновите текущие значения перед повтором.");
      }
      throw error;
    }
  }
}
