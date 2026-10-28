import type { SupplierOrder } from "./types";

export function isOrderReviewable(order: Pick<SupplierOrder, "reviewEligible">) {
  return order.reviewEligible === true;
}

type DecisionOrder = Pick<SupplierOrder, "status" | "items">;
const DECIDED_STATUSES = new Set([
  "CONFIRMED", "PARTIALLY_CONFIRMED", "AWAITING_PAYMENT", "PAID", "ASSEMBLING",
  "READY_TO_SHIP", "SHIPPED", "IN_TRANSIT", "DELIVERED", "PARTIALLY_FULFILLED", "RETURN_DISPUTE",
]);

export function hasPartialDecision(order: DecisionOrder) {
  // acceptedQuantity starts at zero before a supplier has made any decision.
  if (!DECIDED_STATUSES.has(order.status)) return false;
  return order.items.some(
    (item) =>
      item.acceptedQuantity !== null &&
      Number(item.acceptedQuantity) < Number(item.quantity),
  );
}

export function summarizeOrders(orders: SupplierOrder[]) {
  const currencies = new Set(orders.map((order) => order.currency));
  return {
    total: orders.length,
    awaitingConfirmation: orders.filter(
      (order) => order.status === "AWAITING_CONFIRMATION",
    ).length,
    confirmed: orders.filter((order) => order.status === "CONFIRMED").length,
    volumeMinor: orders.reduce(
      (sum, order) => sum + BigInt(order.subtotalAmountMinor),
      BigInt(0),
    ),
    currency: currencies.size === 1 ? [...currencies][0] : "KZT",
    hasMixedCurrencies: currencies.size > 1,
  };
}
