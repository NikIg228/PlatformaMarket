import { afterEach, describe, expect, it, vi } from "vitest";
import { BillingService } from "./billing.service";
import { PlatformAuthorityPolicy } from "../access-control/platform-authority.policy";

const context = { actorId: "member", organizationId: "tenant" };
function fixture(operator = false) {
  const db = {
    organizationMembership: { findFirst: vi.fn().mockResolvedValue({ organization: { capabilities: [{ capability: operator ? "MARKETPLACE_OPERATOR" : "SUPPLIER" }] }, roles: [] }) },
    billingPlan: { create: vi.fn().mockResolvedValue({ id: "plan", monthlyPriceMinor: 100n }), findFirst: vi.fn().mockResolvedValue({ id: "plan", trialDays: 0 }) },
    planEntitlement: { createMany: vi.fn() },
    organizationSubscription: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "subscription" }) },
    featureFlag: { findUnique: vi.fn().mockResolvedValue({ key: "ai.assistant" }) },
    organizationFeature: { upsert: vi.fn().mockResolvedValue({ id: "override" }) },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(work => work(db));
  const authority = new PlatformAuthorityPolicy(db as never);
  return { db, service: new BillingService(db as never, {} as never, authority) };
}
const plan = { code: "fixture", name: "Fixture", monthlyPriceMinor: 100, currency: "KZT", trialDays: 0, graceDays: 0, entitlements: [] };
afterEach(() => vi.unstubAllEnvs());
describe("billing platform authority", () => {
  it.each(["FULL_ACCESS", "ROLE_BASED"])("denies all platform writes by ordinary members in %s", async mode => {
    vi.stubEnv("ACCESS_CONTROL_MODE", mode);
    const { db, service } = fixture();
    await expect(service.createPlan(plan, context)).rejects.toMatchObject({ status: 403 });
    await expect(service.subscribe({ organizationId: "victim", planId: "plan" }, context)).rejects.toMatchObject({ status: 403 });
    await expect(service.setFeature("victim", "ai.assistant", { enabled: true }, context)).rejects.toMatchObject({ status: 403 });
    expect(db.billingPlan.findFirst).not.toHaveBeenCalled(); expect(db.billingPlan.create).not.toHaveBeenCalled();
    expect(db.organizationFeature.upsert).not.toHaveBeenCalled(); expect(db.organizationSubscription.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it("rejects missing actor before any query", async () => {
    const { db, service } = fixture(true);
    await expect(service.setFeature("victim", "ai.assistant", { enabled: true }, { actorId: "", organizationId: "" })).rejects.toMatchObject({ status: 403 });
    expect(db.organizationMembership.findFirst).not.toHaveBeenCalled();
  });
  it("preserves operator plan, subscription and feature writes", async () => {
    const { db, service } = fixture(true);
    await expect(service.createPlan(plan, context)).resolves.toMatchObject({ id: "plan" });
    await expect(service.subscribe({ organizationId: "victim", planId: "plan" }, context)).resolves.toMatchObject({ id: "subscription" });
    await expect(service.setFeature("victim", "ai.assistant", { enabled: true }, context)).resolves.toMatchObject({ id: "override" });
    expect(db.organizationFeature.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId_featureKey: { organizationId: "victim", featureKey: "ai.assistant" } } }));
    expect(db.auditLog.create).toHaveBeenCalledTimes(3);
  });
});
