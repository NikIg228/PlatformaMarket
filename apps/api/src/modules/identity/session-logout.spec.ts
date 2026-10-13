import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { AuthSession } from "@prisma/client";
import { logoutTargetSession } from "./session-logout";
import { AuthSessionsController } from "./auth-sessions.controller";

const config = vi.hoisted(() => ({ JWT_SECRET: "synthetic-logout-key-at-least-thirty-two-characters", JWT_ISSUER: "dentmarket-kz", JWT_AUDIENCE: "dentmarket-web" }));
vi.mock("../../platform/config/environment", () => ({ environment: () => config }));
const user = "30000000-0000-4000-8000-000000000001";
const targetId = "10000000-0000-4000-8000-000000000001";
const rootId = "10000000-0000-4000-8000-000000000002";
const otherId = "10000000-0000-4000-8000-000000000003";
const row = (id: string, originLoginSessionId: string | null = rootId): AuthSession => ({
  id, userId: user, originLoginSessionId, familyId: id, refreshTokenHash: id, previousTokenHash: null,
  status: "ACTIVE", organizationIds: [], activeOrganizationId: null, authMethods: ["password"], userAgent: null, ipAddress: null,
  expiresAt: new Date(Date.now() + 3600_000), createdAt: new Date(), updatedAt: new Date(), lastUsedAt: null, revokedAt: null, revokeReason: null,
});
function token(options: jwt.SignOptions = {}, payload: Record<string, unknown> = {}) {
  return jwt.sign(payload, config.JWT_SECRET, { algorithm: "HS256", issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE, subject: user, jwtid: targetId, expiresIn: 600, ...options });
}
function request(accessToken = token()) { return { sessionId: targetId, accessToken }; }
let records: Map<string, AuthSession>;
let db: any;
beforeEach(() => {
  records = new Map([row(targetId), row(rootId), row(otherId, otherId)].map(session => [session.id, session]));
  db = { $queryRaw: vi.fn().mockResolvedValue([]),
    authSession: {
      findUnique: vi.fn(async ({ where }) => records.get(where.id) ? { ...records.get(where.id) } : null),
      updateMany: vi.fn(async ({ where, data }) => { const existing = records.get(where.id); if (!existing || existing.status !== where.status) return { count: 0 }; Object.assign(existing, data); return { count: 1 }; }),
    }, securityEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  db.$transaction = vi.fn(async callback => callback(db));
});

describe("self session logout proof and receipt", () => {
  it("revokes only the selected target and persisted origin, leaving a new login of the same user active", async () => {
    expect(await logoutTargetSession(db, request())).toEqual({ sessionId: targetId, status: "REVOKED", loginStatus: "REVOKED" });
    expect(records.get(otherId)?.status).toBe("ACTIVE");
    expect(records.get(rootId)?.status).toBe("REVOKED");
    expect(db.authSession.updateMany).toHaveBeenCalledTimes(2);
    expect(db.securityEvent.create).toHaveBeenCalledTimes(2);
  });
  it("returns a stable receipt after a lost response without rewriting timestamps or duplicating audit", async () => {
    const first = await logoutTargetSession(db, request());
    const revokedAt = records.get(targetId)?.revokedAt;
    const expired = token({}, { iat: Math.floor(Date.now() / 1000) - 1200 });
    expect(await logoutTargetSession(db, request(expired))).toEqual(first);
    expect(records.get(targetId)?.revokedAt).toBe(revokedAt);
    expect(db.authSession.updateMany).toHaveBeenCalledTimes(2);
    expect(db.securityEvent.create).toHaveBeenCalledTimes(2);
  });
  it("does not revoke active rows with an expired proof, including a still-active linked login", async () => {
    const expired = token({}, { iat: Math.floor(Date.now() / 1000) - 1200 });
    await expect(logoutTargetSession(db, request(expired))).rejects.toMatchObject({ response: { code: "SESSION_LOGOUT_PROOF_EXPIRED" } });
    records.get(targetId)!.status = "REVOKED";
    await expect(logoutTargetSession(db, request(expired))).rejects.toMatchObject({ response: { code: "SESSION_LOGOUT_PROOF_EXPIRED" } });
    expect(db.authSession.updateMany).not.toHaveBeenCalled();
  });
  it("confirms expired rows without writing them", async () => {
    for (const id of [targetId, rootId]) records.get(id)!.expiresAt = new Date(0);
    expect(await logoutTargetSession(db, request())).toEqual({ sessionId: targetId, status: "EXPIRED", loginStatus: "EXPIRED" });
    expect(db.authSession.updateMany).not.toHaveBeenCalled();
  });
  it("does not infer the parent for legacy sessions", async () => {
    records.get(targetId)!.originLoginSessionId = null;
    expect(await logoutTargetSession(db, request())).toMatchObject({ loginStatus: "NOT_LINKED" });
    expect(records.get(rootId)?.status).toBe("ACTIVE");
    expect(db.authSession.updateMany).toHaveBeenCalledTimes(1);
  });
  it("handles a root session without duplicate writes", async () => {
    records.get(targetId)!.originLoginSessionId = targetId;
    expect(await logoutTargetSession(db, request())).toMatchObject({ loginStatus: "SAME_SESSION" });
    expect(db.authSession.updateMany).toHaveBeenCalledTimes(1);
  });
  it.each([
    { issuer: "foreign" }, { audience: "foreign" }, { subject: "foreign" }, { jwtid: otherId }, { algorithm: "HS384" as const },
  ])("rejects invalid authority or token claims %j", async options => {
    await expect(logoutTargetSession(db, request(token(options)))).rejects.toMatchObject({ status: 401 });
    expect(db.authSession.updateMany).not.toHaveBeenCalled();
  });
  it("rejects an unsigned token, absent expiry, future issue time and a missing target", async () => {
    const values = [jwt.sign({}, "", { algorithm: "none" }), jwt.sign({ sub: user, jti: targetId }, config.JWT_SECRET), token({}, { iat: Math.floor(Date.now() / 1000) + 600 })];
    for (const value of values) await expect(logoutTargetSession(db, request(value))).rejects.toMatchObject({ status: 401 });
    records.delete(targetId);
    await expect(logoutTargetSession(db, request())).rejects.toMatchObject({ status: 401 });
    expect(db.authSession.updateMany).not.toHaveBeenCalled();
  });
  it("rejects a foreign or non-root parent rather than widening revoke authority", async () => {
    records.get(rootId)!.userId = "foreign";
    await expect(logoutTargetSession(db, request())).rejects.toMatchObject({ status: 401 });
    records.get(rootId)!.userId = user; records.get(rootId)!.originLoginSessionId = otherId;
    await expect(logoutTargetSession(db, request())).rejects.toMatchObject({ status: 401 });
    expect(db.authSession.updateMany).not.toHaveBeenCalled();
  });
  it("rejects a parent from a different authentication class", async () => {
    records.get(rootId)!.authMethods = ["operator_password"];
    await expect(logoutTargetSession(db, request())).rejects.toMatchObject({ status: 401 });
    expect(db.authSession.updateMany).not.toHaveBeenCalled();
  });
  it("accepts only the strict proof envelope at the controller without reading ambient identity or writing cookies", async () => {
    const service = { logoutSession: vi.fn().mockResolvedValue({ sessionId: targetId, status: "REVOKED", loginStatus: "REVOKED" }) };
    const controller = new AuthSessionsController(service as never);
    expect(() => controller.logoutSession({ ...request(), userId: user })).toThrow();
    await controller.logoutSession(request());
    expect(service.logoutSession).toHaveBeenCalledTimes(1);
  });
});
