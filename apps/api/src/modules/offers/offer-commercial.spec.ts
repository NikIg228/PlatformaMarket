import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { OfferCommercialService } from "./offer-commercial.service";

const input = { warehouseId: "warehouse", expectedOfferVersion: 1, expectedBalanceVersion: 1, idempotencyKey: "fixture-save",
  amountMinor: "10000", currency: "KZT" as const, includesVat: true, vatRate: null, quantityOnHand: 10 };
describe("commercial write error boundaries", () => {
  it.each(["40001", "40P01"])("exposes raw transaction conflict %s as a domain 409", async sqlstate => {
    const prisma = { $transaction: vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("synthetic conflict", {
      code: "P2010", clientVersion: "test", meta: { code: sqlstate },
    })), idempotencyRecord: { findUnique: vi.fn().mockResolvedValue(null) } };
    const service = new OfferCommercialService(prisma as never, { assertCanManage: vi.fn() } as never,
      { hasAll: vi.fn().mockResolvedValue(true) } as never, {} as never, {} as never);
    await expect(service.save("supplier", "offer", input, { actorId: "actor", organizationId: "supplier" })).rejects.toMatchObject({ status: 409 });
  });
  it("rejects missing inventory permission before beginning a transaction", async () => {
    const prisma = { $transaction: vi.fn() };
    const permissions = { hasAll: vi.fn().mockResolvedValue(false) };
    const service = new OfferCommercialService(prisma as never, { assertCanManage: vi.fn() } as never, permissions as never, {} as never, {} as never);
    await expect(service.save("supplier", "offer", input, { actorId: "actor", organizationId: "supplier" })).rejects.toMatchObject({ status: 403 });
    expect(permissions.hasAll).toHaveBeenCalledWith("actor", "supplier", ["pricing.manage", "inventory.adjust"]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
