import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { CommerceService } from "./commerce.service";

const decimal = (value: string) => new Prisma.Decimal(value);
const context = { actorId: "actor", organizationId: "buyer" };
const terms = {
  saleUnitId: null, saleUnitName: null, packagingId: null, packagingName: null, baseUnitsPerSaleUnit: "1",
  packagingUnitId: null, packagingQuantity: null, includesVat: true, vatRate: "12",
};

function fixture() {
  const snapshot = {
    resolvedAt: new Date().toISOString(), offerVersion: 1, source: "BASE", ruleId: "price",
    unitPriceMinor: "9007199254740993", quantity: "1", totalPriceMinor: "9007199254740993",
    currency: "KZT", minimumOrderQuantity: "1", orderIncrement: "1",
    availableQuantity: "10", fulfillmentStatus: "AVAILABLE", commercialTerms: terms,
  };
  const cart = {
    id: "cart", buyerOrganizationId: "buyer", version: 3, status: "ACTIVE", currency: "KZT", checkout: null,
    items: [{ id: "line", offerId: "offer", quantity: decimal("1"),
      unitPriceMinor: decimal(snapshot.unitPriceMinor), totalPriceMinor: decimal(snapshot.totalPriceMinor),
      currency: "KZT", pricingSnapshot: snapshot }],
  };
  const offer = {
    id: "offer", version: 1, supplierOrganizationId: "supplier", productVariantId: "variant",
    saleUnitId: null, packagingId: null, packaging: null, baseUnitsPerSaleUnit: decimal("1"),
    minimumOrderQuantity: decimal("1"), orderIncrement: decimal("1"), confirmationMode: "MANUAL",
    publication: { allowedBuyerIds: [] }, contractPrices: [], priceTiers: [],
    prices: [{ id: "price", amountMinor: decimal(snapshot.unitPriceMinor), currency: "KZT",
      validFrom: new Date(0), validTo: null, includesVat: true, vatRate: decimal("12") }],
    inventoryBalances: [{ id: "balance", version: 1, warehouseId: "warehouse",
      quantityAvailable: decimal("10"), freshnessStatus: "FRESH", lots: [], _count: { lots: 0 } }],
  };
  const tx = {
    supplierOffer: { findFirst: vi.fn().mockResolvedValue(offer) },
    cart: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn() },
    cartItem: { update: vi.fn() },
    checkout: { create: vi.fn(async (_input: { data: { totalAmountMinor: Prisma.Decimal } }) => ({ id: "checkout" })), update: vi.fn() },
    buyerSupplierAgreement: { findFirst: vi.fn().mockResolvedValue(null) },
    supplierOrder: { create: vi.fn().mockResolvedValue({ id: "order" }) },
    supplierOrderItem: { create: vi.fn(async (_input: { data: { unitPriceMinor: string } }) => ({ id: "order-item" })), },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() },
  };
  const prisma = {
    supplierOffer: { findFirst: vi.fn(() => { throw new Error("Price read outside checkout transaction"); }) },
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown, _options?: unknown) => run(tx)),
    checkout: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  const inventory = { reserveForOrder: vi.fn().mockResolvedValue({ id: "reservation" }) };
  const service = new CommerceService(prisma as never, inventory as never,
    { ensure: vi.fn() } as never, {} as never, { assertOfferAllowed: vi.fn() } as never,
    { assertActive: vi.fn() } as never);
  vi.spyOn(service as unknown as { requireCart: () => Promise<typeof cart> }, "requireCart").mockResolvedValue(cart);
  vi.spyOn(service, "getCheckout").mockResolvedValue({ id: "checkout" } as never);
  const run = () => service.checkout("cart", { expectedVersion: 3, idempotencyKey: "same-key" }, context);
  return { service, prisma, tx, inventory, cart, offer, run };
}

describe("checkout accepted commercial snapshot", () => {
  it("reads terms once inside the serializable write transaction and keeps exact money", async () => {
    const { run, prisma, tx } = fixture();
    await run();
    expect(prisma.supplierOffer.findFirst).not.toHaveBeenCalled();
    expect(tx.supplierOffer.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0]?.[1]).toEqual({ isolationLevel: "Serializable" });
    expect(tx.supplierOrderItem.create.mock.calls[0]?.[0].data.unitPriceMinor).toBe("9007199254740993");
    expect(tx.checkout.create.mock.calls[0]?.[0].data.totalAmountMinor.toString()).toBe("9007199254740993");
  });

  it.each(["price", "vat", "packaging", "legacy"])("requires consent for changed %s before creating orders or reserves", async (change) => {
    const { run, tx, inventory, cart, offer } = fixture();
    if (change === "price") offer.prices[0].amountMinor = decimal("9007199254740994");
    if (change === "vat") offer.prices[0].vatRate = decimal("16");
    if (change === "packaging") offer.baseUnitsPerSaleUnit = decimal("10");
    if (change === "legacy") delete (cart.items[0].pricingSnapshot as { commercialTerms?: unknown }).commercialTerms;
    await expect(run()).rejects.toMatchObject({ response: {
      code: "CART_REVALIDATION_REQUIRED", validation: { requiresAcceptance: true, canCheckout: false },
    } });
    expect(tx.checkout.create).not.toHaveBeenCalled();
    expect(tx.supplierOrderItem.create).not.toHaveBeenCalled();
    expect(inventory.reserveForOrder).not.toHaveBeenCalled();
  });

  it("does not treat JSONB property order as changed commercial terms", async () => {
    const { run, cart } = fixture();
    cart.items[0].pricingSnapshot.commercialTerms = Object.fromEntries(Object.entries(terms).reverse()) as typeof terms;
    await expect(run()).resolves.toEqual({ id: "checkout" });
  });

  it("replays the same key without another price resolution or reserve", async () => {
    const { run, cart, inventory, tx } = fixture();
    await run();
    Object.assign(cart, { checkout: { id: "checkout", idempotencyKey: "same-key" } });
    await run();
    expect(inventory.reserveForOrder).toHaveBeenCalledTimes(1);
    expect(tx.supplierOffer.findFirst).toHaveBeenCalledTimes(1);
  });

  it("does not accept a price newer than the displayed snapshot", async () => {
    const { service, cart, tx, offer } = fixture();
    const shown = { ...cart.items[0].pricingSnapshot, fulfillmentStatus: "AVAILABLE" as const,
      unitPriceMinor: "9007199254740994", totalPriceMinor: "9007199254740994" };
    offer.prices[0].amountMinor = decimal("9007199254740995");
    await expect(service.reprice("cart", context, 3, [{ cartItemId: "line", snapshot: shown }]))
      .rejects.toMatchObject({ response: { code: "CART_REVALIDATION_REQUIRED" } });
    expect(tx.cartItem.update).not.toHaveBeenCalled();
  });

  it("requires a displayed snapshot to accept changed terms, then writes the server value", async () => {
    const { service, cart, tx, offer } = fixture();
    offer.prices[0].amountMinor = decimal("9007199254740994");
    await expect(service.reprice("cart", context, 3)).rejects.toMatchObject({ response: { code: "CART_REVALIDATION_REQUIRED" } });
    const shown = { ...cart.items[0].pricingSnapshot, fulfillmentStatus: "AVAILABLE" as const,
      unitPriceMinor: "9007199254740994", totalPriceMinor: "9007199254740994" };
    await service.reprice("cart", context, 3, [{ cartItemId: "line", snapshot: shown }]);
    expect(tx.cartItem.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ unitPriceMinor: "9007199254740994" }),
    }));
  });
});
