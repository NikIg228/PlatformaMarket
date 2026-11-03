import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { AuthSessionsService } from "./auth-sessions.service";

vi.mock("../../platform/config/environment", () => ({ environment: () => ({ JWT_SECRET: "test-session-switch-secret-at-least-32-characters", AUTH_ACCESS_TOKEN_TTL_SECONDS: 600 }) }));

describe("session organization authorization", () => {
  const session = { id: "session", userId: "owner", organizationIds: ["first", "second"], activeOrganizationId: "first", authMethods: ["password"] };
  const prisma = {
    authSession: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    organizationMembership: { findFirst: vi.fn() },
  };
  const service = new AuthSessionsService(prisma as never, {} as never, {} as never, {} as never);
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.authSession.findFirst.mockResolvedValue(session);
    prisma.organizationMembership.findFirst.mockResolvedValue({ userId: "owner", organizationId: "second" });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.authSession.update.mockResolvedValue({ ...session, activeOrganizationId: "second" });
  });

  it.each([undefined, null, "", "   "])("rejects missing actor %s before reading or mutating data", async actor => {
    await expect(service.switchOrganization("session", actor as never, "second")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.authSession.findFirst).not.toHaveBeenCalled();
    expect(prisma.organizationMembership.findFirst).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(prisma.authSession.update).not.toHaveBeenCalled();
  });

  it("scopes the session to the authenticated owner and active lifetime", async () => {
    prisma.authSession.findFirst.mockResolvedValue(null);
    await expect(service.switchOrganization("foreign-session", "owner", "second")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.authSession.findFirst).toHaveBeenCalledWith({ where: { id: "foreign-session", userId: "owner", status: "ACTIVE", expiresAt: { gt: expect.any(Date) } } });
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an unavailable membership before writing", async () => {
    prisma.organizationMembership.findFirst.mockResolvedValue(null);
    await expect(service.switchOrganization("session", "owner", "second")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
  });

  it("cannot update a session revoked between read and write", async () => {
    prisma.authSession.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.switchOrganization("session", "owner", "second")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("preserves the owner, allowed organizations and session in the new token", async () => {
    const result = await service.switchOrganization("session", "owner", "second");
    expect(result.activeOrganizationId).toBe("second");
    expect(jwt.decode(result.accessToken)).toMatchObject({ sub: "owner", jti: "session", organization_id: "second", organization_ids: ["first", "second"], amr: ["password"] });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({ where: { id: "session", userId: "owner", status: "ACTIVE", expiresAt: { gt: expect.any(Date) } }, data: { activeOrganizationId: "second", lastUsedAt: expect.any(Date) } });
  });
});
