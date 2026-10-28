import { ConflictException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthSessionsController } from "./auth-sessions.controller";
import { AuthSessionsService } from "./auth-sessions.service";
import { identityContextMiddleware } from "../../platform/security/identity-context.middleware";

vi.mock("../../platform/config/environment", () => ({
  environment: () => ({ AUTH_MODE: "jwt" }),
}));

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
type Provider = "GOOGLE" | "APPLE";

function fixture() {
  const identities = [
    { id: "owner-google", userId: owner, provider: "GOOGLE" },
    { id: "owner-apple", userId: owner, provider: "APPLE" },
    { id: "other-google", userId: other, provider: "GOOGLE" },
    { id: "other-apple", userId: other, provider: "APPLE" },
  ];
  const sessions = [
    { id: "owner-google-active", userId: owner, authMethods: ["google"], status: "ACTIVE" },
    { id: "owner-apple-active", userId: owner, authMethods: ["apple"], status: "ACTIVE" },
    { id: "owner-google-revoked", userId: owner, authMethods: ["google"], status: "REVOKED" },
    { id: "other-google-active", userId: other, authMethods: ["google"], status: "ACTIVE" },
    { id: "other-apple-active", userId: other, authMethods: ["apple"], status: "ACTIVE" },
  ];
  const audits: unknown[] = [];
  // Model Prisma's omission of undefined filters without connecting to a database.
  const prisma = {
    externalIdentity: {
      findMany: vi.fn(async ({ where }: { where: { userId?: string } }) =>
        identities.filter((identity) => where.userId === undefined || identity.userId === where.userId)),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const index = identities.findIndex((identity) => identity.id === where.id);
        return identities.splice(index, 1)[0];
      }),
    },
    authSession: {
      updateMany: vi.fn(async ({ where, data }: {
        where: { userId?: string; authMethods: { has: string }; status: string };
        data: { status: string; revokedAt: Date; revokeReason: string };
      }) => {
        const matches = sessions.filter((session) =>
          (where.userId === undefined || session.userId === where.userId) &&
          session.authMethods.includes(where.authMethods.has) && session.status === where.status);
        matches.forEach((session) => Object.assign(session, data));
        return { count: matches.length };
      }),
    },
    auditLog: { create: vi.fn(async ({ data }: { data: unknown }) => { audits.push(data); return data; }) },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const service = new AuthSessionsService(prisma as never, {} as never, {} as never, {} as never);
  const controller = new AuthSessionsController(service);
  const snapshot = () => JSON.stringify({ identities, sessions, audits });
  const expectNoDataAccess = () => {
    expect(prisma.externalIdentity.findMany).not.toHaveBeenCalled();
    expectNoWrites();
  };
  const expectNoWrites = () => {
    expect(prisma.externalIdentity.delete).not.toHaveBeenCalled();
    expect(prisma.authSession.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  };
  return { identities, sessions, audits, prisma, service, controller, snapshot, expectNoDataAccess, expectNoWrites };
}

describe("social identity unlink authorization", () => {
  it.each([undefined, null, "", "   ", [], {}])("rejects an absent or invalid actor (%j) before data access", async (actor) => {
    const f = fixture();
    const before = f.snapshot();
    await expect(f.service.unlink(actor as string, "GOOGLE")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.snapshot()).toBe(before);
    f.expectNoDataAccess();
  });

  it.each<Provider>(["GOOGLE", "APPLE"])("rejects anonymous %s unlink after middleware strips a forged actor", async (provider) => {
    const f = fixture();
    const before = f.snapshot();
    const headers: Record<string, string> = { "x-user-id": owner, "x-organization-id": "forged-organization" };
    const request = { headers, method: "DELETE", originalUrl: "/api/auth/identities", header: (name: string) => headers[name] };
    const next = vi.fn();
    identityContextMiddleware()(request as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
    expect(headers["x-user-id"]).toBeUndefined();
    await expect(f.controller.unlink(headers["x-user-id"], { provider })).rejects.toMatchObject({ status: 401 });
    expect(f.snapshot()).toBe(before);
    f.expectNoDataAccess();
  });

  it.each<Provider>(["GOOGLE", "APPLE"])("preserves authenticated %s unlink and limits its effects to that owner/provider", async (provider) => {
    const f = fixture();
    const untouchedIdentities = f.identities.filter((identity) => identity.userId === other);
    const untouchedSessions = f.sessions.filter((session) => session.userId === other || session.authMethods[0] !== provider.toLowerCase() || session.status !== "ACTIVE");
    const beforeUntouched = JSON.stringify(untouchedSessions);
    await expect(f.controller.unlink(owner, { provider })).resolves.toEqual({ unlinked: true, provider });
    expect(f.identities.filter((identity) => identity.userId === other)).toEqual(untouchedIdentities);
    expect(f.identities.filter((identity) => identity.userId === owner)).toHaveLength(1);
    expect(f.identities.some((identity) => identity.userId === owner && identity.provider === provider)).toBe(false);
    expect(JSON.stringify(untouchedSessions)).toBe(beforeUntouched);
    expect(f.sessions.find((session) => session.id === `owner-${provider.toLowerCase()}-active`)).toMatchObject({ status: "REVOKED", revokeReason: "identity_unlinked", revokedAt: expect.any(Date) });
    expect(f.prisma.externalIdentity.findMany).toHaveBeenCalledWith({ where: { userId: owner } });
    expect(f.prisma.authSession.updateMany).toHaveBeenCalledWith({ where: { userId: owner, authMethods: { has: provider.toLowerCase() }, status: "ACTIVE" }, data: expect.any(Object) });
    expect(f.audits).toEqual([{ actorId: owner, action: "identity.social.unlinked", entityType: "ExternalIdentity", entityId: `owner-${provider.toLowerCase()}`, before: { provider } }]);
    expect(f.prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("preserves the refusal to unlink the owner's last sign-in method despite other users' identities", async () => {
    const f = fixture();
    f.identities.splice(1, 1);
    const before = f.snapshot();
    await expect(f.controller.unlink(owner, { provider: "GOOGLE" })).rejects.toBeInstanceOf(ConflictException);
    expect(f.snapshot()).toBe(before);
    f.expectNoWrites();
  });

  it("preserves not-found behavior without unlinking another owner's provider", async () => {
    const f = fixture();
    f.identities[1].provider = "GOOGLE";
    const before = f.snapshot();
    await expect(f.controller.unlink(owner, { provider: "APPLE" })).rejects.toBeInstanceOf(NotFoundException);
    expect(f.snapshot()).toBe(before);
    f.expectNoWrites();
  });

  it("keeps provider validation before data access", () => {
    const f = fixture();
    expect(() => f.controller.unlink(owner, { provider: "google" })).toThrow();
    f.expectNoDataAccess();
  });
});
