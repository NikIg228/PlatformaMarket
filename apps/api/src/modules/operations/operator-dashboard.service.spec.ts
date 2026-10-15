import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { operatorDashboardSchema } from "@marketplace/schemas";
import { PlatformAuthorityPolicy } from "../access-control/platform-authority.policy";
import { OperatorDashboardService } from "./operator-dashboard.service";

const context = { actorId: "operator-user", organizationId: "operator-organization" };
function fixture() {
  const prisma = { organization: { count: vi.fn().mockResolvedValue(153) }, product: { count: vi.fn().mockResolvedValue(12001) } };
  const authority = { assertPlatformOperator: vi.fn().mockResolvedValue(undefined) };
  const access = { hasAll: vi.fn().mockResolvedValue(true), permissionsFor: vi.fn().mockResolvedValue(["organization.view", "catalog.product.view", "organization.view"]) };
  return { prisma, authority, access, service: new OperatorDashboardService(prisma as never, authority as never, access as never) };
}

describe("operator dashboard totals", () => {
  it("counts the entire population and unique current permissions, with explicit scope/time", async () => {
    const { service, prisma, authority, access } = fixture();
    const result = operatorDashboardSchema.parse(await service.dashboard(context));
    expect(result).toMatchObject({ scope: "PLATFORM_CURRENT_ALL_STATUSES", organizations: { status: "AVAILABLE", value: 153 }, masterProducts: { status: "AVAILABLE", value: 12001 }, effectivePermissions: { status: "AVAILABLE", value: 2 } });
    expect(Number.isNaN(Date.parse(result.observedAt))).toBe(false);
    expect(prisma.organization.count).toHaveBeenCalledWith();
    expect(prisma.product.count).toHaveBeenCalledWith();
    expect(authority.assertPlatformOperator).toHaveBeenCalledWith(context);
    expect(access.permissionsFor).toHaveBeenCalledWith(context.actorId, context.organizationId);
    expect(access.hasAll.mock.invocationCallOrder[0]).toBeLessThan(prisma.product.count.mock.invocationCallOrder[0]);
  });
  it("retains real zeros and independent successful sources on a source error", async () => {
    const { service, prisma } = fixture();
    prisma.organization.count.mockResolvedValue(0);
    prisma.product.count.mockRejectedValue(new Error("postgres://private-source secret-token"));
    const result = await service.dashboard(context);
    expect(result.organizations).toEqual({ status: "AVAILABLE", value: 0 });
    expect(result.masterProducts).toEqual({ status: "UNAVAILABLE", value: null, reason: "SOURCE_UNAVAILABLE" });
    expect(result.effectivePermissions).toEqual({ status: "AVAILABLE", value: 2 });
    expect(JSON.stringify(result)).not.toMatch(/postgres|secret-token/);
    prisma.product.count.mockResolvedValue(102);
    expect((await service.dashboard(context)).masterProducts).toEqual({ status: "AVAILABLE", value: 102 });
  });
  it("does not turn missing operator authority or permission into partial global data", async () => {
    for (const denial of ["authority", "permission"] as const) {
      const { service, prisma, authority, access } = fixture();
      if (denial === "authority") authority.assertPlatformOperator.mockRejectedValue(new ForbiddenException());
      else access.hasAll.mockResolvedValue(false);
      await expect(service.dashboard(context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.organization.count).not.toHaveBeenCalled();
      expect(prisma.product.count).not.toHaveBeenCalled();
      expect(access.permissionsFor).not.toHaveBeenCalled();
    }
  });
  it.each([new ForbiddenException(), new UnauthorizedException()])("propagates an auth failure rather than serializing unavailable", async failure => {
    const { service, access } = fixture();
    access.permissionsFor.mockRejectedValue(failure);
    await expect(service.dashboard(context)).rejects.toBe(failure);
  });
  it("keeps revoked, foreign-organization and non-operator membership outside global totals", async () => {
    for (const membership of [null, { organization: { capabilities: [{ capability: "SUPPLIER" }] }, roles: [] }]) {
      const { prisma, access } = fixture();
      const membershipRead = vi.fn().mockResolvedValue(membership);
      const policy = new PlatformAuthorityPolicy({ organizationMembership: { findFirst: membershipRead } } as never);
      const service = new OperatorDashboardService(prisma as never, policy, access as never);
      await expect(service.dashboard(context)).rejects.toBeInstanceOf(ForbiddenException);
      expect(membershipRead).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: context.actorId, organizationId: context.organizationId, status: "ACTIVE", user: { status: "ACTIVE" }, organization: { status: "ACTIVE" } }) }));
      expect(prisma.product.count).not.toHaveBeenCalled();
      expect(prisma.organization.count).not.toHaveBeenCalled();
    }
  });
});
