import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { cartLineSnapshotSchema, calculateVatLine, type PersonalCart, type PersonalCartAdd, type PersonalCartReprice, type PersonalCartUpdate, type PersonalCartValidation, type PersonalCartVersion } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { MarketplaceAgreementsService } from "../agreements/marketplace-agreements.service";
import { calculateLineTotal, compareCartLineSnapshots, quantityMatchesOffer } from "./commerce-rules";
import { resolveCartOffer } from "./resolve-cart-offer";

const include = { items: { orderBy: { createdAt: "asc" as const }, include: { offer: { select: {
  productVariant: { select: { product: { select: { canonicalName: true } } } },
  supplier: { select: { organization: { select: { displayName: true } } } },
} } } } } satisfies Prisma.PersonalCartInclude;
type Cart = Prisma.PersonalCartGetPayload<{ include: typeof include }>;
const missing = () => new NotFoundException({ code: "PERSONAL_CART_NOT_FOUND", message: "Личная корзина или позиция не найдена." });
const conflict = () => new ConflictException({ code: "PERSONAL_CART_VERSION_CONFLICT", message: "Корзина изменилась. Обновите её и проверьте количество перед повтором." });

function present(cart: Cart): PersonalCart {
  const items = cart.items.map(item => ({ id: item.id, offerId: item.offerId,
    name: item.offer.productVariant.product.canonicalName, supplierName: item.offer.supplier.organization.displayName,
    snapshot: cartLineSnapshotSchema.parse(item.pricingSnapshot) }));
  return { id: cart.id, ownerUserId: cart.ownerUserId, mode: "PERSONAL", currency: "KZT", version: cart.version,
    items, totalAmountMinor: items.reduce((sum, item) => sum + BigInt(item.snapshot.totalPriceMinor), 0n).toString(), checkoutAvailable: false };
}

@Injectable()
export class PersonalCartService {
  constructor(private readonly prisma: PrismaService, private readonly agreements: MarketplaceAgreementsService) {}

  private owner(actorId: string) {
    if (!actorId) throw new UnauthorizedException("Войдите в личный аккаунт.");
    return actorId;
  }
  private async requireCart(db: Prisma.TransactionClient, cartId: string, actorId: string) {
    const cart = await db.personalCart.findFirst({ where: { id: cartId, ownerUserId: this.owner(actorId) }, include });
    if (!cart) throw missing();
    return cart;
  }
  async current(actorId: string) {
    const cart = await this.prisma.personalCart.findUnique({ where: { ownerUserId: this.owner(actorId) }, include });
    return cart ? present(cart) : null;
  }
  async get(cartId: string, actorId: string) { return present(await this.requireCart(this.prisma, cartId, actorId)); }
  async list(actorId: string) { const cart = await this.current(actorId); return cart ? [cart] : []; }

