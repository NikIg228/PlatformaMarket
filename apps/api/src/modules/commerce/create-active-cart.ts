import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateCartInput } from "@marketplace/schemas";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";

/** Called only after buyer authorization and organization-profile validation.
 * Cart creation and its audit record commit in the same transaction. */
export async function createActiveCart(db: PrismaService, buyerOrganizationId: string, input: CreateCartInput, context: SupplierActorContext) {
  const existing = await db.cart.findFirst({
    where: { buyerOrganizationId, status: "ACTIVE" },
    include: { items: true, checkout: true },
  });
  if (existing) {
    if (existing.currency !== input.currency)
      throw new ConflictException(
        "Active cart already uses another currency",
      );
    return existing;
  }
  try {
    return await db.$transaction(async (tx) => {
      const cart = await tx.cart.create({
        data: {
          buyerOrganizationId,
          currency: input.currency,
          createdById: context.actorId,
        },
        include: { items: true, checkout: true },
      });
      await tx.auditLog.create({
        data: {
          ...context,
          action: "cart.created",
          entityType: "Cart",
          entityId: cart.id,
          after: cart,
        },
      });
      return cart;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return db.cart.findFirstOrThrow({
        where: { buyerOrganizationId, status: "ACTIVE" },
        include: { items: true, checkout: true },
      });
    throw error;
  }
}
