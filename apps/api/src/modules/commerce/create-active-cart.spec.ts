import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { createActiveCart } from "./create-active-cart";

const context = { actorId: "actor", organizationId: "buyer" };
const cart = { id: "cart", buyerOrganizationId: "buyer", currency: "KZT", items: [], checkout: null };
function fixture() {
  const transaction = { cart: { create: vi.fn().mockResolvedValue(cart) }, auditLog: { create: vi.fn().mockResolvedValue({}) } };
  const db = { cart: { findFirst: vi.fn().mockResolvedValue(null), findFirstOrThrow: vi.fn().mockResolvedValue(cart) },
    $transaction: vi.fn(async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction)) };
  return { db, transaction, run: () => createActiveCart(db as unknown as PrismaService, "buyer", { currency: "KZT" }, context) };
}
describe("create active cart operation", () => {
  it("writes cart and audit through one transaction and returns only after audit", async () => {
    const { db, transaction, run } = fixture();
    expect(await run()).toEqual(cart);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.cart.create).toHaveBeenCalledWith({ data: { buyerOrganizationId: "buyer", currency: "KZT", createdById: "actor" }, include: { items: true, checkout: true } });
    expect(transaction.auditLog.create).toHaveBeenCalledWith({ data: { ...context, action: "cart.created", entityType: "Cart", entityId: "cart", after: cart } });
  });
  it("reuses the active cart and rejects a conflicting currency before writing", async () => {
    const { db, run } = fixture(); db.cart.findFirst.mockResolvedValue(cart);
    expect(await run()).toEqual(cart); expect(db.$transaction).not.toHaveBeenCalled();
    db.cart.findFirst.mockResolvedValue({ ...cart, currency: "USD" });
    await expect(run()).rejects.toThrow("another currency"); expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("propagates transaction/audit failure and resolves only a uniqueness race", async () => {
    const { db, transaction, run } = fixture(); transaction.auditLog.create.mockRejectedValue(new Error("audit failure"));
    await expect(run()).rejects.toThrow("audit failure"); expect(db.cart.findFirstOrThrow).not.toHaveBeenCalled();
    transaction.cart.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("race", { code: "P2002", clientVersion: Prisma.prismaVersion.client }));
    expect(await run()).toEqual(cart);
    expect(db.cart.findFirstOrThrow).toHaveBeenCalledWith({ where: { buyerOrganizationId: "buyer", status: "ACTIVE" }, include: { items: true, checkout: true } });
  });
});
