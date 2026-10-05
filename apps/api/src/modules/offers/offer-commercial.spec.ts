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

function separateFixture() {
  const offer = { id: "offer", version: 1, sourceType: "MANUAL", status: "ACTIVE", productVariantId: "variant",
    prices: [{ amountMinor: new Prisma.Decimal(10000), currency: "KZT", includesVat: true, vatRate: null }], publication: { status: "PUBLISHED", marketplaceVisible: true } };
  const balance = { id: "balance", offerId: "offer", version: 1, quantityOnHand: new Prisma.Decimal(10), quantityReserved: new Prisma.Decimal(2),
    safetyStock: new Prisma.Decimal(1), quantityAvailable: new Prisma.Decimal(7), availabilityStatus: "IN_STOCK" };
  const receipts = new Map<string, unknown>();
  const tx = { $queryRaw: vi.fn(), supplierOffer: { findFirst: vi.fn(async () => offer), findUniqueOrThrow: vi.fn(async () => offer) },
    warehouse: { findFirst: vi.fn(async () => ({ id: "warehouse" })) }, inventoryBalance: { findUnique: vi.fn(async () => balance) },
    idempotencyRecord: { findUnique: vi.fn(async ({ where }) => receipts.get(where.scope_key.scope + where.scope_key.key) ?? null),
      create: vi.fn(async ({ data }) => { receipts.set(data.scope + data.key, data); }) } };
  const prisma = { ...tx, $transaction: vi.fn(async fn => fn(tx)) };
  const permissions = { hasAll: vi.fn().mockResolvedValue(true) }, access = { assertCanManage: vi.fn() };
  const price = { setPrice: vi.fn() }, stock = { setBalance: vi.fn() };
  const service = new OfferCommercialService(prisma as never, access as never, permissions as never, price as never, stock as never);
  return { service, prisma, permissions, access, price, stock, offer, balance };
}
describe("independent price and stock writes", () => {
  const context = { actorId: "actor", organizationId: "supplier" };
  const stockInput = { warehouseId: "warehouse", expectedOfferVersion: 1, expectedBalanceVersion: 1, idempotencyKey: "stock-save", quantityOnHand: 12 };
  it("saves stock without price permission or a price write, replays once and retains reserve policy", async () => {
    const f = separateFixture();
    const result = await f.service.saveStock("supplier", "offer", stockInput, context);
    expect(result.marketplaceVisible).toBe(true);
    expect(f.permissions.hasAll).toHaveBeenCalledWith("actor", "supplier", ["inventory.adjust"]);
    expect(f.price.setPrice).not.toHaveBeenCalled();
    expect(f.stock.setBalance).toHaveBeenCalledWith("supplier", expect.objectContaining({ quantityOnHand: 12, initialForOffer: true }), context, expect.anything(), 1);
    expect(await f.service.saveStock("supplier", "offer", stockInput, context)).toEqual(result);
    expect(f.stock.setBalance).toHaveBeenCalledTimes(1);
    await expect(f.service.saveStock("supplier", "offer", { ...stockInput, quantityOnHand: 13 }, context)).rejects.toMatchObject({ status: 409 });
  });
  it("saves a price without a stock write or inventory permission", async () => {
    const f = separateFixture();
    const { quantityOnHand: _quantity, ...priceInput } = input;
    await f.service.savePrice("supplier", "offer", { ...priceInput, amountMinor: "11000" }, context);
    expect(f.permissions.hasAll).toHaveBeenCalledWith("actor", "supplier", ["pricing.manage"]);
    expect(f.price.setPrice).toHaveBeenCalledTimes(1);
    expect(f.stock.setBalance).not.toHaveBeenCalled();
  });
  it.each(["stock", "price"] as const)("denies missing permission for %s before writes", async mode => {
    const f = separateFixture(); f.permissions.hasAll.mockResolvedValue(false);
    const call = mode === "stock" ? f.service.saveStock("supplier", "offer", stockInput, context) : f.service.savePrice("supplier", "offer", input, context);
    await expect(call).rejects.toMatchObject({ status: 403 }); expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("keeps stale, foreign balance and integration-owned stock protected", async () => {
    const f = separateFixture();
    await expect(f.service.saveStock("supplier", "offer", { ...stockInput, expectedBalanceVersion: 2 }, context)).rejects.toMatchObject({ status: 409 });
    f.balance.offerId = "other-offer";
    await expect(f.service.saveStock("supplier", "offer", stockInput, context)).rejects.toMatchObject({ status: 409 });
    f.balance.offerId = "offer"; f.offer.sourceType = "ERP";
    await expect(f.service.saveStock("supplier", "offer", stockInput, context)).rejects.toMatchObject({ status: 409 });
    expect(f.stock.setBalance).not.toHaveBeenCalled();
  });
});
