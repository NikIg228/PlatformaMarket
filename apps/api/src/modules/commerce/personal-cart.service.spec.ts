import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PersonalCartService } from "./personal-cart.service";
import { PersonalCartController } from "./personal-cart.controller";
import { resolveCartOffer } from "./resolve-cart-offer";
vi.mock("./resolve-cart-offer", () => ({ resolveCartOffer: vi.fn() }));

const id = "00000000-0000-4000-8000-000000000001";
function fixture() {
  vi.mocked(resolveCartOffer).mockReset();
  const snapshot = { resolvedAt: new Date().toISOString(), offerVersion: 1, source: "BASE", ruleId: "price",
    unitPriceMinor: "9007199254740993", quantity: "1", totalPriceMinor: "9007199254740993", currency: "KZT",
    minimumOrderQuantity: "0.5", orderIncrement: "0.5", availableQuantity: "10", fulfillmentStatus: "AVAILABLE" as const };
  const item = { id, offerId: id, quantity: new Prisma.Decimal(1), pricingSnapshot: snapshot,
    offer: { productVariant: { product: { canonicalName: "Product" } }, supplier: { organization: { displayName: "Supplier" } } } };
  const cart = { id, ownerUserId: "owner", version: 1, items: [item] };
  const tx = { personalCart: {
    findFirst: vi.fn(async ({ where }: { where: { ownerUserId: string } }) => where.ownerUserId === cart.ownerUserId ? cart : null),
    findUnique: vi.fn().mockResolvedValue(cart),
    updateMany: vi.fn(async () => { cart.version++; return { count: 1 }; }),
    create: vi.fn(),
  }, personalCartItem: { create: vi.fn(), delete: vi.fn(), update: vi.fn(async ({ data }: { data: { quantity?: number; pricingSnapshot: typeof snapshot } }) => {
    Object.assign(item, { pricingSnapshot: data.pricingSnapshot });
    if (data.quantity !== undefined) item.quantity = new Prisma.Decimal(data.quantity);
  }) }, auditLog: { create: vi.fn() } };
  const prisma = { ...tx, $transaction: vi.fn(async (fn: (value: typeof tx) => unknown) => fn(tx)) };
  const service = new PersonalCartService(prisma as never, { assertActive: vi.fn() } as never);
  vi.mocked(resolveCartOffer).mockResolvedValue({ pricingSnapshot: snapshot } as never);
  return { service, prisma, tx, cart, item, snapshot };
}
describe("personal cart ownership and mutations", () => {
  it("serializes the absent current cart as JSON null", async () => {
    const carts = { current: vi.fn().mockResolvedValue(null) };
    const response = { json: vi.fn() };
    await new PersonalCartController(carts as never).current("owner", "session", response as never);
    expect(response.json).toHaveBeenCalledWith(null);
  });
  it("scopes the initial read to the verified owner and hides foreign carts", async () => {
    const t = fixture();
    await expect(t.service.get(id, "foreign")).rejects.toMatchObject({ status: 404 });
    await expect(t.service.add(id, { expectedVersion: 1, offerId: id, quantity: 2 }, "foreign")).rejects.toMatchObject({ status: 404 });
    expect(t.tx.personalCart.updateMany).not.toHaveBeenCalled();
    expect(resolveCartOffer).not.toHaveBeenCalled();
    expect(t.tx.personalCart.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id, ownerUserId: "foreign" } }));
    await expect(t.service.current("")).rejects.toMatchObject({ status: 401 });
  });
  it("returns an existing current cart without another insert or organization graph", async () => {
    const t = fixture(); const value = await t.service.create("owner");
    expect(value).toMatchObject({ mode: "PERSONAL", ownerUserId: "owner", checkoutAvailable: false, totalAmountMinor: "9007199254740993" });
    expect(value.items[0]).not.toHaveProperty("offer");
    expect(t.prisma.$transaction).not.toHaveBeenCalled();
  });
  it("CAS precedes writes; quantity retains price and uses exact half-up rounding", async () => {
    const t = fixture();
    const value = await t.service.update(id, id, { expectedVersion: 1, quantity: 2.5 }, "owner");
    expect(value.items[0].snapshot).toMatchObject({ quantity: "2.5", totalPriceMinor: "22517998136852483", unitPriceMinor: "9007199254740993" });
    expect(resolveCartOffer).not.toHaveBeenCalled();
    expect(t.tx.personalCart.updateMany).toHaveBeenCalledWith({ where: { id, ownerUserId: "owner", version: 1 }, data: { version: { increment: 1 } } });
    expect(t.tx.personalCart.updateMany.mock.invocationCallOrder[0]).toBeLessThan(t.tx.personalCartItem.update.mock.invocationCallOrder[0]);
    expect(t.tx.auditLog.create).toHaveBeenCalledTimes(1);
    await expect(t.service.update(id, id, { expectedVersion: 1, quantity: 2.5 }, "owner")).rejects.toMatchObject({ status: 409 });
    expect(t.tx.personalCartItem.update).toHaveBeenCalledTimes(1);
  });
  it("re-adding an existing offer updates quantity without silently repricing", async () => {
    const t = fixture();
    await t.service.add(id, { expectedVersion: 1, offerId: id, quantity: 3 }, "owner");
    expect(t.tx.personalCartItem.create).not.toHaveBeenCalled();
    expect(resolveCartOffer).not.toHaveBeenCalled();
    expect(t.item.pricingSnapshot.unitPriceMinor).toBe(t.snapshot.unitPriceMinor);
  });
  it("new offers always resolve personal conditions inside the mutation transaction", async () => {
    const t = fixture(); t.cart.items = [];
    await t.service.add(id, { expectedVersion: 1, offerId: id, quantity: 1 }, "owner");
    expect(resolveCartOffer).toHaveBeenCalledWith(t.tx, expect.anything(), null, id, 1, "KZT");
    expect(t.tx.personalCartItem.create).toHaveBeenCalledTimes(1);
  });
  it("a lost CAS never writes items or audit", async () => {
    const t = fixture(); t.tx.personalCart.updateMany.mockResolvedValue({ count: 0 });
    await expect(t.service.remove(id, id, { expectedVersion: 1 }, "owner")).rejects.toMatchObject({ status: 409 });
    expect(t.tx.personalCartItem.delete).not.toHaveBeenCalled(); expect(t.tx.auditLog.create).not.toHaveBeenCalled();
  });
  it("invalid increments and foreign item IDs cannot be written", async () => {
    const t = fixture();
    await expect(t.service.update(id, id, { expectedVersion: 1, quantity: 0.7 }, "owner")).rejects.toMatchObject({ status: 400 });
    expect(t.tx.personalCartItem.update).not.toHaveBeenCalled();
    await expect(t.service.remove(id, "foreign", { expectedVersion: 2 }, "owner")).rejects.toMatchObject({ status: 404 });
    expect(t.tx.personalCartItem.delete).not.toHaveBeenCalled();
  });
  it("validation exposes stock and price diff without writing it", async () => {
    const t = fixture(); const current = { ...t.snapshot, unitPriceMinor: "100", totalPriceMinor: "100", availableQuantity: "2" };
    vi.mocked(resolveCartOffer).mockResolvedValue({ pricingSnapshot: current } as never);
    const result = await t.service.validate(id, "owner");
    expect(result.items[0]).toMatchObject({ previous: t.snapshot, current, changes: ["PRICE", "STOCK"], requiresAcceptance: true });
    expect(t.tx.personalCartItem.update).not.toHaveBeenCalled();
  });
  it("newer price than the shown acceptance returns conflict", async () => {
    const t = fixture();
    vi.mocked(resolveCartOffer).mockResolvedValue({ pricingSnapshot: { ...t.snapshot, unitPriceMinor: "100", totalPriceMinor: "100" } } as never);
    await expect(t.service.reprice(id, { expectedVersion: 1, acceptedItems: [{ cartItemId: id, snapshot: t.snapshot }] }, "owner"))
      .rejects.toMatchObject({ response: { code: "PERSONAL_CART_REVALIDATION_REQUIRED" } });
    expect(t.tx.personalCartItem.update).not.toHaveBeenCalled();
  });
  it("acceptance writes the fresh server snapshot only after matching shown values", async () => {
    const t = fixture(); const current = { ...t.snapshot, unitPriceMinor: "100", totalPriceMinor: "100" };
    vi.mocked(resolveCartOffer).mockResolvedValue({ pricingSnapshot: current } as never);
    await t.service.reprice(id, { expectedVersion: 1, acceptedItems: [{ cartItemId: id, snapshot: { ...current, resolvedAt: new Date(0).toISOString() } }] }, "owner");
    expect(t.tx.personalCartItem.update).toHaveBeenCalledWith({ where: { id }, data: { pricingSnapshot: current } });
  });
  it("does not disguise a database failure as product unavailability", async () => {
    const t = fixture(); vi.mocked(resolveCartOffer).mockRejectedValue(new Error("database disconnected"));
    await expect(t.service.validate(id, "owner")).rejects.toThrow("database disconnected");
  });
  it("controller rejects absent session, invalid quantity/version, and owner injection", () => {
    const service = { add: vi.fn(), create: vi.fn() }; const c = new PersonalCartController(service as never);
    expect(() => c.create({}, "owner", "")).toThrow();
    expect(() => c.create({ ownerUserId: id }, "owner", "session")).toThrow();
    expect(() => c.add(id, { offerId: id, quantity: -1, expectedVersion: 1 }, "owner", "session")).toThrow();
    expect(() => c.add(id, { offerId: id, quantity: 1 }, "owner", "session")).toThrow();
    expect(service.add).not.toHaveBeenCalled(); expect(service.create).not.toHaveBeenCalled();
  });
});
