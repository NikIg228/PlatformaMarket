import { Prisma } from "@prisma/client";
import { expect, it, vi } from "vitest";
import { PaymentSettlementService } from "./payment-settlement.service";

function authorizationFixture(method: "authorize" | "capture" | "cancel" = "authorize") {
  let status = method === "authorize" ? "PENDING" : "AUTHORIZED", failCommit = true;
  let allocationStatus = status;
  let attempt: Record<string, unknown> | null = null;
  const transactions: Record<string, unknown>[] = [];
  const intent = () => ({ id: "intent", providerId: "provider", provider: { capabilities: {} },
    buyerOrganizationId: "buyer", totalAmountMinor: new Prisma.Decimal(100), currency: "KZT",
    status, updatedAt: new Date(0), authorization: method === "authorize" ? null : { paymentTransactionId: "authorization" },
    allocations: [{ id: "allocation", paymentIntentId: "intent", supplierOrderId: "order", recipientOrganizationId: "supplier", status: allocationStatus,
      grossAmountMinor: new Prisma.Decimal(100), netAmountMinor: new Prisma.Decimal(90), platformFeeMinor: new Prisma.Decimal(10),
      merchantAccount: { id: "merchant", onboardingStatus: "ACTIVE", verificationStatus: "VERIFIED", payoutStatus: "READY" },
      supplierOrder: { supplierOrganizationId: "supplier", items: [] } }], transactions: [...transactions], expiresAt: new Date(2099, 0, 1) });
  const tx = {
    $queryRaw: vi.fn(),
    paymentIntent: { findUnique: vi.fn(async () => intent()), update: vi.fn(async ({ data }) => { status = data.status; }) },
    paymentTransaction: { findFirst: vi.fn(async () => transactions[0] ?? null), create: vi.fn(async ({ data }) => {
      const row = { id: "transaction", ...data }; transactions.push(row); return row;
    }) },
    paymentAuthorization: { create: vi.fn(), updateMany: vi.fn() }, paymentAllocation: {
      updateMany: vi.fn(async ({ data }) => { allocationStatus = data.status; }),
      update: vi.fn(async ({ data }) => { allocationStatus = data.status; }),
      aggregate: vi.fn(async () => ({ _sum: { grossAmountMinor: new Prisma.Decimal(100) } })),
    },
    paymentCapture: { create: vi.fn() }, paymentSession: { updateMany: vi.fn() },
    supplierOrder: { update: vi.fn(), updateMany: vi.fn() }, payout: { upsert: vi.fn() }, financialLedgerEntry: { create: vi.fn() },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() },
  };
  const prisma = {
    paymentTransaction: { findFirst: vi.fn(async () => transactions[0] ?? null) },
    paymentIntent: { findUnique: vi.fn(async () => intent()), updateMany: vi.fn(async () => { status = "PROCESSING"; return { count: 1 }; }) },
    paymentAttempt: {
      create: vi.fn(async ({ data }) => {
        if (attempt) throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
        attempt = { id: "attempt", ...data }; return attempt;
      }),
      findUnique: vi.fn(async () => attempt),
      update: vi.fn(async ({ data }) => { attempt = { ...attempt, ...data }; return attempt; }),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
      if (failCommit) { failCommit = false; throw new Error("Local commit unavailable"); }
      return callback(tx);
    }),
  };
  const result = { status: "SUCCEEDED", externalId: "remote", data: { confirmed: true } };
  const adapter = { authorize: vi.fn().mockResolvedValue(result), capture: vi.fn().mockResolvedValue(result), cancel: vi.fn().mockResolvedValue(result) };
  const registry = { resolve: vi.fn(() => ({ adapter, context: {} })) };
  const service = new PaymentSettlementService(prisma as never, registry as never, { assertActive: vi.fn() } as never);
  const context = { actorId: "actor", organizationId: "buyer" };
  const run = (key = "original-key") => service[method]("intent", { idempotencyKey: key, reason: "user cancellation" }, context);
  return { run, adapter, prisma, tx, registry, intent, changeAttempt: (data: Record<string, unknown>) => { attempt = { ...attempt, ...data }; } };
}

