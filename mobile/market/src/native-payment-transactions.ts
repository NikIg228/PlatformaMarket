import { z } from "zod";
import type { NativePaymentIntent } from "./native-payment-intent-reads";

const transactionIdentity = z.object({ id: z.uuid(), paymentIntentId: z.uuid(), providerId: z.uuid(), paymentAllocationId: z.uuid().nullable() });
const allocationIdentity = z.object({ id: z.uuid(), paymentIntentId: z.uuid(), supplierOrderId: z.uuid(), supplierOrder: z.object({ id: z.uuid(), checkoutId: z.uuid(), buyerOrganizationId: z.uuid() }) });
const details = z.object({
  type: z.enum(["AUTHORIZATION", "CAPTURE", "VOID", "REFUND", "PAYOUT", "CHARGEBACK", "REVERSAL"]),
  status: z.enum(["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED"]),
  amountMinor: z.string().regex(/^-?\d{1,20}$/), currency: z.string().regex(/^[A-Z]{3}$/),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), processedAt: z.iso.datetime().nullable(),
});
export type NativePaymentTransaction = Readonly<z.output<typeof transactionIdentity> & z.output<typeof details>>;
export type NativePaymentTransactions = Readonly<{ intent: NativePaymentIntent; rows: readonly NativePaymentTransaction[] }>;

/** Called only after the same response's intent header has been validated against scope and target. */
export function decodeNativePaymentTransactions(raw: unknown, intent: NativePaymentIntent): NativePaymentTransactions {
  const source = z.object({ transactions: z.array(z.unknown()), allocations: z.array(z.unknown()) }).parse(raw);
  const allocations = source.allocations.map(row => allocationIdentity.parse(row)), allocationIds = new Set<string>(), orderIds = new Set<string>();
  for (const row of allocations) {
    if (allocationIds.has(row.id) || orderIds.has(row.supplierOrderId) || row.paymentIntentId !== intent.id || row.supplierOrder.id !== row.supplierOrderId || row.supplierOrder.checkoutId !== intent.checkoutId || row.supplierOrder.buyerOrganizationId !== intent.buyerOrganizationId) throw Error("Payment transaction contract unavailable");
    allocationIds.add(row.id); orderIds.add(row.supplierOrderId);
  }
  const identities = source.transactions.map(row => transactionIdentity.parse(row)), ids = new Set<string>();
  for (const row of identities) {
    if (ids.has(row.id) || row.paymentIntentId !== intent.id || row.providerId !== intent.providerId || (row.paymentAllocationId !== null && !allocationIds.has(row.paymentAllocationId))) throw Error("Payment transaction contract unavailable");
    ids.add(row.id);
  }
  // Check every association before reading any amount, status or provider payload.
  const rows = source.transactions.map((row, index) => Object.freeze({ ...identities[index]!, ...details.parse(row) }));
  return Object.freeze({ intent, rows: Object.freeze(rows) });
}
