import { afterEach, expect, it, vi } from "vitest";
import { authEmailSessionSchema, mfaChallengeResultSchema, mfaVerificationResultSchema } from "@marketplace/schemas";
import { AuthSessionsController } from "./auth-sessions.controller";
import { MfaController } from "./mfa.controller";
import { resetEnvironmentForTests } from "../../platform/config/environment";

const actor = "00000000-0000-4000-8000-000000000001";
const organization = "00000000-0000-4000-8000-000000000002";
const wire = (value: unknown) => JSON.parse(JSON.stringify(value));
afterEach(() => { vi.unstubAllEnvs(); resetEnvironmentForTests(); });

it("keeps the refresh secret in an HttpOnly cookie while matching the public login contract", async () => {
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1/test");
  resetEnvironmentForTests();
  const session = { user: { id: actor, email: "test@example.invalid", displayName: "Test" }, accessToken: "synthetic-access-token", accessTokenExpiresIn: 300, refreshToken: "synthetic-refresh-secret", refreshTokenExpiresAt: new Date("2026-10-03T00:00:00.000Z"), sessionId: actor, activeOrganizationId: null, organizationIds: [] };
  const cookie = vi.fn();
  const controller = new AuthSessionsController({ loginEmail: vi.fn(async () => session) } as never);
  const body = wire(await controller.login({ email: "test@example.invalid", password: "synthetic-password" }, { header: () => undefined } as never, { cookie } as never));
  expect(authEmailSessionSchema.parse(body).activeOrganizationId).toBeNull();
  expect(body).not.toHaveProperty("refreshToken");
  expect(cookie).toHaveBeenCalledWith("mp_refresh", session.refreshToken, expect.objectContaining({ httpOnly: true }));
});

it("documents both MFA elevation and factor-only local paths with serialized dates", async () => {
  const factor = { enabled: true, verifiedAt: new Date(), recoveryCodesRemaining: 8 };
  const challenge = { verified: true, method: "TOTP", challengeId: actor, recoveryCodesRemaining: 8 };
  const elevateMfa = vi.fn(async () => ({ accessToken: "synthetic-access-token", accessTokenExpiresIn: 300, activeOrganizationId: organization, authenticationMethods: ["password", "mfa"] }));
  const controller = new MfaController({ verifyEnrollment: vi.fn(async () => factor), challenge: vi.fn(async () => challenge) } as never, { elevateMfa } as never);
  expect(mfaVerificationResultSchema.safeParse(wire(await controller.verify({ code: "123456" }, actor, organization, ""))).success).toBe(true);
  expect(elevateMfa).not.toHaveBeenCalled();
  expect(mfaVerificationResultSchema.safeParse(wire(await controller.verify({ code: "123456" }, actor, organization, actor))).success).toBe(true);
  expect(mfaChallengeResultSchema.safeParse(wire(await controller.challenge({ code: "123456" }, actor, organization, actor))).success).toBe(true);
  expect(elevateMfa).toHaveBeenCalledWith(actor, actor, organization);
});

it("rejects malformed MFA proof before the service or session elevation", async () => {
  const challenge = vi.fn(); const elevateMfa = vi.fn();
  const controller = new MfaController({ challenge } as never, { elevateMfa } as never);
  await expect(controller.challenge({ code: "bad" }, actor, organization, actor)).rejects.toThrow();
  expect(challenge).not.toHaveBeenCalled(); expect(elevateMfa).not.toHaveBeenCalled();
});
