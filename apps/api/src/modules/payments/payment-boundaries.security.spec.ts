import { afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { PaymentSettlementService } from "./payment-settlement.service";
import { PaymentAdapterRegistry } from "./adapters/payment-adapter-registry.service";
import { PaymentsService } from "./payments.service";

afterEach(() => vi.unstubAllEnvs());
describe("payment provider admission", () => {
  it.each([["production", "mock"], ["test", "external"]])("rejects MOCK under %s/%s at execution and intent admission", async (env, mode) => {
    vi.stubEnv("NODE_ENV", env); vi.stubEnv("PAYMENT_PROVIDER_MODE", mode);
    const registry = new PaymentAdapterRegistry({ code: "MOCK" } as never, {} as never);
    expect(() => registry.resolve({ code: "MOCK" } as never)).toThrow(/MOCK/);
    const service = new PaymentsService({} as never, {} as never);
    await expect(service.createIntent("checkout", { providerCode: "MOCK" } as never, {} as never)).rejects.toThrow(/MOCK/);
  });
  it("retains explicit isolated mock and external adapters", () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("PAYMENT_PROVIDER_MODE", "mock");
    const mock = { code: "MOCK" }, external = {};
    const registry = new PaymentAdapterRegistry(mock as never, external as never);
    expect(registry.resolve({ code: "MOCK", capabilities: {} } as never).adapter).toBe(mock);
    vi.stubEnv("PAYMENT_PROVIDER_MODE", "external");
    expect(registry.resolve({ code: "REAL", capabilities: {} } as never).adapter).toBe(external);
  });
});

describe("refund exclusive processing", () => {
  it("rejects a second differing refund while the first remote promise is open", async () => {
    let status = "CAPTURED", release!: (value: unknown) => void;
    const adapter = { refund: vi.fn(() => new Promise(resolve => { release = resolve; })) };
    const d = (v: number) => new Prisma.Decimal(v);
    const prisma = {
      paymentAllocation: { findUnique: vi.fn(async () => ({ id: "allocation", paymentIntentId: "intent", recipientOrganizationId: "supplier", supplierOrderId: "order", status: "CAPTURED",
        grossAmountMinor: d(100), refundedAmountMinor: d(0), platformFeeMinor: d(0), refunds: [], payouts: [],
        paymentIntent: { id: "intent", providerId: "provider", provider: { capabilities: { supports_partial_refund: true } }, status, currency: "KZT", updatedAt: new Date(0) } })) },
      refund: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null) },
      paymentAttempt: { create: vi.fn().mockResolvedValue({ id: "attempt" }), findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
      paymentIntent: { updateMany: vi.fn(async () => { status = "PROCESSING"; return { count: 1 }; }) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({
        $queryRaw: vi.fn(),
        paymentTransaction: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "transaction" }) },
        refund: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "refund", status: "PROCESSING" }) },
      })),
    };
    const service = new PaymentSettlementService(prisma as never, { resolve: () => ({ adapter, context: {} }) } as never, {} as never);
    const context = { actorId: "actor", organizationId: "supplier" };
    const first = service.refund("allocation", { amountMinor: 60, idempotencyKey: "one", reason: "return" }, context);
    await vi.waitFor(() => expect(adapter.refund).toHaveBeenCalledOnce());
    await expect(service.refund("allocation", { amountMinor: 70, idempotencyKey: "two", reason: "return" }, context)).rejects.toThrow(/processing/);
    expect(adapter.refund).toHaveBeenCalledOnce(); expect(prisma.paymentAttempt.create).toHaveBeenCalledOnce();
    release({ status: "PENDING", externalId: "remote", data: {} });
    await expect(first).resolves.toMatchObject({ status: "PROCESSING" });
    expect(prisma.paymentIntent.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ updatedAt: new Date(0), allocations: { some: { id: "allocation", refundedAmountMinor: "0" } } }) }));
  });
  it("never treats PROCESSING itself as an exclusive claim", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new PaymentSettlementService({ paymentIntent: { updateMany } } as never, {} as never, {} as never);
    await expect((service as unknown as { claimIntentProcessing(id: string, statuses: string[]): Promise<void> }).claimIntentProcessing("intent", ["PROCESSING"])).rejects.toThrow(/processing/);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("supplier reconciliation projection", () => {
  it("intersects entry visibility with transaction ownership and redacts parent/provider payloads", async () => {
    const row = { id: "entry", expected: { totalAmountMinor: "secret" }, actual: { otherSupplier: "secret" },
      paymentIntent: { buyerOrganizationId: "buyer", totalAmountMinor: "secret" },
      paymentTransaction: { id: "tx", paymentIntentId: "intent", paymentAllocationId: "own", type: "REFUND", status: "SUCCEEDED", amountMinor: new Prisma.Decimal(5), currency: "KZT", responsePayload: { secret: "private" } } };
    const findMany = vi.fn().mockResolvedValue([row]);
    const service = new PaymentSettlementService({ organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) }, paymentReconciliationEntry: { findMany } } as never, {} as never, {} as never);
    const result = await service.reconciliation({ limit: 20 }, { actorId: "actor", organizationId: "supplier" });
    expect(findMany.mock.calls[0][0].where.OR).toEqual([{ paymentIntent: { buyerOrganizationId: "supplier" } }, { paymentTransaction: { paymentAllocation: { recipientOrganizationId: "supplier" } } }]);
    expect(result[0]).toMatchObject({ expected: null, actual: { amountMinor: "5" }, paymentIntent: null });
    expect(JSON.stringify(result)).not.toMatch(/secret|private|responsePayload/);
    findMany.mockResolvedValue([{ ...row, paymentIntent: { ...row.paymentIntent, buyerOrganizationId: "supplier" } }]);
    expect((await service.reconciliation({ limit: 20 }, { actorId: "actor", organizationId: "supplier" }))[0].paymentIntent).not.toBeNull();
  });
});
