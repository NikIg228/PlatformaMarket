import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentitySigningSession } from "@prisma/client";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { environment, type MarketplaceEnvironment } from "../../platform/config/environment";
import { toApiErrorResponse } from "../../platform/http/api-exception.filter";
import { IdentitySigningStore, identityError, identityHash, type IdentityDatabase } from "./identity-signing.store";

vi.mock("../../platform/config/environment", () => ({ environment: vi.fn() }));
const actor = { actorId: "00000000-0000-4000-8000-000000000001", organizationId: "00000000-0000-4000-8000-000000000002", sessionId: "00000000-0000-4000-8000-000000000003" };
function fixture() {
  const db = { $queryRaw: vi.fn().mockResolvedValue([]), authSession: { findFirst: vi.fn().mockResolvedValue({ id: actor.sessionId }) },
    identitySigningSession: { findFirst: vi.fn().mockResolvedValue(null) }, identitySigningCommand: { findUnique: vi.fn().mockResolvedValue(null) } };
  return { db, tx: db as unknown as IdentityDatabase, store: new IdentitySigningStore(db as unknown as PrismaService) };
}
beforeEach(() => vi.mocked(environment).mockReturnValue({ AUTH_MODE: "jwt" } as MarketplaceEnvironment));
describe("identity persistence authorization and safe projections", () => {
  it("denies development headers and malformed IDs before any SQL", async () => {
    const f = fixture(); vi.mocked(environment).mockReturnValue({ AUTH_MODE: "development" } as MarketplaceEnvironment);
    await expect(f.store.authorize(f.tx, actor)).rejects.toMatchObject({ status: 401 });
    vi.mocked(environment).mockReturnValue({ AUTH_MODE: "jwt" } as MarketplaceEnvironment);
    await expect(f.store.authorize(f.tx, { ...actor, actorId: "forged" })).rejects.toMatchObject({ status: 401 });
    expect(f.db.$queryRaw).not.toHaveBeenCalled();
  });
  it("locks all revocable authorization rows and requires a live scoped session", async () => {
    const f = fixture(); await f.store.authorize(f.tx, actor);
    expect(f.db.$queryRaw).toHaveBeenCalledTimes(4);
    expect(f.db.authSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: actor.sessionId, userId: actor.actorId, status: "ACTIVE", revokedAt: null, organizationIds: { has: actor.organizationId },
    }) }));
    f.db.authSession.findFirst.mockResolvedValue(null);
    await expect(f.store.authorize(f.tx, actor)).rejects.toMatchObject({ status: 401 });
  });
  it("does not expose another authentication session's challenge", async () => {
    const f = fixture(); await expect(f.store.owned(f.tx, actor, actor.sessionId)).rejects.toMatchObject({ status: 404 });
    expect(f.db.identitySigningSession.findFirst).toHaveBeenCalledWith({ where: { id: actor.sessionId, userId: actor.actorId, organizationId: actor.organizationId, authSessionId: actor.sessionId } });
  });
  it("returns the exact saved response for a replay, rejecting altered payloads", async () => {
    const f = fixture(), request = { version: 1 }, response = { id: actor.sessionId, version: 2, purpose: "BIND_IDENTITY", status: "VERIFYING" };
    f.db.identitySigningCommand.findUnique.mockResolvedValue({ userId: actor.actorId, requestSha256: identityHash(JSON.stringify(request)), response });
    expect(await f.store.replay(f.tx, actor, "submit", "key", request)).toEqual(response);
    await expect(f.store.replay(f.tx, actor, "submit", "key", { version: 2 })).rejects.toMatchObject({ status: 409 });
  });
  it("never returns expired signing material", async () => {
    const f = fixture(); const session = { id: actor.sessionId, version: 1, status: "AWAITING_USER", original: "private bytes", expiresAt: new Date(0) } as IdentitySigningSession;
    expect(await f.store.view(f.tx, session)).toEqual({ id: actor.sessionId, version: 1, purpose: "BIND_IDENTITY", status: "EXPIRED" });
  });
  it("preserves the core error envelope without nested details", () => {
    try { identityError("VERSION_CONFLICT", { currentVersion: 2 }); }
    catch (error) { expect(toApiErrorResponse(error, { path: "/api/signing", requestId: "test", production: true })).toMatchObject({ statusCode: 409, code: "VERSION_CONFLICT", details: { currentVersion: 2 } }); }
  });
});
