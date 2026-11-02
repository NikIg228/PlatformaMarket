import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { AuthSessionsService } from "./auth-sessions.service";
import { resolveJwtActor } from "../../platform/security/identity-context.middleware";
import type { MarketplaceEnvironment } from "../../platform/config/environment";

vi.mock("../../platform/config/environment", () => ({ environment: () => ({ AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
  JWT_SECRET: "synthetic-personal-session-secret", JWT_ISSUER: "tests", JWT_AUDIENCE: "tests" }) }));
const config = { JWT_SECRET: "synthetic-personal-session-secret", JWT_ISSUER: "tests", JWT_AUDIENCE: "tests", JWT_REQUIRE_MFA: false } as MarketplaceEnvironment;
const csrf = "synthetic-csrf-token-long-enough";
function setup() {
  const session = { id: "session", userId: "user", activeOrganizationId: null, authMethods: ["password"],
    user: { id: "user", displayName: "Fixture" } };
  const db = { authSession: { findFirst: vi.fn().mockResolvedValue(session) }, organizationMembership: { findMany: vi.fn() } };
  return { db, session, service: new AuthSessionsService(db as never, {} as never, {} as never, {} as never) };
}
describe("personal identity without organization", () => {
  it("restores a verified cookie identity, issues an organization-free scoped token", async () => {
    const t = setup();
    const result = await t.service.currentPersonalSession("refresh", csrf);
    expect(result?.user.id).toBe("user");
    expect(resolveJwtActor(result!.accessToken, undefined, config, false, true)).toMatchObject({ actorId: "user", sessionId: "session", organizationId: undefined });
    expect(() => resolveJwtActor(result!.accessToken, undefined, config)).toThrow("purchase context");
    expect(() => resolveJwtActor(result!.accessToken, "organization", config, false, true)).toThrow();
    expect(t.db.organizationMembership.findMany).not.toHaveBeenCalled();
    expect(t.db.authSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE", user: { status: "ACTIVE" }, expiresAt: { gt: expect.any(Date) } }) }));
  });
  it("does not restore missing, revoked or operator sessions", async () => {
    const t = setup();
    expect(await t.service.currentPersonalSession(undefined, csrf)).toBeNull();
    expect(t.db.authSession.findFirst).not.toHaveBeenCalled();
    t.session.authMethods = ["password", "operator_password"];
    expect(await t.service.currentPersonalSession("refresh", csrf)).toBeNull();
    t.db.authSession.findFirst.mockResolvedValue(null);
    expect(await t.service.currentPersonalSession("refresh", csrf)).toBeNull();
  });
  it("does not accept organization tokens in personal routes or bypass MFA", () => {
    const options = { subject: "user", jwtid: "session", issuer: "tests", audience: "tests", expiresIn: 900 };
    const ordinary = jwt.sign({ organization_ids: ["org"], organization_id: "org", amr: ["password"] }, config.JWT_SECRET!, options);
    expect(() => resolveJwtActor(ordinary, undefined, config, false, true)).toThrow();
    const personal = jwt.sign({ personal: true, organization_ids: [], amr: ["password"] }, config.JWT_SECRET!, options);
    expect(() => resolveJwtActor(personal, undefined, { ...config, JWT_REQUIRE_MFA: true }, false, true)).toThrow("Multi-factor");
  });
});
