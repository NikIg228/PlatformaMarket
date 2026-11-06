import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { DataFreshnessService } from "./data-freshness.service";

const context = { actorId: "actor", organizationId: "supplier" };
const input = { target: "INVENTORY" as const, inventoryBalanceId: "balance", mode: "PERMANENT" as const, value: { quantityOnHand: 10 }, reason: "Инвентаризация" };

function fixture(reserved = "5", safety = "1") {
  const balance = { id: "balance", quantityReserved: new Prisma.Decimal(reserved), safetyStock: new Prisma.Decimal(safety) };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "balance" }]),
    inventoryBalance: { findFirst: vi.fn().mockResolvedValue(balance), update: vi.fn<(args: { data: Record<string, unknown> }) => Promise<unknown>>() },
    dataOverride: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn(), create: vi.fn().mockResolvedValue({ id: "override", target: "INVENTORY" }) },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() },
  };
  const prisma = {
    inventoryBalance: { findFirst: vi.fn().mockResolvedValue({ ...balance, quantityReserved: new Prisma.Decimal(2) }) },
    dataOverride: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const permissions = { hasAll: vi.fn().mockResolvedValue(true) };
  const service = new DataFreshnessService(prisma as never, { assertCanManage: vi.fn() } as never, permissions as never);
  return { service, tx, prisma, permissions };
}

describe("manual inventory override", () => {
  it("uses the reserved quantity inside the transaction, not the older snapshot", async () => {
    const { service, tx, prisma } = fixture();
    await service.createOverride("supplier", input, context);
    const data = tx.inventoryBalance.update.mock.calls[0][0].data;
    expect(String(data.quantityReserved)).toBe("5");
    expect(String(data.quantityAvailable)).toBe("4");
    expect(prisma.inventoryBalance.findFirst).not.toHaveBeenCalled();
    expect(tx.inventoryBalance.findFirst).toHaveBeenCalledWith({ where: { id: "balance", supplierOrganizationId: "supplier" } });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.inventoryBalance.findFirst.mock.invocationCallOrder[0]);
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
    expect(tx.outboxEvent.create).toHaveBeenCalledOnce();
  });

  it("rejects on-hand below the current reservation before any write", async () => {
    const { service, tx } = fixture();
    await expect(service.createOverride("supplier", { ...input, value: { quantityOnHand: 4 } }, context)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.inventoryBalance.update).not.toHaveBeenCalled();
    expect(tx.dataOverride.create).not.toHaveBeenCalled();
  });

  it("preserves six-place fractional stock without binary rounding", async () => {
    const { service, tx } = fixture("0.1", "0.1");
    await service.createOverride("supplier", { ...input, value: { quantityOnHand: 0.3 } }, context);
    expect(String(tx.inventoryBalance.update.mock.calls[0][0].data.quantityAvailable)).toBe("0.1");
  });

  it("rejects a missing or foreign balance", async () => {
    const { service, tx } = fixture();
    tx.inventoryBalance.findFirst.mockResolvedValue(null as never);
    await expect(service.createOverride("supplier", input, context)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.dataOverride.create).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, -1, "bad"])("rejects invalid stock %s without writes", async quantityOnHand => {
    const { service, tx } = fixture();
    await expect(service.createOverride("supplier", { ...input, value: { quantityOnHand } }, context)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.dataOverride.create).not.toHaveBeenCalled();
  });

  it("denies missing adjustment permission before starting a transaction", async () => {
    const { service, prisma, permissions } = fixture();
    permissions.hasAll.mockResolvedValue(false);
    await expect(service.createOverride("supplier", input, context)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
