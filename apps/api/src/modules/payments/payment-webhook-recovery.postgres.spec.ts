import { randomInt, randomUUID, createHmac } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { PaymentSettlementService } from "./payment-settlement.service";
import { PaymentWebhooksService } from "./payment-webhooks.service";

describe.skipIf(!process.env.POSTGRES_TEST_DATABASE_URL)("payment webhook recovery on PostgreSQL", () => {
  let db: PrismaClient;
  let providerId: string;
  let organizationId: string;
  const code = `WEBHOOK_TEST_${randomUUID().replaceAll("-", "")}`.toUpperCase();
  const secret = randomUUID();
  const service = (client = db) => new PaymentWebhooksService(client as PrismaService,
    new PaymentSettlementService(client as PrismaService, {} as never, {} as never));
  const stale = () => new Date(Date.now() - 301_000);
  const read = (id: string) => db.paymentWebhookEvent.findUniqueOrThrow({ where: { id } });
  const event = (payload: Prisma.InputJsonObject = {}, attempt = 0, status: "RECEIVED" | "PROCESSING" = "RECEIVED") =>
    db.paymentWebhookEvent.create({ data: { providerId, externalEventId: randomUUID(), eventType: "test",
      signatureStatus: "VERIFIED", status, payload, attempt, updatedAt: status === "PROCESSING" ? stale() : new Date() } });
  const signed = (payload: object): [Buffer, Record<string, string>] => {
    const body = Buffer.from(JSON.stringify(payload)), timestamp = String(Date.now());
    return [body, { "x-payment-timestamp": timestamp,
      "x-payment-signature": createHmac("sha256", secret).update(timestamp).update(".").update(body).digest("hex") }];
  };
  async function fixture() {
    const cart = await db.cart.create({ data: { buyerOrganizationId: organizationId, status: "CHECKED_OUT" } });
    const checkout = await db.checkout.create({ data: { cartId: cart.id, buyerOrganizationId: organizationId,
      totalAmountMinor: 1000, currency: "KZT", idempotencyKey: randomUUID(), pricingSnapshot: {} } });
    const intent = await db.paymentIntent.create({ data: { checkoutId: checkout.id, buyerOrganizationId: organizationId,
      providerId, totalAmountMinor: 1000, currency: "KZT", idempotencyKey: randomUUID(), status: "PROCESSING" } });
    const order = await db.supplierOrder.create({ data: { checkoutId: checkout.id, buyerOrganizationId: organizationId,
      supplierOrganizationId: organizationId, subtotalAmountMinor: 1000, currency: "KZT", orderNumber: randomUUID() } });
    const allocation = await db.paymentAllocation.create({ data: { paymentIntentId: intent.id, supplierOrderId: order.id,
      recipientOrganizationId: organizationId, grossAmountMinor: 1000, netAmountMinor: 900, platformFeeMinor: 100 } });
    const transaction = async (type: "AUTHORIZATION" | "CAPTURE" | "REFUND" | "VOID", externalTransactionId = randomUUID()) =>
      db.paymentTransaction.create({ data: { paymentIntentId: intent.id, providerId, type, externalTransactionId,
        status: "PROCESSING", amountMinor: 1000, currency: "KZT", idempotencyKey: randomUUID(), requestPayload: { allocationIds: [allocation.id] } } });
    return { intent, order, allocation, transaction };
  }
  beforeAll(async () => {
    const target = new URL(process.env.POSTGRES_TEST_DATABASE_URL!);
    const hostedCi = process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_ENVIRONMENT === "github-hosted"
      && target.hostname === "localhost" && target.port === "5432" && target.pathname === "/marketplace"
      && process.env.DATABASE_URL === process.env.POSTGRES_TEST_DATABASE_URL;
    if (!["localhost", "127.0.0.1"].includes(target.hostname) ||
      (!hostedCi && !["/dentmarket_audit_20260914", "/market_cdek_local_20261118"].includes(target.pathname)) ||
      process.env.NODE_ENV === "production") throw new Error("Disposable local payment test database required");
    db = new PrismaClient({ datasourceUrl: target.toString() });
    providerId = (await db.paymentProvider.create({ data: { code, name: "Synthetic webhook recovery", capabilities: {} } })).id;
    organizationId = (await db.organization.create({ data: { legalName: "Webhook test", displayName: "Webhook test",
      bin: String(randomInt(100_000_000_000, 999_999_999_999)), commerceDataset: "TEST" } })).id;
    process.env[`PAYMENT_WEBHOOK_SECRET_${code}`] = secret;
  });
  afterAll(async () => { delete process.env[`PAYMENT_WEBHOOK_SECRET_${code}`]; await db?.$disconnect(); });

  it("reclaims a crashed claim after timeout but leaves a fresh claim alone", async () => {
    const old = await event({}, 1, "PROCESSING");
    const fresh = await event({}, 1, "PROCESSING");
    await db.paymentWebhookEvent.update({ where: { id: fresh.id }, data: { updatedAt: new Date() } });
    await service().process(fresh.id);
    expect((await read(fresh.id)).attempt).toBe(1);
    await service().process(old.id);
    expect(await read(old.id)).toMatchObject({ status: "PROCESSED", attempt: 2 });
  });
  it("cron discovers a stale final attempt and dead-letters it", async () => {
    const row = await event({}, 10, "PROCESSING");
    // Limit the scheduler scan to this fixture; other suites share the test DB.
    const client = new Proxy(db, { get(target, key) {
      if (key === "paymentWebhookEvent") return new Proxy(target.paymentWebhookEvent, { get(model, op) {
        if (op === "findMany") return (args: Prisma.PaymentWebhookEventFindManyArgs) =>
          model.findMany({ ...args, where: { AND: [args.where ?? {}, { id: row.id }] } });
        return Reflect.get(model, op);
      } });
      return Reflect.get(target, key);
    } });
    await service(client).retryInbox();
    expect(await read(row.id)).toMatchObject({ status: "DEAD_LETTER", attempt: 10 });
  });
  it("two reclaimers apply one claim", async () => {
    const row = await event({}, 1, "PROCESSING");
    await Promise.all([service().process(row.id), service().process(row.id)]);
    expect(await read(row.id)).toMatchObject({ status: "PROCESSED", attempt: 2 });
  });
  it("preserves signature, payload identity and provider isolation on retries", async () => {
    const payload = { id: randomUUID(), status: "SUCCEEDED" };
    const first = await service().receive(code, ...signed(payload));
    expect(await service().receive(code, ...signed(payload))).toMatchObject({ duplicate: true, eventId: first.eventId });
    await expect(service().receive(code, ...signed({ ...payload, status: "FAILED" }))).rejects.toThrow("different payload");
    const [body, headers] = signed({ id: randomUUID() });
    await expect(service().receive(code, body, { ...headers, "x-payment-signature": "00" })).rejects.toThrow("signature");
    const invalid = await event({}, 1, "PROCESSING");
    await db.paymentWebhookEvent.update({ where: { id: invalid.id }, data: { signatureStatus: "INVALID", updatedAt: stale() } });
    await service().process(invalid.id);
    expect((await read(invalid.id)).attempt).toBe(1);
    const f = await fixture(), capture = await f.transaction("CAPTURE");
    const otherProvider = await db.paymentProvider.create({ data: { code: randomUUID(), name: "Other synthetic provider", capabilities: {} } });
    const foreign = await event({ transactionId: capture.externalTransactionId!, status: "SUCCEEDED" });
    await db.paymentWebhookEvent.update({ where: { id: foreign.id }, data: { providerId: otherProvider.id } });
    await service().process(foreign.id);
    expect((await read(foreign.id)).status).toBe("FAILED");
    expect((await db.paymentTransaction.findUniqueOrThrow({ where: { id: capture.id } })).status).toBe("PROCESSING");
  });
  it("fences a delayed old owner after another process reclaims", async () => {
    const row = await event();
    let signal!: () => void, release!: () => void;
    const claimed = new Promise<void>(resolve => { signal = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    const client = new Proxy(db, { get(target, key) {
      if (key === "paymentWebhookEvent") return new Proxy(target.paymentWebhookEvent, { get(model, op) {
        if (op === "updateMany") return async (args: Prisma.PaymentWebhookEventUpdateManyArgs) => {
          const result = await model.updateMany(args); signal(); await resume; return result;
        };
        return Reflect.get(model, op);
      } });
      return Reflect.get(target, key);
    } });
    const first = service(client).process(row.id);
    await claimed;
    try {
      await db.paymentWebhookEvent.update({ where: { id: row.id }, data: { updatedAt: stale() } });
      await service().process(row.id);
    } finally { release(); }
    await first;
    expect(await read(row.id)).toMatchObject({ status: "PROCESSED", attempt: 2 });
  });
  it("rolls back money and transaction status if inbox acknowledgement fails", async () => {
    const f = await fixture(), capture = await f.transaction("CAPTURE");
    const row = await event({ transactionId: capture.externalTransactionId!, status: "SUCCEEDED" });
    const client = new Proxy(db, { get(target, key) {
      if (key === "$transaction") return (run: (tx: Prisma.TransactionClient) => Promise<unknown>) => target.$transaction(tx => run(new Proxy(tx, { get(t, k) {
        if (k === "paymentWebhookEvent") return new Proxy(t.paymentWebhookEvent, { get(model, op) {
          if (op === "update") return async () => { throw new Error("synthetic acknowledgement failure"); };
          return Reflect.get(model, op);
        } });
        return Reflect.get(t, k);
      } })));
      return Reflect.get(target, key);
    } });
    await expect(service(client).process(row.id)).rejects.toThrow("synthetic acknowledgement failure");
    expect((await read(row.id)).status).toBe("FAILED");
    expect((await db.paymentTransaction.findUniqueOrThrow({ where: { id: capture.id } })).status).toBe("PROCESSING");
    expect(await db.financialLedgerEntry.count({ where: { referenceId: f.intent.id } })).toBe(0);
    await service().process(row.id);
    await service().process(row.id);
    expect(await db.financialLedgerEntry.count({ where: { referenceId: f.intent.id } })).toBe(2);
    expect(await db.paymentCapture.count({ where: { paymentIntentId: f.intent.id } })).toBe(1);
    expect((await read(row.id)).status).toBe("PROCESSED");
  });
  it("signed callback before its transaction is retried and reconciliation resolves", async () => {
    const f = await fixture(), external = randomUUID();
    const received = await service().receive(code, ...signed({ id: randomUUID(), transactionId: external, status: "SUCCEEDED" }));
    expect(received.status).toBe("FAILED");
    await f.transaction("CAPTURE", external);
    await service().process(received.eventId);
    expect((await read(received.eventId)).status).toBe("PROCESSED");
    expect(await db.paymentReconciliationEntry.findFirst({ where: { providerId, externalRef: external } })).toMatchObject({ status: "RESOLVED" });
  });
  it("does not revert captured funds on late authorization or stale status callbacks", async () => {
    const f = await fixture(), auth = await f.transaction("AUTHORIZATION"), capture = await f.transaction("CAPTURE");
    for (const [transactionId, status] of [[capture.externalTransactionId!, "SUCCEEDED"], [auth.externalTransactionId!, "SUCCEEDED"],
      [capture.externalTransactionId!, "PROCESSING"], [capture.externalTransactionId!, "FAILED"], [capture.externalTransactionId!, "CANCELLED"]]) {
      const row = await event({ transactionId, status }); await service().process(row.id);
    }
    expect((await db.paymentIntent.findUniqueOrThrow({ where: { id: f.intent.id } })).status).toBe("CAPTURED");
    expect(await db.financialLedgerEntry.count({ where: { referenceId: f.intent.id } })).toBe(2);
  });
  it("serializes different success event IDs for the same capture", async () => {
    const f = await fixture(), capture = await f.transaction("CAPTURE");
    const rows = await Promise.all([event({ transactionId: capture.externalTransactionId!, status: "SUCCEEDED" }), event({ transactionId: capture.externalTransactionId!, status: "SUCCEEDED" })]);
    await Promise.all(rows.map(row => service().process(row.id)));
    expect(await db.financialLedgerEntry.count({ where: { referenceId: f.intent.id } })).toBe(2);
    expect(await db.paymentCapture.count({ where: { paymentIntentId: f.intent.id } })).toBe(1);
    expect((await Promise.all(rows.map(row => read(row.id)))).every(row => row.status === "PROCESSED")).toBe(true);
  });
  it("defers refund before capture, then refunds exactly once", async () => {
    const f = await fixture(), refundTx = await f.transaction("REFUND"), capture = await f.transaction("CAPTURE");
    const refund = await db.refund.create({ data: { paymentIntentId: f.intent.id, paymentAllocationId: f.allocation.id,
      supplierOrderId: f.order.id, paymentTransactionId: refundTx.id, amountMinor: 1000, netRefundMinor: 900,
      platformFeeRefundMinor: 100, reason: "Synthetic", idempotencyKey: randomUUID() } });
    const early = await event({ transactionId: refundTx.externalTransactionId!, status: "SUCCEEDED" });
    await expect(service().process(early.id)).rejects.toThrow("prerequisites");
    const paid = await event({ transactionId: capture.externalTransactionId!, status: "SUCCEEDED" });
    await service().process(paid.id); await service().process(early.id);
    const duplicate = await event({ transactionId: refundTx.externalTransactionId!, status: "SUCCEEDED" });
    await service().process(duplicate.id);
    expect((await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).status).toBe("COMPLETED");
    expect((await db.paymentIntent.findUniqueOrThrow({ where: { id: f.intent.id } })).status).toBe("REFUNDED");
    expect((await db.paymentAllocation.findUniqueOrThrow({ where: { id: f.allocation.id } })).refundedAmountMinor.toString()).toBe("1000");
    expect(await db.financialLedgerEntry.count({ where: { referenceId: f.intent.id } })).toBe(4);
  });
  it("rejects void after captured funds without undoing payment", async () => {
    const f = await fixture(), capture = await f.transaction("CAPTURE"), cancel = await f.transaction("VOID");
    await service().process((await event({ transactionId: capture.externalTransactionId!, status: "SUCCEEDED" })).id);
    const late = await event({ transactionId: cancel.externalTransactionId!, status: "SUCCEEDED" });
    await expect(service().process(late.id)).rejects.toThrow("captured funds");
    expect((await read(late.id)).status).toBe("FAILED");
    expect((await db.paymentIntent.findUniqueOrThrow({ where: { id: f.intent.id } })).status).toBe("CAPTURED");
  });
  it("keeps failed terminal state on late pending, but accepts confirmed success", async () => {
    const f = await fixture(), capture = await f.transaction("CAPTURE");
    for (const status of ["FAILED", "PROCESSING"]) await service().process((await event({ transactionId: capture.externalTransactionId!, status })).id);
    expect((await db.paymentTransaction.findUniqueOrThrow({ where: { id: capture.id } })).status).toBe("FAILED");
    await service().process((await event({ transactionId: capture.externalTransactionId!, status: "SUCCEEDED" })).id);
    expect((await db.paymentIntent.findUniqueOrThrow({ where: { id: f.intent.id } })).status).toBe("CAPTURED");
  });
});
