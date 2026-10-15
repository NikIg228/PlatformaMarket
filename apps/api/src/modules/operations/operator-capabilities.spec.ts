import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deploymentFeatures, isDeploymentApiPathEnabled, operatorCapabilitiesSchema } from "@marketplace/schemas";
import { OperatorDashboardService } from "./operator-dashboard.service";

const config = vi.hoisted(() => ({ DEPLOYMENT_PROFILE: "pilot", OPENAI_API_KEY: undefined as string | undefined, PAYMENT_PROVIDER_MODE: "mock", PAYMENT_GATEWAY_URL: undefined as string | undefined, PAYMENT_GATEWAY_TOKEN: undefined as string | undefined, PAYMENT_WEBHOOK_SECRET_EXTERNAL: undefined as string | undefined }));
vi.mock("../../platform/config/environment", () => ({ environment: () => config }));
beforeEach(() => { Object.assign(config, { DEPLOYMENT_PROFILE: "pilot", OPENAI_API_KEY: undefined, PAYMENT_PROVIDER_MODE: "mock", PAYMENT_GATEWAY_URL: undefined, PAYMENT_GATEWAY_TOKEN: undefined, PAYMENT_WEBHOOK_SECRET_EXTERNAL: undefined }); });
const context = { actorId: "actor", organizationId: "operator" };
function fixture() {
  const prisma = {
    connectorReadiness: { groupBy: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
    paymentProvider: { count: vi.fn().mockResolvedValue(0) },
    complianceRule: { count: vi.fn().mockResolvedValue(0) },
  };
  const authority = { assertPlatformOperator: vi.fn().mockResolvedValue(undefined) };
  const access = { hasAll: vi.fn().mockResolvedValue(true) };
  return { prisma, authority, access, service: new OperatorDashboardService(prisma as never, authority as never, access as never) };
}
function externalConfig() {
  Object.assign(config, { PAYMENT_PROVIDER_MODE: "external", PAYMENT_GATEWAY_URL: "https://private.gateway.test", PAYMENT_GATEWAY_TOKEN: "secret-payment-value", PAYMENT_WEBHOOK_SECRET_EXTERNAL: "secret-webhook-value" });
}

describe("operator capability projection", () => {
  it.each(["pilot", "go_live"] as const)("matches actual API guards and module flags for %s", async profile => {
    config.DEPLOYMENT_PROFILE = profile;
    const { service } = fixture();
    const result = operatorCapabilitiesSchema.parse(await service.capabilities(context));
    const flags = deploymentFeatures(profile);
    for (const [id, flag, path] of [
      ["AI_ASSISTANT", flags.ai, "/ai"], ["TRUST", flags.trust, "/trust"],
      ["PROMOTIONS", flags.promotions, "/promotions"], ["BILLING", flags.billing, "/billing"],
      ["RECOMMENDATIONS", flags.recommendations, "/recommendations"],
    ] as const) {
      expect(isDeploymentApiPathEnabled(profile, path)).toBe(flag);
      expect(result.capabilities.find(item => item.id === id)?.status).toBe(flag ? "AVAILABLE" : "DISABLED_BY_PROFILE");
    }
    expect(result.scope).toBe("PLATFORM_CONFIGURATION");
    expect(result.profile).toBe(profile);
  });
  it("keeps local AI available without a model key and never equates a key with live verification", async () => {
    config.DEPLOYMENT_PROFILE = "go_live";
    const { service } = fixture();
    let result = await service.capabilities(context);
    expect(result.capabilities.find(item => item.id === "AI_ASSISTANT")?.status).toBe("AVAILABLE");
    expect(result.capabilities.find(item => item.id === "AI_MODEL")?.status).toBe("NOT_CONFIGURED");
    config.OPENAI_API_KEY = "secret-model-value";
    result = await service.capabilities(context);
    expect(result.capabilities.find(item => item.id === "AI_MODEL")?.status).toBe("EXTERNAL_CONFIRMATION_REQUIRED");
    expect(JSON.stringify(result)).not.toContain(config.OPENAI_API_KEY);
  });
  it("does not initialize an empty registry or turn absent configuration into availability", async () => {
    const { service, prisma } = fixture();
    const result = await service.capabilities(context);
    expect(result.connectors).toEqual({ status: "AVAILABLE", counts: { total: 0, readinessReady: 0, registeredLiveVerified: 0, externalDependencies: 0, blocked: 0 } });
    expect(result.capabilities.find(item => item.id === "PAYMENT_CONNECTOR")?.status).toBe("NOT_CONFIGURED");
    expect(prisma.connectorReadiness.upsert).not.toHaveBeenCalled();
  });
  it("separates READY readiness from INTERNAL_READY, registry live claims and blocking conditions", async () => {
    const { service, prisma } = fixture();
    prisma.connectorReadiness.groupBy.mockResolvedValue([
      { readinessStatus: "READY", goLiveStatus: "INTERNAL_READY", _count: { _all: 2 } },
      { readinessStatus: "READY", goLiveStatus: "LIVE_VERIFIED", _count: { _all: 1 } },
      { readinessStatus: "PARTIAL", goLiveStatus: "INTERNAL_READY", _count: { _all: 1 } },
      { readinessStatus: "PARTIAL", goLiveStatus: "CONNECTOR_NEEDED", _count: { _all: 3 } },
      { readinessStatus: "BLOCKED", goLiveStatus: "BLOCKED", _count: { _all: 1 } },
    ]);
    expect((await service.capabilities(context)).connectors).toEqual({ status: "AVAILABLE", counts: { total: 8, readinessReady: 3, registeredLiveVerified: 1, externalDependencies: 3, blocked: 1 } });
    expect(prisma.connectorReadiness.groupBy).toHaveBeenCalledWith({ by: ["readinessStatus", "goLiveStatus"], _count: { _all: true } });
  });
  it("does not let a mock provider or missing webhook config imply external payment readiness", async () => {
    const { service, prisma } = fixture();
    externalConfig();
    prisma.paymentProvider.count.mockImplementation(async (query: { where: { code?: unknown } }) => query.where.code ? 0 : 1);
    expect((await service.capabilities(context)).capabilities.find(item => item.id === "PAYMENT_CONNECTOR")).toMatchObject({ status: "NOT_CONFIGURED", reason: "EXTERNAL_PROVIDER_MISSING" });
    prisma.paymentProvider.count.mockResolvedValue(1);
    config.PAYMENT_WEBHOOK_SECRET_EXTERNAL = undefined;
    expect((await service.capabilities(context)).capabilities.find(item => item.id === "PAYMENT_CONNECTOR")?.reason).toBe("EXTERNAL_CONFIG_MISSING");
  });
  it("reports configured external payments as unverified and reveals no gateway configuration", async () => {
    const { service, prisma } = fixture();
    externalConfig(); prisma.paymentProvider.count.mockResolvedValue(1);
    const result = await service.capabilities(context);
    expect(result.capabilities.find(item => item.id === "PAYMENT_CONNECTOR")?.status).toBe("EXTERNAL_CONFIRMATION_REQUIRED");
    expect(JSON.stringify(result)).not.toMatch(/private\.gateway|secret-|PAYMENT_GATEWAY|https:/);
    expect(prisma.paymentProvider.count).toHaveBeenCalledWith({ where: { status: "ACTIVE", code: { not: "MOCK" } } });
  });
  it("isolates registry failures from module flags and preserves unknown rather than zero", async () => {
    const { service, prisma } = fixture();
    externalConfig();
    prisma.connectorReadiness.groupBy.mockRejectedValue(new Error("private database address"));
    prisma.paymentProvider.count.mockRejectedValue(new Error("provider secret"));
    const result = await service.capabilities(context);
    expect(result.connectors).toEqual({ status: "UNAVAILABLE", counts: null, reason: "SOURCE_UNAVAILABLE" });
    expect(result.activePaymentProviders.value).toBeNull();
    expect(result.activeComplianceRules.value).toBe(0);
    expect(result.capabilities.find(item => item.id === "PAYMENT_CONNECTOR")?.status).toBe("UNAVAILABLE");
    expect(result.capabilities.find(item => item.id === "TRUST")?.status).toBe("DISABLED_BY_PROFILE");
    expect(JSON.stringify(result)).not.toMatch(/private|secret/);
  });
  it("authorizes before registry/configuration projection, including direct service use", async () => {
    for (const denied of ["authority", "permission"]) {
      const { service, prisma, authority, access } = fixture();
      if (denied === "authority") authority.assertPlatformOperator.mockRejectedValue(new ForbiddenException());
      else access.hasAll.mockResolvedValue(false);
      await expect(service.capabilities(context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.connectorReadiness.groupBy).not.toHaveBeenCalled();
      expect(prisma.paymentProvider.count).not.toHaveBeenCalled();
      expect(prisma.complianceRule.count).not.toHaveBeenCalled();
    }
  });
});
