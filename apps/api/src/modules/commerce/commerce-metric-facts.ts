import { Prisma } from "@prisma/client";
import type { CommerceDataset } from "@marketplace/schemas";
import { returnedLineAmount } from "./order-manual-return";

export function combinedCommerceDataset(buyer: string, supplier: string): CommerceDataset {
  if ([buyer, supplier].includes("TEST")) return "TEST";
  if ([buyer, supplier].includes("DEMO")) return "DEMO";
  return buyer === "BUSINESS" && supplier === "BUSINESS" ? "BUSINESS" : "UNCLASSIFIED";
}

/** Half-up, once on the cumulative per-order base, never via floating point. */
export function goodsCommission(receivedMinor: bigint, returnedMinor = 0n): bigint {
  const net = receivedMinor > returnedMinor ? receivedMinor - returnedMinor : 0n;
  return (net + 5n) / 10n;
}

export async function metricFact(tx: Prisma.TransactionClient, orderId: string, key: string, kind: string, goods = 0n, commission = 0n) {
  await tx.commerceMetricEvent.create({ data: { supplierOrderId: orderId, sourceKey: key, kind,
    goodsAmountMinor: goods.toString(), commissionAmountMinor: commission.toString() } });
}

export async function recordCheckoutMetrics(tx: Prisma.TransactionClient, checkoutId: string) {
  const orders = await tx.supplierOrder.findMany({ where: { checkoutId }, include: {
    buyer: { select: { commerceDataset: true } }, supplier: { select: { commerceDataset: true } },
  } });
  for (const order of orders) {
    await tx.supplierOrder.update({ where: { id: order.id }, data: { commerceDataset: combinedCommerceDataset(order.buyer.commerceDataset, order.supplier.commerceDataset) } });
    const goods = BigInt(order.subtotalAmountMinor.toFixed(0));
    await metricFact(tx, order.id, `created:${order.id}`, "CREATED", goods, goodsCommission(goods));
  }
}

export async function receivedGoodsSnapshot(tx: Prisma.TransactionClient, orderId: string) {
  const items = await tx.supplierOrderItem.findMany({ where: { supplierOrderId: orderId }, include: { shipmentItems: true } });
  let received = 0n;
  for (const item of items) {
    if (!item.acceptedQuantity.gt(0)) continue;
    const quantity = item.shipmentItems.reduce((sum, value) => sum.plus(value.deliveredQuantity), new Prisma.Decimal(0));
    received += BigInt(returnedLineAmount(item.totalPriceMinor, item.acceptedQuantity, new Prisma.Decimal(0), quantity).toFixed(0));
  }
  const returns = await tx.orderManualReturn.aggregate({ where: { supplierOrderId: orderId, kind: "GOODS", goodsReceivedAt: { not: null } }, _sum: { amountMinor: true } });
  const returned = BigInt(returns._sum.amountMinor?.toFixed(0) ?? "0");
  return { received, returned, commission: goodsCommission(received, returned) };
}

export async function recordReceiptMetrics(tx: Prisma.TransactionClient, orderId: string, sourceId: string, before: Awaited<ReturnType<typeof receivedGoodsSnapshot>>, kind: "RECEIVED" | "RETURNED") {
  const after = await receivedGoodsSnapshot(tx, orderId);
  const goods = kind === "RECEIVED" ? after.received - before.received : after.returned - before.returned;
  if (goods !== 0n || after.commission !== before.commission)
    await metricFact(tx, orderId, `workflow:${sourceId}`, kind, goods, after.commission - before.commission);
}
