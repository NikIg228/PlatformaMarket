import { Prisma } from "@prisma/client";

/** A work queue is scoped in SQL, before cursor pagination. */
export function orderAttention(role: "buyer" | "supplier", organizationId: string): Prisma.SupplierOrderWhereInput {
  const returns = role === "supplier" ? ["REQUESTED", "GOODS_SENT", "GOODS_RECEIVED"] : ["REFUND_SENT"];
  const shared: Prisma.SupplierOrderWhereInput[] = [
    { manualReturns: { some: { status: { in: returns } } } },
    { manualReturns: { some: { status: "AGREED", kind: role === "supplier" ? { not: "GOODS" } : "GOODS" } } },
    { paymentReductions: { some: { status: "PENDING", proposedByOrganizationId: { not: organizationId } } } },
  ];
  const active: Prisma.SupplierOrderWhereInput[] = role === "supplier" ? [
    { status: "AWAITING_CONFIRMATION" },
    { status: { in: ["CONFIRMED", "AWAITING_PAYMENT"] }, manualInvoiceDocumentId: null, transferClaims: { none: { status: { not: "CONFIRMED" } } } },
    { transferClaims: { some: { status: { in: ["PENDING", "NOT_RECEIVED", "DISPUTED"] } } } },
    { paymentStatus: "PAID", status: { in: ["PAID", "ASSEMBLING", "READY_TO_SHIP"] } },
  ] : [
    { status: "PARTIALLY_CONFIRMED" },
    { status: "AWAITING_PAYMENT", paymentStatus: "UNPAID", manualInvoiceDocumentId: { not: null }, transferClaims: { none: { status: { not: "CONFIRMED" } } } },
    { transferClaims: { some: { status: "NEEDS_INFORMATION" } } },
    { shipments: { some: { status: { in: ["DISPATCHED", "IN_TRANSIT", "PARTIALLY_DELIVERED"] } } } },
  ];
  return { OR: [...shared, { status: { notIn: ["CANCELLED", "REJECTED", "DELIVERED"] }, OR: active }] };
}
