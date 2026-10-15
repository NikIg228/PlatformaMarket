import { ForbiddenException, HttpException, Injectable } from "@nestjs/common";
import { deploymentFeatures, type OperatorCount, type OperatorDashboard, type OperatorCapabilities, type OperatorCapability, type OperatorConnectorSummary } from "@marketplace/schemas";
import { environment } from "../../platform/config/environment";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PlatformAuthorityPolicy, type AuthorityActorContext } from "../access-control/platform-authority.policy";

@Injectable()
export class OperatorDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authority: PlatformAuthorityPolicy,
    private readonly access: AccessControlService,
  ) {}

  private async authorize(context: AuthorityActorContext) {
    await this.authority.assertPlatformOperator(context);
    if (!await this.access.hasAll(context.actorId, context.organizationId, ["organization.view"])) {
      throw new ForbiddenException("Insufficient permissions");
    }
  }

  private async count(read: () => Promise<number>): Promise<OperatorCount> {
    try { return { status: "AVAILABLE", value: await read() }; }
    catch (cause) {
      // An authorization failure must never become an ordinary missing metric.
      if (cause instanceof HttpException && [401, 403].includes(cause.getStatus())) throw cause;
      return { status: "UNAVAILABLE", value: null, reason: "SOURCE_UNAVAILABLE" };
    }
  }

  async dashboard(context: AuthorityActorContext): Promise<OperatorDashboard> {
    await this.authorize(context);
    const [organizations, masterProducts, effectivePermissions] = await Promise.all([
      this.count(() => this.prisma.organization.count()),
      this.count(() => this.prisma.product.count()),
      this.count(async () => new Set(await this.access.permissionsFor(context.actorId, context.organizationId)).size),
    ]);
    return { observedAt: new Date().toISOString(), scope: "PLATFORM_CURRENT_ALL_STATUSES", organizations, masterProducts, effectivePermissions };
  }

  private async connectorSummary(): Promise<OperatorConnectorSummary> {
    try {
      // One aggregate query gives coherent registry counts without initializing it.
      const groups = await this.prisma.connectorReadiness.groupBy({
        by: ["readinessStatus", "goLiveStatus"], _count: { _all: true },
      });
      const counts = { total: 0, readinessReady: 0, registeredLiveVerified: 0, externalDependencies: 0, blocked: 0 };
      for (const group of groups) {
        const value = group._count._all;
        counts.total += value;
        if (group.readinessStatus === "READY") counts.readinessReady += value;
        if (group.goLiveStatus === "LIVE_VERIFIED") counts.registeredLiveVerified += value;
        if (group.goLiveStatus === "CONNECTOR_NEEDED") counts.externalDependencies += value;
        if (group.readinessStatus === "BLOCKED" || group.goLiveStatus === "BLOCKED") counts.blocked += value;
      }
      return { status: "AVAILABLE", counts };
    } catch (cause) {
      if (cause instanceof HttpException && [401, 403].includes(cause.getStatus())) throw cause;
      return { status: "UNAVAILABLE", counts: null, reason: "SOURCE_UNAVAILABLE" };
    }
  }

  async capabilities(context: AuthorityActorContext): Promise<OperatorCapabilities> {
    await this.authorize(context);
    const config = environment();
    const features = deploymentFeatures(config.DEPLOYMENT_PROFILE);
    const [connectors, activePaymentProviders, externalProviders, activeComplianceRules] = await Promise.all([
      this.connectorSummary(),
      this.count(() => this.prisma.paymentProvider.count({ where: { status: "ACTIVE" } })),
      this.count(() => this.prisma.paymentProvider.count({ where: { status: "ACTIVE", code: { not: "MOCK" } } })),
      this.count(() => this.prisma.complianceRule.count({ where: { status: "ACTIVE" } })),
    ]);
    const module = (id: OperatorCapability["id"], enabled: boolean, section: OperatorCapability["section"]): OperatorCapability => ({
      id, status: enabled ? "AVAILABLE" : "DISABLED_BY_PROFILE", reason: enabled ? "PROFILE_ENABLED" : "PROFILE_DISABLED", section,
    });
    const model: OperatorCapability = !features.ai
      ? module("AI_MODEL", false, null)
      : { id: "AI_MODEL", section: null, status: config.OPENAI_API_KEY ? "EXTERNAL_CONFIRMATION_REQUIRED" : "NOT_CONFIGURED", reason: config.OPENAI_API_KEY ? "EXTERNAL_VERIFICATION_MISSING" : "EXTERNAL_CONFIG_MISSING" };
    const payment: OperatorCapability = { id: "PAYMENT_CONNECTOR", section: "orders", status: "NOT_CONFIGURED", reason: "EXTERNAL_CONFIG_MISSING" };
    if (config.PAYMENT_PROVIDER_MODE === "external" && config.PAYMENT_GATEWAY_URL && config.PAYMENT_GATEWAY_TOKEN && config.PAYMENT_WEBHOOK_SECRET_EXTERNAL) {
      if (externalProviders.status === "UNAVAILABLE") { payment.status = "UNAVAILABLE"; payment.reason = "SOURCE_UNAVAILABLE"; }
      else if (externalProviders.value === 0) payment.reason = "EXTERNAL_PROVIDER_MISSING";
      else { payment.status = "EXTERNAL_CONFIRMATION_REQUIRED"; payment.reason = "EXTERNAL_VERIFICATION_MISSING"; }
    }
    return {
      observedAt: new Date().toISOString(), scope: "PLATFORM_CONFIGURATION", profile: config.DEPLOYMENT_PROFILE,
      capabilities: [module("AI_ASSISTANT", features.ai, null), module("TRUST", features.trust, "security"), module("PROMOTIONS", features.promotions, "catalog"), module("BILLING", features.billing, null), module("RECOMMENDATIONS", features.recommendations, null), model, payment],
      connectors, activePaymentProviders, activeComplianceRules,
    };
  }
}
