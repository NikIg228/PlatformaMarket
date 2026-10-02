import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { combinedCommerceDataset, goodsCommission, receivedGoodsSnapshot, recordReceiptMetrics } from "./commerce-metric-facts";
import { CommerceAnalyticsService, metricTotals } from "./commerce-analytics.service";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import type { AccessControlService } from "../access-control/access-control.service";
import type { CommerceAnalyticsQuery } from "@marketplace/schemas";

describe("commerce facts: exact cumulative goods base", () => {
  it("rejects missing identity before reading any organization data", async () => {
    const findMany = vi.fn();
    const service = new CommerceAnalyticsService({ organizationCapability: { findMany } } as unknown as PrismaService, {} as AccessControlService);
    await expect(service.report({} as CommerceAnalyticsQuery, { actorId: "", organizationId: "tenant" })).rejects.toMatchObject({ status: 401 });
    await expect(service.report({} as CommerceAnalyticsQuery, { actorId: "actor", organizationId: "" })).rejects.toMatchObject({ status: 403 });
    expect(findMany).not.toHaveBeenCalled();
  });
  it("keeps exact 10% above Number precision and cancels the full return", () => {
    const amount = 90071992547409935n;
    expect(goodsCommission(amount)).toBe(9007199254740994n);
    expect(goodsCommission(amount, amount)).toBe(0n);
    expect(goodsCommission(0n, amount)).toBe(0n);
  });
  it("does not charge each fragmented receipt separately", () => {
    let previous = 0n, accrued = 0n;
    for (let goods = 1n; goods <= 15n; goods++) { const next = goodsCommission(goods); accrued += next - previous; previous = next; }
    expect(accrued).toBe(2n);
    accrued += goodsCommission(15n, 7n) - previous;
    expect(accrued).toBe(1n);
    expect(goodsCommission(7n, 10n)).toBe(0n);
    expect(goodsCommission(15n, 10n)).toBe(1n);
  });
  it("does not call legacy unclassified orders business and isolates synthetic parties", () => {
    expect(combinedCommerceDataset("BUSINESS", "UNCLASSIFIED")).toBe("UNCLASSIFIED");
    expect(combinedCommerceDataset("BUSINESS", "BUSINESS")).toBe("BUSINESS");
    expect(combinedCommerceDataset("BUSINESS", "DEMO")).toBe("DEMO");
    expect(combinedCommerceDataset("DEMO", "TEST")).toBe("TEST");
  });
  it("rounds cumulative line receipts across shipments and records only the change", async () => {
    const create = vi.fn();
    const tx = { supplierOrderItem: { findMany: vi.fn(async () => [{ acceptedQuantity: new Prisma.Decimal(3), totalPriceMinor: new Prisma.Decimal(10), shipmentItems: [{ deliveredQuantity: new Prisma.Decimal(1) }, { deliveredQuantity: new Prisma.Decimal(1) }] }]) },
      orderManualReturn: { aggregate: vi.fn(async () => ({ _sum: { amountMinor: new Prisma.Decimal(0) } })) }, commerceMetricEvent: { create } } as unknown as Prisma.TransactionClient;
    expect(await receivedGoodsSnapshot(tx, "order")).toEqual({ received: 7n, returned: 0n, commission: 1n });
    await recordReceiptMetrics(tx, "order", "event", { received: 3n, returned: 0n, commission: 0n }, "RECEIVED");
    expect(create).toHaveBeenCalledWith({ data: { supplierOrderId: "order", sourceKey: "workflow:event", kind: "RECEIVED", goodsAmountMinor: "4", commissionAmountMinor: "1" } });
    create.mockClear();
    await recordReceiptMetrics(tx, "order", "noop", { received: 7n, returned: 0n, commission: 1n }, "RECEIVED");
    expect(create).not.toHaveBeenCalled();
  });
  it("does not mix preliminary fee with accrual or fabricate collected money", () => {
    const row = (kind: string, goods: string, commission: string) => ({ kind, orders: 1n, goods: new Prisma.Decimal(goods), commission: new Prisma.Decimal(commission) });
    const totals = metricTotals([row("CREATED", "1000", "100"), row("RECEIVED", "700", "70"), row("RETURNED", "300", "-30")]);
    expect(totals.netReceivedGoodsMinor).toBe("400"); expect(totals.accruedCommissionMinor).toBe("40");
    expect(totals.preliminaryCommissionMinor).toBe("100"); expect(totals.collectedCommissionMinor).toBeNull(); expect(totals.commissionDebtMinor).toBeNull();
  });
});
