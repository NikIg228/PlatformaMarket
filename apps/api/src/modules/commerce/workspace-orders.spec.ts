import { describe, expect, it, vi } from "vitest";
import { workspaceOrderQuerySchema } from "@marketplace/schemas";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { WorkspaceReadsService } from "./workspace-reads.service";

const id = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const row = { id, createdAt: new Date(), status: "AWAITING_PAYMENT", paymentStatus: "UNPAID", manualInvoiceDocumentId: id,
    transferClaims: [{ status: "PENDING" }], manualReturns: [], _count: { items: 3, transferClaims: 1 } };
  const db = { organizationCapability: { findUnique: vi.fn().mockResolvedValue({}) }, supplierOrder: { findMany: vi.fn().mockResolvedValue([row, { ...row, id: "22222222-2222-4222-8222-222222222222" }]) } };
  return { db, row, service: new WorkspaceReadsService(db as unknown as PrismaService) };
}
describe("workspace order queues", () => {
  it("validates group and status before queries", () => {
    expect(workspaceOrderQuerySchema.safeParse({ group: "wrong" }).success).toBe(false);
    expect(workspaceOrderQuerySchema.safeParse({ status: "wrong" }).success).toBe(false);
    expect(workspaceOrderQuerySchema.parse({ group: "attention" })).toMatchObject({ group: "attention", limit: 50 });
  });
  it("keeps attention, search and tenant predicates before pagination and binds cursors", async () => {
    const { service, db } = fixture();
    const query = workspaceOrderQuerySchema.parse({ group: "attention", q: "клиника", limit: 1 });
    const result = await service.orders(id, "supplier", query);
    const call = db.supplierOrder.findMany.mock.calls[0][0];
    expect(call.where.supplierOrganizationId).toBe(id);
    expect(call.where.OR).toHaveLength(2);
    expect(call.where.AND).toHaveLength(2);
    expect(call.take).toBe(2);
    expect(result.items[0]).toMatchObject({ paymentReviewPending: true, partiallyPaid: true, nextAction: "Проверить перевод" });
    for (const group of ["active", "completed", "cancelled"] as const) await expect(service.orders(id, "supplier", { ...query, group, cursor: result.nextCursor! })).rejects.toThrow("Cursor");
    await expect(service.orders("other", "supplier", { ...query, cursor: result.nextCursor! })).rejects.toThrow("Cursor");
  });
  it("does not advertise payment action for a cancelled order", async () => {
    const { service, db, row } = fixture();
    db.supplierOrder.findMany.mockResolvedValue([{ ...row, status: "CANCELLED" }]);
    const result = await service.orders(id, "buyer", workspaceOrderQuerySchema.parse({ group: "cancelled" }));
    expect(result.items[0].nextAction).toBeNull();
    expect(db.supplierOrder.findMany.mock.calls[0][0].where.buyerOrganizationId).toBe(id);
  });
  it("denies a role without workspace capability before reading", async () => {
    const { service, db } = fixture(); db.organizationCapability.findUnique.mockResolvedValue(null);
    await expect(service.orders(id, "supplier", workspaceOrderQuerySchema.parse({}))).rejects.toThrow("Organization");
    expect(db.supplierOrder.findMany).not.toHaveBeenCalled();
  });
});
