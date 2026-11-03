import { describe, expect, it, vi } from "vitest";
import { InventoryFreshnessService } from "./inventory-freshness.service";

function fixture(changed: number, freshAvailable = 0) {
  const balance = { id: "balance", version: 7, supplierOrganizationId: "supplier", offerId: "offer", source: "MANUAL", lastSuccessfulSyncAt: null, freshnessExpiresAt: new Date(0) };
  const tx = {
    inventoryBalance: { updateMany: vi.fn().mockResolvedValue({ count: changed }), count: vi.fn().mockResolvedValue(freshAvailable) },
    offerPublication: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() },
  };
  const prisma = { inventoryBalance: { findMany: vi.fn().mockResolvedValue([balance]) }, freshnessPolicy: { findMany: vi.fn().mockResolvedValue([]) }, $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => run(tx)) };
  return { balance, tx, service: new InventoryFreshnessService(prisma as never, {} as never) };
}

describe("inventory freshness conditional transition", () => {
  it("does not pause offers or publish events when a concurrent refresh invalidated the snapshot", async () => {
    const { service, tx, balance } = fixture(0);
    expect(await service.recompute("supplier")).toMatchObject({ staleBalances: 0, pausedOffers: 0 });
    expect(tx.inventoryBalance.updateMany).toHaveBeenCalledWith({ where: { id: balance.id, version: balance.version, source: balance.source, freshnessStatus: { not: "STALE" }, lastSuccessfulSyncAt: null, freshnessExpiresAt: balance.freshnessExpiresAt }, data: { freshnessStatus: "STALE", version: { increment: 1 } } });
    expect(tx.offerPublication.updateMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("pauses a genuinely stale offer and records exactly the changed balance", async () => {
    const { service, tx } = fixture(1);
    expect(await service.recompute("supplier")).toMatchObject({ staleBalances: 1, pausedOffers: 1 });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: { aggregateType: "SupplierProfile", aggregateId: "supplier", eventType: "InventoryFreshnessChanged", payload: { supplierOrganizationId: "supplier", staleBalanceIds: ["balance"], pausedOfferIds: ["offer"] } } });
  });

  it("keeps the offer published when another fresh balance is available", async () => {
    const { service, tx } = fixture(1, 1);
    expect(await service.recompute("supplier")).toMatchObject({ staleBalances: 1, pausedOffers: 0 });
    expect(tx.offerPublication.updateMany).not.toHaveBeenCalled();
  });
});
