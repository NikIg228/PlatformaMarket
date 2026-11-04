import { Prisma } from "@prisma/client";
import { expect, it, vi } from "vitest";
import { PaymentSettlementService } from "./payment-settlement.service";

function fixture() {
  let status = "READY", failCommit = true;
  let transactionId: string | null = null, attempt: Record<string, unknown> | null = null;
  const payout = () => ({ id: "payout", status, amountMinor: new Prisma.Decimal(90), currency: "KZT", merchantAccountId: "merchant",
    paymentAllocationId: "allocation", paymentTransactionId: transactionId, paymentAllocation: { paymentIntentId: "intent" },
    merchantAccount: { organizationId: "supplier", providerId: "provider", externalMerchantId: "remote-merchant", payoutStatus: "READY", provider: { code: "MOCK" } } });
  const transactions: Record<string, unknown>[] = [];
  const tx = {
    $queryRaw: vi.fn(),
    payout: { findUnique: vi.fn(async () => payout()), update: vi.fn(async ({ data }) => {
      status = data.status; transactionId = data.paymentTransactionId; return payout();
    }) },
    paymentTransaction: { findFirst: vi.fn(async () => transactions[0] ?? null), create: vi.fn(async ({ data }) => {
      const row = { id: "transaction", ...data }; transactions.push(row); return row;
    }) },
    paymentAllocation: { update: vi.fn() }, financialLedgerEntry: { create: vi.fn() },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() },
  };
  const prisma = {
    payout: { findUnique: vi.fn(async () => payout()), updateMany: vi.fn(async () => { status = "PROCESSING"; return { count: 1 }; }) },
    paymentAttempt: { create: vi.fn(async ({ data }) => { attempt = { id: "attempt", ...data }; return attempt; }),
      findUnique: vi.fn(async () => attempt), update: vi.fn(async ({ data }) => { attempt = { ...attempt, ...data }; return attempt; }) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
      if (failCommit) { failCommit = false; throw new Error("Local commit unavailable"); }
      return callback(tx);
    }),
  };
  const adapter = { payout: vi.fn().mockResolvedValue({ status: "SUCCEEDED", externalId: "remote-payout", data: {} }) };
  const service = new PaymentSettlementService(prisma as never, { resolve: () => ({ adapter, context: {} }) } as never, {} as never);
  const run = (key = "original-key") => service.processPayout("payout", { idempotencyKey: key }, { actorId: "actor", organizationId: "supplier" });
  return { run, prisma, tx, adapter, changeAttempt: (data: Record<string, unknown>) => { attempt = { ...attempt, ...data }; } };
}

it("recovers payout after provider success without repeating the transfer or ledger", async () => {
  const f = fixture();
  await expect(f.run()).rejects.toThrow("Local commit unavailable");
  await expect(f.run()).resolves.toMatchObject({ status: "PAID", paymentTransactionId: "transaction" });
  await expect(f.run()).resolves.toMatchObject({ status: "PAID" });
  expect(f.adapter.payout).toHaveBeenCalledTimes(1);
  expect(f.tx.paymentTransaction.create).toHaveBeenCalledTimes(1);
  expect(f.tx.financialLedgerEntry.create).toHaveBeenCalledTimes(1);
  expect(f.tx.auditLog.create).toHaveBeenCalledTimes(1);
  expect(f.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
});

it("rejects another payout key while the successful transfer awaits local recovery", async () => {
  const f = fixture();
  await expect(f.run()).rejects.toThrow("Local commit unavailable");
  await expect(f.run("other-key")).rejects.toThrow(/reconciliation/);
  expect(f.adapter.payout).toHaveBeenCalledTimes(1);
  await expect(f.run()).resolves.toMatchObject({ status: "PAID" });
});

it.each(["PROCESSING", "FAILED"])("does not retry a provider call with a %s attempt", async status => {
  const f = fixture();
  await expect(f.run()).rejects.toThrow("Local commit unavailable");
  f.changeAttempt({ status });
  await expect(f.run()).rejects.toThrow(/reconciliation/);
  expect(f.adapter.payout).toHaveBeenCalledTimes(1);
  expect(f.prisma.$transaction).toHaveBeenCalledTimes(1);
});
