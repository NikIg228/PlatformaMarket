import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { fullyReceived } from "./order-review-eligibility";
import { TrustCommerceService } from "./trust-commerce.service";
const d = (value: string) => new Prisma.Decimal(value);
const order = (quantity = "3", delivered = ["3"], status = "PARTIALLY_FULFILLED") => ({
  id: "order", status, buyerOrganizationId: "buyer", supplierOrganizationId: "supplier",
  items: [{ id: "item", productVariantId: "product", acceptedQuantity: d(quantity) }],
  shipments: delivered.map(value => ({ status: "PARTIALLY_DELIVERED", items: [{ supplierOrderItemId: "item", deliveredQuantity: d(value) }] })),
});
const context = { actorId: "user", organizationId: "buyer" };
const input = { overallRating: 5, comment: "Получено", dimensions: { availabilityAccuracy: 5, priceAccuracy: 5, confirmationSpeed: 5, completeness: 5, delivery: 5, documents: 5, communication: 5 }, idempotencyKey: "review-one" };
function fixture(value = order()) {
  const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: "order" }]),
    supplierOrder: { findUniqueOrThrow: vi.fn().mockResolvedValue(value), findFirst: vi.fn().mockResolvedValue(value) },
    verifiedReview: { findUnique: vi.fn().mockResolvedValue(null), count: vi.fn().mockResolvedValue(0), create: vi.fn().mockImplementation(async ({ data }) => ({ id: "review", ...data })) },
    verifiedReviewRevision: { create: vi.fn() }, auditLog: { create: vi.fn() },
  };
  return { tx, service: new TrustCommerceService({ ...tx, $transaction: (fn: (db: typeof tx) => unknown) => fn(tx) } as never) };
}
describe("receipt-based review right", () => {
  it("accepts all physical goods before installation and documents close", () => expect(fullyReceived(order())).toBe(true));
  it.each(["DELIVERED", "PARTIALLY_FULFILLED", "REJECTED", "CANCELLED", "RETURN_DISPUTE"])("%s without full receipt grants no review", status => {
    expect(fullyReceived(order("3", ["2"], status))).toBe(false);
  });
  it("sums split/resupply receipts exactly and requires every accepted item", () => {
    const value = order("0.3", ["0.1", "0.2"]); expect(fullyReceived(value)).toBe(true);
    value.items.push({ id: "missing", productVariantId: "another", acceptedQuantity: d("0.000001") });
    expect(fullyReceived(value)).toBe(false);
  });
  it("rejects empty, rejected-only and cancelled shipment quantities", () => {
    expect(fullyReceived(order("0", ["0"]))).toBe(false);
    const value = order(); value.shipments[0].status = "CANCELLED"; expect(fullyReceived(value)).toBe(false);
    expect(fullyReceived({ items: [], shipments: [] })).toBe(false);
  });
  it("keeps the earned right after a return without treating a partial receipt as full", () => {
    const value = order(); value.shipments[0].status = "RETURNED"; expect(fullyReceived(value)).toBe(true);
    value.shipments[0].items[0].deliveredQuantity = d("2"); expect(fullyReceived(value)).toBe(false);
  });
  it("creates one review with revision and audit after full receipt", async () => {
    const { tx, service } = fixture(); const result = await service.createReview("order", input, context);
    expect(result.status).toBe("PUBLISHED"); expect(tx.verifiedReview.create).toHaveBeenCalledOnce();
    expect(tx.verifiedReviewRevision.create).toHaveBeenCalledOnce(); expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });
  it("rejects partial receipts before any mutation", async () => {
    const { tx, service } = fixture(order("3", ["2"])); await expect(service.createReview("order", input, context)).rejects.toMatchObject({ status: 409 });
    expect(tx.verifiedReview.create).not.toHaveBeenCalled();
  });
  it("scopes the locked order to the buyer and hides foreign orders", async () => {
    const { tx, service } = fixture(); tx.$queryRaw.mockResolvedValue([]);
    await expect(service.createReview("order", input, context)).rejects.toMatchObject({ status: 404 });
    expect(tx.supplierOrder.findUniqueOrThrow).not.toHaveBeenCalled(); expect(tx.verifiedReview.create).not.toHaveBeenCalled();
    const query = tx.$queryRaw.mock.calls[0][0] as unknown as Prisma.Sql;
    expect(query.values).toEqual(["order", "buyer"]);
  });
  it("returns an existing idempotent result without creating another audit, even for a historical review", async () => {
    const { tx, service } = fixture(order("3", ["0"]));
    const existing = { id: "review", supplierOrderId: "order", reviewerOrganizationId: "buyer", targetKey: "SUPPLIER" };
    tx.verifiedReview.findUnique.mockResolvedValue(existing as never);
    expect(await service.createReview("order", input, context)).toBe(existing); expect(tx.verifiedReview.create).not.toHaveBeenCalled();
  });
  it("refuses a second key or a foreign key and preserves the existing review", async () => {
    const { tx, service } = fixture(); tx.verifiedReview.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "old" } as never);
    await expect(service.createReview("order", input, context)).rejects.toMatchObject({ status: 409 });
    tx.verifiedReview.findUnique.mockResolvedValue({ supplierOrderId: "foreign" } as never);
    await expect(service.createReview("order", input, context)).rejects.toMatchObject({ status: 409 });
    expect(tx.verifiedReview.create).not.toHaveBeenCalled();
  });
  it("returns the authoritative state only for an owned order", async () => {
    const { tx, service } = fixture(); expect(await service.orderReviewState("order", context)).toEqual({ orderId: "order", eligible: true, review: null });
    expect(tx.supplierOrder.findFirst.mock.calls[0][0].where).toEqual({ id: "order", buyerOrganizationId: "buyer" });
    tx.supplierOrder.findFirst.mockResolvedValue(null as never);
    await expect(service.orderReviewState("order", context)).rejects.toMatchObject({ status: 404 });
  });
});