  async create(actorId: string) {
    this.owner(actorId);
    const existing = await this.current(actorId);
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async tx => {
        const cart = await tx.personalCart.create({ data: { ownerUserId: actorId }, include });
        await tx.auditLog.create({ data: { actorId, action: "personal_cart.created", entityType: "PersonalCart", entityId: cart.id, after: { version: 1 } } });
        return present(cart);
      });
    } catch (error) {
      // Concurrent current-cart creation converges on the owner's unique row.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const cart = await this.current(actorId);
        if (cart) return cart;
      }
      throw error;
    }
  }

  private async mutate(cartId: string, actorId: string, version: number, action: string,
    change: (tx: Prisma.TransactionClient, cart: Cart) => Promise<void>) {
    return this.prisma.$transaction(async tx => {
      const cart = await this.requireCart(tx, cartId, actorId);
      if (cart.version !== version) throw conflict();
      const claimed = await tx.personalCart.updateMany({ where: { id: cartId, ownerUserId: actorId, version }, data: { version: { increment: 1 } } });
      if (claimed.count !== 1) throw conflict();
      await change(tx, cart);
      await tx.auditLog.create({ data: { actorId, action, entityType: "PersonalCart", entityId: cartId,
        before: { version }, after: { version: version + 1 } } });
      return present(await this.requireCart(tx, cartId, actorId));
    });
  }

  private async changeQuantity(tx: Prisma.TransactionClient, item: Cart["items"][number], quantity: number) {
    const previous = cartLineSnapshotSchema.parse(item.pricingSnapshot);
    if (!quantityMatchesOffer(quantity, previous.minimumOrderQuantity, previous.orderIncrement))
      throw new BadRequestException({ code: "PERSONAL_CART_QUANTITY_INVALID", message: "Количество должно соответствовать минимуму и шагу продажи." });
    const totalPriceMinor = calculateLineTotal(previous.unitPriceMinor, quantity).toString();
    const snapshot = { ...previous, quantity: String(quantity), totalPriceMinor,
      ...(previous.tax ? { tax: calculateVatLine(totalPriceMinor, previous.tax.declaration) } : {}) };
    await tx.personalCartItem.update({ where: { id: item.id }, data: { quantity, pricingSnapshot: snapshot } });
  }

  async add(cartId: string, input: PersonalCartAdd, actorId: string) {
    return this.mutate(cartId, actorId, input.expectedVersion, "personal_cart.item_set", async (tx, cart) => {
      const existing = cart.items.find(item => item.offerId === input.offerId);
      // Re-adding an existing offer must not silently accept a new price.
      if (existing) return this.changeQuantity(tx, existing, input.quantity);
      if (cart.items.length >= 500) throw new BadRequestException("В корзине может быть не более 500 позиций.");
      const resolved = await resolveCartOffer(tx, this.agreements, null, input.offerId, input.quantity, "KZT");
      await tx.personalCartItem.create({ data: { cartId, offerId: input.offerId, quantity: input.quantity, pricingSnapshot: resolved.pricingSnapshot } });
    });
  }
  async update(cartId: string, itemId: string, input: PersonalCartUpdate, actorId: string) {
    return this.mutate(cartId, actorId, input.expectedVersion, "personal_cart.quantity_changed", async (tx, cart) => {
      const item = cart.items.find(value => value.id === itemId);
      if (!item) throw missing();
      await this.changeQuantity(tx, item, input.quantity);
    });
  }
  async remove(cartId: string, itemId: string, input: PersonalCartVersion, actorId: string) {
    return this.mutate(cartId, actorId, input.expectedVersion, "personal_cart.item_removed", async (tx, cart) => {
      const item = cart.items.find(value => value.id === itemId);
      if (!item) throw missing();
      await tx.personalCartItem.delete({ where: { id: item.id } });
    });
  }

  async validate(cartId: string, actorId: string): Promise<PersonalCartValidation> {
    const cart = await this.requireCart(this.prisma, cartId, actorId);
    const items = await Promise.all(cart.items.map(async item => {
      const previous = cartLineSnapshotSchema.parse(item.pricingSnapshot);
      try {
        const result = await resolveCartOffer(this.prisma, this.agreements, null, item.offerId, Number(item.quantity), "KZT");
        const current = result.pricingSnapshot;
        const changes = compareCartLineSnapshots(previous, current);
        return { cartItemId: item.id, previous, current, changes, requiresAcceptance: changes.length > 0, message: null };
      } catch (error) {
        // Availability errors are safe business states. An infrastructure failure
        // must remain a retryable request error, never be disguised as no stock.
        if (!(error instanceof HttpException) || ![400, 403, 404, 409].includes(error.getStatus())) throw error;
        return { cartItemId: item.id, previous, current: null, changes: ["AVAILABILITY" as const], requiresAcceptance: false,
          message: "Предложение недоступно или его условия изменились. Измените количество либо удалите позицию." };
      }
    }));
    return { cartId, cartVersion: cart.version, checkoutAvailable: false, items };
  }

  async reprice(cartId: string, input: PersonalCartReprice, actorId: string) {
    return this.mutate(cartId, actorId, input.expectedVersion, "personal_cart.conditions_accepted", async (tx, cart) => {
      for (const accepted of input.acceptedItems) {
        const item = cart.items.find(value => value.id === accepted.cartItemId);
        if (!item) throw missing();
        const current = (await resolveCartOffer(tx, this.agreements, null, item.offerId, Number(item.quantity), "KZT")).pricingSnapshot;
        if (compareCartLineSnapshots(accepted.snapshot, current).length || accepted.snapshot.availableQuantity !== current.availableQuantity)
          throw new ConflictException({ code: "PERSONAL_CART_REVALIDATION_REQUIRED", message: "Условия снова изменились. Проверьте новую цену и остаток перед подтверждением." });
        await tx.personalCartItem.update({ where: { id: item.id }, data: { pricingSnapshot: current } });
      }
    });
  }
}
