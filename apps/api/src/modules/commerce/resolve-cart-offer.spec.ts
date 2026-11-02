import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { resolveCartOffer } from "./resolve-cart-offer";
vi.mock("../../platform/config/environment", () => ({ environment: () => ({ DEPLOYMENT_PROFILE: "pilot" }) }));
const decimal = (value: string) => new Prisma.Decimal(value);
function fixture() {
  const offer = { id: "offer", version: 1, supplierOrganizationId: "supplier", saleUnitId: null, packagingId: null,
    packaging: null, baseUnitsPerSaleUnit: decimal("1"), minimumOrderQuantity: decimal("0.5"), orderIncrement: decimal("0.5"),
    publication: { allowedBuyerIds: [] as string[] },
    contractPrices: [{ id: "private", amountMinor: decimal("1"), currency: "KZT", minimumQuantity: decimal("1"), validFrom: new Date(0), validTo: null, priority: 1 }],
    priceTiers: [], prices: [{ id: "public", amountMinor: decimal("9007199254740993"), currency: "KZT", validFrom: new Date(0), validTo: null }],
    inventoryBalances: [{ id: "balance", warehouseId: "warehouse", quantityAvailable: decimal("10"), lots: [], _count: { lots: 0 } }] };
  const db = { supplierOffer: { findFirst: vi.fn().mockResolvedValue(offer) } };
  const agreements = { assertActive: vi.fn() };
  return { offer, db, agreements, run: (buyer: string | null = null, quantity = 2.5) => resolveCartOffer(db as never, agreements, buyer, "offer", quantity, "KZT") };
}
describe("shared cart offer resolution", () => {
  it("personal conditions exclude organization prices and use exact totals", async () => {
    const t = fixture(); const value = await t.run();
    expect(value.pricingSnapshot).toMatchObject({ source: "BASE", unitPriceMinor: "9007199254740993", totalPriceMinor: "22517998136852483" });
    expect(t.db.supplierOffer.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ publication: { is: { status: "PUBLISHED", marketplaceVisible: true } } }),
      include: expect.objectContaining({ contractPrices: expect.objectContaining({ where: expect.objectContaining({ id: { in: [] } }) }) }),
    }));
    expect(t.agreements.assertActive).toHaveBeenCalledWith("supplier");
  });
  it("organizational resolution retains private contracts and publication rules", async () => {
    const t = fixture(); const value = await t.run("buyer");
    expect(value.pricingSnapshot).toMatchObject({ source: "CONTRACT", unitPriceMinor: "1", totalPriceMinor: "3" });
    expect(t.db.supplierOffer.findFirst).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({
      contractPrices: expect.objectContaining({ where: expect.objectContaining({ buyerOrganizationId: "buyer" }) }),
    }) }));
  });
  it("rejects private buyer restrictions even if the caller knows the offer ID", async () => {
    const t = fixture(); t.offer.publication.allowedBuyerIds = ["buyer"];
    await expect(t.run()).rejects.toMatchObject({ status: 403 });
    await expect(t.run("buyer")).resolves.toBeTruthy();
  });
  it("rejects invalid UOM increments and reports stock without reserving it", async () => {
    const t = fixture(); await expect(t.run(null, 0.7)).rejects.toMatchObject({ status: 400 });
    t.offer.inventoryBalances[0].quantityAvailable = decimal("0");
    expect((await t.run()).pricingSnapshot.fulfillmentStatus).toBe("OUT_OF_STOCK");
  });
});