it("recovers authorization from durable provider success after local commit failure", async () => {
  const fixture = authorizationFixture();
  await expect(fixture.run()).rejects.toThrow("Local commit unavailable");
  expect(fixture.intent().status).toBe("PROCESSING");
  expect(fixture.intent().transactions).toHaveLength(0);
  await expect(fixture.run()).resolves.toMatchObject({ status: "AUTHORIZED" });
  await expect(fixture.run()).resolves.toMatchObject({ status: "AUTHORIZED" });
  expect(fixture.adapter.authorize).toHaveBeenCalledTimes(1);
  expect(fixture.tx.paymentTransaction.create).toHaveBeenCalledTimes(1);
  expect(fixture.tx.paymentAuthorization.create).toHaveBeenCalledTimes(1);
  expect(fixture.tx.auditLog.create).toHaveBeenCalledTimes(1);
  expect(fixture.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  expect(fixture.registry.resolve).toHaveBeenCalledTimes(1);
});

it("recovers capture and its ledger once without another provider request", async () => {
  const fixture = authorizationFixture("capture");
  await expect(fixture.run()).rejects.toThrow("Local commit unavailable");
  await expect(fixture.run()).resolves.toMatchObject({ status: "CAPTURED" });
  await expect(fixture.run()).resolves.toMatchObject({ status: "CAPTURED" });
  expect(fixture.adapter.capture).toHaveBeenCalledTimes(1);
  expect(fixture.tx.paymentCapture.create).toHaveBeenCalledTimes(1);
  expect(fixture.tx.financialLedgerEntry.create).toHaveBeenCalledTimes(2);
  expect(fixture.tx.supplierOrder.update).toHaveBeenCalledTimes(1);
  expect(fixture.tx.auditLog.create).toHaveBeenCalledTimes(1);
  expect(fixture.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
});

it("recovers cancellation once after a local commit failure", async () => {
  const fixture = authorizationFixture("cancel");
  await expect(fixture.run()).rejects.toThrow("Local commit unavailable");
  await expect(fixture.run()).resolves.toMatchObject({ status: "CANCELLED" });
  await expect(fixture.run()).resolves.toMatchObject({ status: "CANCELLED" });
  expect(fixture.adapter.cancel).toHaveBeenCalledTimes(1);
  expect(fixture.tx.paymentTransaction.create).toHaveBeenCalledTimes(1);
  expect(fixture.tx.paymentAuthorization.updateMany).toHaveBeenCalledTimes(1);
  expect(fixture.tx.auditLog.create).toHaveBeenCalledTimes(1);
  expect(fixture.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
});

it("returns the committed capture when a concurrent finalizer causes raw SQL serialization failure", async () => {
  const fixture = authorizationFixture("capture");
  await expect(fixture.run()).rejects.toThrow("Local commit unavailable");
  const conflict = new Prisma.PrismaClientKnownRequestError("serialization failure", {
    code: "P2010", clientVersion: "test", meta: { code: "40001" },
  });
  fixture.prisma.$transaction.mockImplementationOnce(async callback => {
    await callback(fixture.tx);
    throw conflict;
  });
  await expect(fixture.run()).resolves.toMatchObject({ status: "CAPTURED" });
  expect(fixture.prisma.paymentTransaction.findFirst).toHaveBeenCalledWith({ where: {
    paymentIntentId: "intent", providerId: "provider", type: "CAPTURE", idempotencyKey: "original-key",
  } });
  expect(fixture.adapter.capture).toHaveBeenCalledTimes(1);
  expect(fixture.tx.paymentCapture.create).toHaveBeenCalledTimes(1);
  expect(fixture.tx.financialLedgerEntry.create).toHaveBeenCalledTimes(2);
  expect(fixture.tx.outboxEvent.create).toHaveBeenCalledTimes(1);
});

it.each(["40001", "23503", "40P01"])("does not fabricate capture success for raw SQL %s without a completed operation", async code => {
  const fixture = authorizationFixture("capture");
  await expect(fixture.run()).rejects.toThrow("Local commit unavailable");
  const error = new Prisma.PrismaClientKnownRequestError("raw query failure", {
    code: "P2010", clientVersion: "test", meta: { code },
  });
  fixture.prisma.$transaction.mockRejectedValueOnce(error);
  await expect(fixture.run()).rejects.toBe(error);
  expect(fixture.prisma.paymentTransaction.findFirst).toHaveBeenCalledTimes(code === "40001" ? 1 : 0);
  expect(fixture.intent().status).toBe("PROCESSING");
  expect(fixture.adapter.capture).toHaveBeenCalledTimes(1);
  expect(fixture.tx.paymentCapture.create).not.toHaveBeenCalled();
  expect(fixture.tx.financialLedgerEntry.create).not.toHaveBeenCalled();
});

it("does not turn another client's key into authorization recovery", async () => {
  const fixture = authorizationFixture();
  await expect(fixture.run()).rejects.toThrow("Local commit unavailable");
  await expect(fixture.run("different-key")).rejects.toThrow(/reconciliation/);
  expect(fixture.adapter.authorize).toHaveBeenCalledTimes(1);
  expect(fixture.prisma.$transaction).toHaveBeenCalledTimes(1);
  await expect(fixture.run()).resolves.toMatchObject({ status: "AUTHORIZED" });
});

it.each([
  { status: "PROCESSING" }, { status: "FAILED" }, { externalAttemptId: null },
  { providerId: "other-provider" }, { paymentIntentId: "other-intent" },
  { responsePayload: { status: "PENDING", data: {} } },
  { requestPayload: { amountMinor: "200" } },
])("does not recover unknown or mismatched authorization proof %j", async change => {
  const fixture = authorizationFixture();
  await expect(fixture.run()).rejects.toThrow("Local commit unavailable");
  fixture.changeAttempt(change);
  await expect(fixture.run()).rejects.toThrow(/reconciliation/);
  expect(fixture.adapter.authorize).toHaveBeenCalledTimes(1);
  expect(fixture.prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(fixture.intent().status).toBe("PROCESSING");
});
