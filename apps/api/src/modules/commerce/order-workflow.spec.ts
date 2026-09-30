import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { OrderWorkflowService } from "./order-workflow.service";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import type { AccessControlService } from "../access-control/access-control.service";

const context = { actorId: "actor", organizationId: "buyer" };
function fixture(overrides: Record<string, unknown> = {}) {
  const order = { id: "order", buyerOrganizationId: "buyer", supplierOrganizationId: "supplier", status: "PARTIALLY_CONFIRMED", paymentStatus: "UNPAID", version: 3, paymentAllocation: null, transferClaims: [], items: [], subtotalAmountMinor: new Prisma.Decimal("9007199254740993"), ...overrides };
  const events: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: vi.fn(async () => []),
    supplierOrder: { findFirst: vi.fn(async () => ({ id: "order" })), findUniqueOrThrow: vi.fn(async () => order), update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { Object.assign(order, { ...data, version: order.version + 1 }); return order; }) },
    orderWorkflowEvent: { findUnique: vi.fn(async () => events[0] ?? null), create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { events.push(data); return data; }) },
    auditLog: { create: vi.fn(async () => ({})) }, outboxEvent: { create: vi.fn(async () => ({})) },
    document: { findFirst: vi.fn() }, uploadAsset: { findFirst: vi.fn() },
    orderTransferClaim: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  };
  const prisma = { ...tx, $transaction: async (action: (client: typeof tx) => Promise<unknown>) => action(tx) };
  const access = { hasAll: vi.fn(async () => true) };
  return { order, events, tx, access, service: new OrderWorkflowService(prisma as unknown as PrismaService, access as unknown as AccessControlService) };
}
describe("order workflow invariants", () => {
  it("refuses a first transfer report after the deadline before creating a claim", async () => {
    const f = fixture({ status: "AWAITING_PAYMENT", items: [{ reservation: { status: "ACTIVE", expiresAt: new Date(0) } }] });
    await expect(f.service.execute("order", { action: "REPORT_TRANSFER", expectedVersion: 3, idempotencyKey: "key", invoiceDocumentId: "invoice", documentId: "proof", amountMinor: "9007199254740993", paidAt: new Date().toISOString(), comment: "" }, context)).rejects.toThrow(/Срок резерва истёк/);
    expect(f.tx.orderTransferClaim.create).not.toHaveBeenCalled();
  });
  it("accepts changed composition once and replays the original result despite newer version", async () => {
    const f = fixture();
    const command = { action: "ACCEPT_COMPOSITION" as const, expectedVersion: 3, idempotencyKey: "key" };
    const first = await f.service.execute("order", command, context);
    expect(first.status).toBe("CONFIRMED");
    expect(await f.service.execute("order", command, context)).toEqual(first);
    expect(f.tx.supplierOrder.update).toHaveBeenCalledTimes(1);
    expect(f.tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(f.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
    await expect(f.service.execute("order", { ...command, expectedVersion: 4 }, context)).rejects.toThrow(/Ключ повтора/);
  });
  it("rejects stale writes before domain effects", async () => {
    const f = fixture();
    await expect(f.service.execute("order", { action: "ACCEPT_COMPOSITION", expectedVersion: 2, idempotencyKey: "key" }, context)).rejects.toThrow(/Заказ изменился/);
    expect(f.tx.supplierOrder.update).not.toHaveBeenCalled();
  });
  it("hides foreign orders before acquiring write locks", async () => {
    const f = fixture(); f.tx.supplierOrder.findFirst.mockResolvedValueOnce(null as never);
    await expect(f.service.execute("order", { action: "ACCEPT_COMPOSITION", expectedVersion: 3, idempotencyKey: "key" }, context)).rejects.toThrow(/не найден/);
    expect(f.tx.$queryRaw).not.toHaveBeenCalled();
  });
  it("requires dedicated supplier payment permission", async () => {
    const f = fixture(); f.access.hasAll.mockImplementation(async (...args: unknown[]) => !(args[2] as string[]).includes("payment.transfer.confirm"));
    await expect(f.service.execute("order", { action: "CONFIRM_TRANSFER", claimId: "claim", expectedVersion: 3, idempotencyKey: "key" }, { ...context, organizationId: "supplier" })).rejects.toThrow(/Недостаточно прав/);
    expect(f.tx.$queryRaw).not.toHaveBeenCalled();
  });
  it("never cancels an unresolved reported transfer", async () => {
    const f = fixture({ status: "AWAITING_PAYMENT", transferClaims: [{ id: "claim", status: "PENDING" }] });
    await expect(f.service.execute("order", { action: "CANCEL", expectedVersion: 3, idempotencyKey: "key", reason: "Передумали", transferNotMade: true }, context)).rejects.toThrow(/поддержку/);
    expect(f.tx.supplierOrder.update).not.toHaveBeenCalled();
  });
  it("rejects a one-tiyn difference beyond safe Number precision", async () => {
    const f = fixture({ status: "AWAITING_PAYMENT", manualInvoiceDocumentId: "invoice" });
    await expect(f.service.execute("order", { action: "REPORT_TRANSFER", expectedVersion: 3, idempotencyKey: "key", invoiceDocumentId: "invoice", documentId: "proof", amountMinor: "9007199254740992", paidAt: new Date().toISOString(), comment: "" }, context)).rejects.toThrow(/полной суммы/);
    expect(f.tx.orderTransferClaim.create).not.toHaveBeenCalled();
  });
});
