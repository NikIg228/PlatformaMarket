import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import type { BackgroundQueueService } from "../../platform/jobs/background-queue.service";
import type { OutboxHandlerRegistry } from "../../platform/outbox/outbox-handler.registry";
import { OutboundRequestGateway } from "../../platform/security/outbound-request.gateway";
import { NotificationAdapterRegistry } from "./notification-adapter-registry.service";
import { NotificationsService } from "./notifications.service";

afterEach(() => vi.unstubAllEnvs());

function service(prisma: unknown, registry = new NotificationAdapterRegistry(new OutboundRequestGateway())) {
  return new NotificationsService(prisma as PrismaService, registry, {} as BackgroundQueueService, {} as OutboxHandlerRegistry);
}

describe("notification projection and delivery", () => {
  it("rejects a tenant manager from processing the global delivery queue", async () => {
    const findMany = vi.fn();
    const prisma = { organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) }, notification: { findMany } };
    await expect(service(prisma).processForOperator({ actorId: "manager", organizationId: "tenant" })).rejects.toThrow("Only operators");
    expect(findMany).not.toHaveBeenCalled();
  });
  it("honors event-specific opt-out instead of falling back to in-app", async () => {
    const createMany = vi.fn();
    const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({ id: "org" }) }, notificationPreference: { findMany: vi.fn().mockResolvedValue([{ userId: null, channel: "IN_APP", eventType: "*", enabled: true }, { userId: null, channel: "IN_APP", eventType: "OrderReceived", enabled: false }]) }, notification: { createMany } };
    await expect(service(prisma).projectOutboxEvent({ id: "event", aggregateType: "SupplierOrder", aggregateId: "order", eventType: "OrderReceived", payload: { organizationId: "org" } })).resolves.toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });

  it("does not allow another employee to mark a personal notification read", async () => {
    const update = vi.fn();
    const prisma = { notification: { findUnique: vi.fn().mockResolvedValue({ id: "personal", recipientOrganizationId: "org", recipientUserId: "recipient" }), update } };
    await expect(service(prisma).markRead("personal", { actorId: "other", organizationId: "org" })).rejects.toThrow("not found");
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps delivery attempt numbering when an exhausted notification is retried", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const notification = { id: "failed", status: "DEAD", attempts: 5, maxAttempts: 5, recipientOrganizationId: "org" };
    const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({ id: "org" }) }, notification: { findUnique: vi.fn().mockResolvedValue(notification), findUniqueOrThrow: vi.fn().mockResolvedValue({ ...notification, status: "PENDING", maxAttempts: 10 }), updateMany }, auditLog: { create: vi.fn() } };
    Object.assign(prisma, { $transaction: (callback: (tx: typeof prisma) => unknown) => callback(prisma) });
    await service(prisma).retry("failed", { actorId: "actor", organizationId: "org" });
    const data = updateMany.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "PENDING", maxAttempts: 10 });
    expect(data).not.toHaveProperty("attempts");
  });
  it("projects lowercase organizationId once per recipient with a stable event key", async () => {
    const upsert = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { organization: { findUnique: vi.fn().mockResolvedValue({ id: "org" }) }, notificationPreference: { findMany: vi.fn().mockResolvedValue([]) }, notification: { createMany: upsert } };
    const event = { id: "event", aggregateType: "SupplierOrder", aggregateId: "order", eventType: "OrderReceived", payload: { organizationId: "buyer", buyerOrganizationId: "buyer", supplierOrganizationId: "supplier" } };
    await service(prisma).projectOutboxEvent(event);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls.map(([arg]) => arg.data.idempotencyKey)).toEqual(["outbox:event:buyer:org:IN_APP", "outbox:event:supplier:org:IN_APP"]);
    await service(prisma).projectOutboxEvent(event);
    expect(upsert.mock.calls[2][0]).toEqual(upsert.mock.calls[0][0]);
  });

  it("records missing adapter failure and continues delivering in-app messages", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("EMAIL_PROVIDER_URL", "");
    const update = vi.fn().mockResolvedValue({});
    const attempt = vi.fn().mockResolvedValue({});
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([
          { id: "email", channel: "EMAIL", status: "PENDING", attempts: 0, maxAttempts: 5, subject: "Test", body: "Test" },
          { id: "in-app", channel: "IN_APP", status: "PENDING", attempts: 0, maxAttempts: 5, subject: "Test", body: "Test" },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }), update,
      },
      notificationDeliveryAttempt: { create: attempt },
      $transaction: (items: Promise<unknown>[]) => Promise.all(items),
    };
    await expect(service(prisma).processPending()).resolves.toEqual({ processed: 2, sent: 1, failed: 1 });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "email" }, data: expect.objectContaining({ status: "FAILED", lastError: "EMAIL provider is not configured" }) }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "in-app" }, data: expect.objectContaining({ status: "SENT" }) }));
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it.each(["development", "test", "production"])("never reports unconfigured external delivery as success in %s", (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    vi.stubEnv("EMAIL_PROVIDER_URL", "");
    vi.stubEnv("SMS_PROVIDER_URL", "");
    const registry = new NotificationAdapterRegistry(new OutboundRequestGateway());
    expect(() => registry.resolve("EMAIL")).toThrow("provider is not configured");
    expect(() => registry.resolve("SMS")).toThrow("provider is not configured");
    expect(registry.resolve("IN_APP")).toBeDefined();
  });
});
