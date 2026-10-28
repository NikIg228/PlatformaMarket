import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { AuthSessionsService } from "./auth-sessions.service";
const config = vi.hoisted(() => ({ JWT_SECRET: "synthetic-jwt-secret-at-least-32-characters", AUTH_ACCESS_TOKEN_TTL_SECONDS: 900, AUTH_REFRESH_TOKEN_TTL_DAYS: 30 }));
vi.mock("../../platform/config/environment", () => ({ environment: () => config }));
const proof = "p".repeat(43), proofs = { SUPPLIER: proof };
let db: any, service: AuthSessionsService;
beforeEach(() => {
  db = {
    idempotencyRecord: { findUnique: vi.fn().mockResolvedValue({ id: "code", expiresAt: new Date(Date.now() + 60000), responseCode: 200, responseBody: { sessionId: "source", userId: "user", organizationId: "org", capability: "SUPPLIER", browserProofHash: createHash("sha256").update(proof).digest("hex") } }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    authSession: { findFirst: vi.fn().mockResolvedValue({ id: "source", originLoginSessionId: "source", userId: "user", status: "ACTIVE", activeOrganizationId: "org", expiresAt: new Date(Date.now()+60000), organizationIds: ["org"], authMethods: ["password"] }), findUnique: vi.fn().mockResolvedValue({ id: "source", originLoginSessionId: "source", userId: "user" }), create: vi.fn().mockImplementation(async ({ data }) => data), updateMany: vi.fn() },
    organizationMembership: { findFirst: vi.fn().mockResolvedValue({ organization: { id: "org", displayName: "Test", capabilities: [{ capability: "SUPPLIER" }] } }), findMany: vi.fn().mockResolvedValue([{ organizationId: "other" }]) },
    user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "user", displayName: "Test", email: "test@example.invalid" }) },
  };
  db.$transaction = vi.fn(async callback => callback(db));
  db.$queryRaw = vi.fn().mockResolvedValue([]);
  service = new AuthSessionsService(db, {} as never, {} as never, {} as never);
});
describe("workspace session boundaries", () => {
  it.each([{}, { SUPPLIER: "x".repeat(43) }, { BUYER: proof }])("rejects a missing, foreign or wrong-workspace browser proof", async supplied => {
    await expect(service.exchangeHandoff("synthetic-code", supplied)).rejects.toMatchObject({ status: 401 });
    expect(db.idempotencyRecord.updateMany).not.toHaveBeenCalled();
    expect(db.authSession.create).not.toHaveBeenCalled();
  });
  it("rejects old unbound codes without consuming them", async () => {
    const record = await db.idempotencyRecord.findUnique();
    delete record.responseBody.browserProofHash;
    await expect(service.exchangeHandoff("synthetic-code", proofs)).rejects.toMatchObject({ status: 401 });
    expect(db.idempotencyRecord.updateMany).not.toHaveBeenCalled();
  });
  it("inherits the original login from a derived source", async () => {
    db.authSession.findUnique.mockResolvedValue({ id: "source", originLoginSessionId: "root", userId: "user" });
    db.authSession.findFirst.mockResolvedValueOnce({ id: "source", originLoginSessionId: "root", userId: "user", authMethods: ["password"] })
      .mockResolvedValueOnce({ id: "root", originLoginSessionId: "root", userId: "user" });
    await service.exchangeHandoff("synthetic-code", proofs);
    expect(db.authSession.findFirst.mock.calls[1][0].where).toMatchObject({ id: "root", userId: "user", status: "ACTIVE", expiresAt: { gt: expect.any(Date) } });
    expect(db.authSession.create).toHaveBeenCalledWith({ data: expect.objectContaining({ originLoginSessionId: "root" }) });
  });
  it.each([null, { id: "root", originLoginSessionId: "different" }])("denies an unavailable or non-root origin (%j)", async root => {
    db.authSession.findUnique.mockResolvedValue({ id: "source", originLoginSessionId: "root", userId: "user" });
    db.authSession.findFirst.mockResolvedValueOnce({ id: "source", originLoginSessionId: "root", userId: "user", authMethods: ["password"] }).mockResolvedValueOnce(root);
    await expect(service.exchangeHandoff("synthetic-code", proofs)).rejects.toMatchObject({ status: 401 });
    expect(db.authSession.create).not.toHaveBeenCalled();
  });
  it("preserves an unknown origin for a legacy source", async () => {
    db.authSession.findUnique.mockResolvedValue({ id: "source", originLoginSessionId: null, userId: "user" });
    db.authSession.findFirst.mockResolvedValue({ id: "source", originLoginSessionId: null, userId: "user", authMethods: ["password"] });
    await service.exchangeHandoff("synthetic-code", proofs);
    expect(db.authSession.create).toHaveBeenCalledWith({ data: expect.objectContaining({ originLoginSessionId: null }) });
  });
  it("creates a destination session only after one-time consumption and current membership validation", async () => {
    const result = await service.exchangeHandoff("synthetic-code", proofs);
    expect(result.sessionId).not.toBe("source"); expect(result.refreshToken.length).toBeGreaterThan(32);
    expect(db.authSession.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "user", originLoginSessionId: "source", organizationIds: ["org"], activeOrganizationId: "org", authMethods: ["password"] }) });
    expect(db.organizationMembership.findFirst.mock.calls[0][0].where).toMatchObject({ userId: "user", organizationId: "org", status: "ACTIVE", user: { status: "ACTIVE" }, organization: { status: "ACTIVE" } });
  });
  it("does not exchange a consumed code or one whose membership has been removed", async () => {
    db.idempotencyRecord.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.exchangeHandoff("synthetic-code", proofs)).rejects.toThrow("already been used");
    expect(db.authSession.create).not.toHaveBeenCalled();
    db.organizationMembership.findFirst.mockResolvedValueOnce(null);
    await expect(service.exchangeHandoff("synthetic-code", proofs)).rejects.toMatchObject({ status: 403 });
    expect(db.authSession.create).not.toHaveBeenCalled();
  });
  it("does not change the active organization silently during refresh", async () => {
    await expect(service.rotate("synthetic-refresh", {})).rejects.toThrow("Войдите заново");
    expect(db.authSession.updateMany).not.toHaveBeenCalled();
  });
  it("does not rotate the cookie of a different login in the same browser", async () => {
    await expect(service.rotate("synthetic-refresh", {}, "another-session")).rejects.toThrow("another session");
    expect(db.authSession.updateMany).not.toHaveBeenCalled();
  });
  it("only lists active memberships of the verified user", async () => {
    db.organizationMembership.findMany.mockResolvedValue([{ organization: { id: "org", displayName: "Test", capabilities: [{ capability: "SUPPLIER" }, { capability: "MARKETPLACE_OPERATOR" }] } }]);
    expect(await service.workspaceChoices("user")).toEqual([{ organizationId: "org", organizationDisplayName: "Test", capabilities: ["SUPPLIER"] }]);
    expect(db.organizationMembership.findMany.mock.calls[0][0].where).toMatchObject({ userId: "user", status: "ACTIVE", user: { status: "ACTIVE" }, organization: { status: "ACTIVE" } });
    await expect(service.workspaceChoices()).rejects.toMatchObject({ status: 401 });
  });
});
