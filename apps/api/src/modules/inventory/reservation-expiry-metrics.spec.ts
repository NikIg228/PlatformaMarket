import { describe, expect, it, vi } from "vitest";
import { ReservationExpiryService } from "./reservation-expiry.service";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import type { InventoryService } from "./inventory.service";
import type { BackgroundQueueService } from "../../platform/jobs/background-queue.service";

describe("reservation expiry commerce metrics", () => {
  it.each([
    ["COMPLETED", "AWAITING_CONFIRMATION", 1],
    ["FAILED", "AWAITING_CONFIRMATION", 0],
    ["COMPLETED", "CANCELLED", 0],
    ["COMPLETED", "REJECTED", 0],
  ])("records only a new commercial cancellation: %s / %s", async (checkoutStatus, status, count) => {
    const order = { id: "order", supplierOrganizationId: "supplier", buyerOrganizationId: "buyer", status,
      checkout: { status: checkoutStatus }, paymentStatus: "UNPAID", transferClaims: [], shipments: [],
      items: [{ reservation: { id: "reservation", inventoryBalanceId: "balance", status: "ACTIVE", expiresAt: new Date(0) } }] };
    const create = vi.fn();
    const tx = { $queryRaw: vi.fn(async () => []),
      supplierOrder: { findUnique: vi.fn(async () => order), findUniqueOrThrow: vi.fn(async () => order), update: vi.fn() },
      supplierOrderItem: { updateMany: vi.fn() }, inventoryReservation: { update: vi.fn() },
      auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() }, commerceMetricEvent: { create } };
    const prisma = { $transaction: async (action: (client: typeof tx) => unknown) => action(tx) } as unknown as PrismaService;
    const inventory = { releaseReservationInTransaction: vi.fn() } as unknown as InventoryService;
    expect(await new ReservationExpiryService(prisma, inventory, {} as BackgroundQueueService).expireOrder("order", new Date())).toBe(true);
    expect(create).toHaveBeenCalledTimes(count);
    if (count) expect(create).toHaveBeenCalledWith({ data: { supplierOrderId: "order", sourceKey: "cancelled:order", kind: "CANCELLED", goodsAmountMinor: "0", commissionAmountMinor: "0" } });
  });
});
