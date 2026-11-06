import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HttpPaymentAdapter } from "../../modules/payments/adapters/http-payment.adapter";
import { assertPaymentProviderAdmitted } from "../../modules/payments/adapters/payment-provider-admission";
import { PaymentWebhooksService } from "../../modules/payments/payment-webhooks.service";
import { PaymentSettlementService } from "../../modules/payments/payment-settlement.service";
import type { PaymentAdapterRegistry } from "../../modules/payments/adapters/payment-adapter-registry.service";
import type { MarketplaceAgreementsService } from "../../modules/agreements/marketplace-agreements.service";
import { HttpNotificationAdapter, InAppNotificationAdapter, WebhookNotificationAdapter } from "../../modules/notifications/notification-adapters";
import { NotificationAdapterRegistry } from "../../modules/notifications/notification-adapter-registry.service";
import { NotificationsService } from "../../modules/notifications/notifications.service";
import { ConfiguredSignatureAdapter, MockSignatureAdapter } from "../../modules/documents/signature-adapter";
import { SignatureAdapterRegistry } from "../../modules/documents/signature-adapter-registry.service";
import { deliverAuthMail } from "../../modules/identity/auth-mail.delivery";
import { OidcVerifierService } from "../../modules/identity/oidc-verifier.service";
import { OpenAiResponsesService } from "../../modules/ai/openai-responses.service";
import type { AiSafetyService } from "../../modules/ai/ai-safety.service";
import { OutboundRequestGateway } from "../security/outbound-request.gateway";
import type { PrismaService } from "../prisma/prisma.service";
import type { BackgroundQueueService } from "../jobs/background-queue.service";
import type { OutboxHandlerRegistry } from "../outbox/outbox-handler.registry";
import type { MarketplaceEnvironment } from "./environment";

const network = vi.fn(() => { throw new Error("Unexpected network call"); });
beforeEach(() => { vi.stubEnv("LIMITED_TEST_STAND", "true"); vi.stubGlobal("fetch", network); network.mockClear(); });
afterEach(() => { expect(network).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const blocked = "отключены на тестовом стенде";
const context = { providerId: "provider", providerCode: "EXTERNAL", capabilities: {} };
const money = { paymentIntentId: "intent", amountMinor: "100", currency: "KZT", idempotencyKey: "test" };

it("blocks every real payment operation even if credentials are supplied directly", async () => {
  vi.stubEnv("PAYMENT_GATEWAY_URL", "https://payments.example.kz");
  vi.stubEnv("PAYMENT_GATEWAY_TOKEN", "synthetic-token");
  const adapter = new HttpPaymentAdapter();
  for (const operation of [
    () => adapter.onboardMerchant(context, { organizationId: "org", idempotencyKey: "test" }),
    () => adapter.createSession(context, { ...money, allocationCount: 1 }),
    () => adapter.authorize(context, money), () => adapter.capture(context, money),
    () => adapter.cancel(context, { ...money, reason: "test" }),
    () => adapter.refund(context, { ...money, paymentAllocationId: "allocation", reason: "test" }),
    () => adapter.payout(context, { ...money, merchantExternalId: "merchant" }),
  ]) await expect(operation()).rejects.toThrow(blocked);
  for (const code of ["MOCK", "EXTERNAL", "CARD"]) expect(() => assertPaymentProviderAdmitted(code)).toThrow(blocked);
});
it("blocks payment callbacks and retries before any persistence or settlement", async () => {
  const prisma = {} as PrismaService;
  const service = new PaymentWebhooksService(prisma, {} as PaymentSettlementService);
  await expect(service.receive("EXTERNAL", Buffer.from("{}"), {})).rejects.toThrow(blocked);
  await expect(service.process("event")).rejects.toThrow(blocked);
  await expect(service.retryInbox()).resolves.toBeUndefined();
});
it("blocks settlement/recovery before reading or changing payment records", async () => {
  const service = new PaymentSettlementService({} as PrismaService, {} as PaymentAdapterRegistry, {} as MarketplaceAgreementsService);
  const actor = { actorId: "actor", organizationId: "org" };
  await expect(service.authorize("intent", { idempotencyKey: "test" }, actor)).rejects.toThrow(blocked);
  await expect(service.capture("intent", { idempotencyKey: "test" }, actor)).rejects.toThrow(blocked);
  await expect(service.cancel("intent", { idempotencyKey: "test", reason: "test" }, actor)).rejects.toThrow(blocked);
  await expect(service.applyProviderWebhook("transaction", "SUCCEEDED", {})).rejects.toThrow(blocked);
  await expect(service.reconcile("intent", actor)).rejects.toThrow(blocked);
});
it("blocks direct email/SMS/webhook delivery and retains in-app delivery", async () => {
  const message = { id: "notice", channel: "EMAIL" as const, destination: "https://receiver.example.kz", subject: "test", body: "test" };
  for (const provider of ["email", "sms"]) await expect(new HttpNotificationAdapter("https://sender.example.kz", provider, "token").send(message)).rejects.toThrow(blocked);
  const request = vi.fn();
  await expect(new WebhookNotificationAdapter({ request }).send(message)).rejects.toThrow(blocked);
  expect(request).not.toHaveBeenCalled();
  const registry = new NotificationAdapterRegistry(new OutboundRequestGateway());
  for (const channel of ["EMAIL", "SMS", "WEBHOOK"] as const) expect(() => registry.resolve(channel)).toThrow(blocked);
  expect(registry.capabilities().channels).toEqual(["IN_APP"]);
  await expect(new InAppNotificationAdapter().send({ ...message, channel: "IN_APP" })).resolves.toMatchObject({ provider: "database" });
});
it("does not claim or mutate external queue records in limited mode", async () => {
  const findMany = vi.fn().mockResolvedValue([]);
  const prisma = { notification: { findMany } } as unknown as PrismaService;
  const service = new NotificationsService(prisma, new NotificationAdapterRegistry(new OutboundRequestGateway()), {} as BackgroundQueueService, {} as OutboxHandlerRegistry);
  await service.processPending();
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ channel: "IN_APP" }) }));
});
it("denies signatures without returning fake signed results", async () => {
  const request = { documentId: "doc", checksumSha256: "test", method: "SIMPLE" as const, expiresAt: new Date() };
  for (const adapter of [new ConfiguredSignatureAdapter("https://eds.example.kz", "token"), new MockSignatureAdapter()]) await expect(adapter.createSession(request)).rejects.toThrow(blocked);
  const registry = new SignatureAdapterRegistry();
  for (const method of ["MOCK", "SIMPLE", "EDS", "EGOV_QR", "EXTERNAL"] as const) expect(() => registry.resolve(method)).toThrow(blocked);
  expect(registry.capabilities().methods).toEqual([]);
});
it("blocks auth mail, social verification and common outbound integration calls", async () => {
  await expect(deliverAuthMail({ EMAIL_PROVIDER_URL: "https://mail.example.kz", EMAIL_PROVIDER_TOKEN: "token" } as MarketplaceEnvironment, { to: "test@example.invalid", subject: "test", text: "test" })).rejects.toThrow("Доставка писем не настроена");
  await expect(new OidcVerifierService().verify("GOOGLE", "token")).rejects.toThrow(blocked);
  await expect(new OutboundRequestGateway().request("https://receiver.example.kz")).rejects.toThrow(blocked);
  await expect(new OpenAiResponsesService({} as AiSafetyService).summarize({ role: "test", question: "test", toolName: "test", toolOutput: {} })).resolves.toBeNull();
});
