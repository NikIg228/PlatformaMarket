import { expect, it } from "vitest";
import { authEmailSessionSchema, authEmailVerifiedSchema, mfaVerificationResultSchema, mfaChallengeResultSchema, mfaStatusSchema } from "./auth-api.js";
const id = "00000000-0000-4000-8000-000000000001";
const session = { user: { id, email: "test@example.invalid", displayName: "Test" }, accessToken: "synthetic-access-token", accessTokenExpiresIn: 300, refreshTokenExpiresAt: "2026-10-02T00:00:00.000Z", sessionId: id, activeOrganizationId: null, organizationIds: [], csrfToken: "synthetic-csrf-proof-for-test" };
it("accepts an account with no organization but rejects exposed refresh secrets", () => {
  expect(authEmailSessionSchema.parse(session).activeOrganizationId).toBeNull();
  expect(authEmailSessionSchema.safeParse({ ...session, refreshToken: "must-stay-in-cookie" }).success).toBe(false);
  expect(authEmailVerifiedSchema.safeParse({ ...session, verified: true }).success).toBe(true);
});
it("requires a complete elevated session or the explicitly supported factor-only response", () => {
  const factor = { enabled: true, verifiedAt: "2026-10-02T00:00:00.000Z", recoveryCodesRemaining: 8 };
  const elevated = { accessToken: "synthetic-token", accessTokenExpiresIn: 300, activeOrganizationId: id, authenticationMethods: ["password", "mfa"] };
  expect(mfaVerificationResultSchema.safeParse(factor).success).toBe(true);
  expect(mfaVerificationResultSchema.safeParse({ factor, ...elevated }).success).toBe(true);
  expect(mfaVerificationResultSchema.safeParse({ factor, accessToken: "partial" }).success).toBe(false);
  expect(mfaChallengeResultSchema.safeParse({ ...elevated, factor: { verified: true, method: "RECOVERY_CODE", challengeId: id, recoveryCodesRemaining: 7 } }).success).toBe(true);
});
it("does not accept internal MFA material in the public status", () => {
  const status = { enabled: false, status: "NOT_ENROLLED", verifiedAt: null, lastUsedAt: null, recoveryCodesRemaining: 0, lockedUntil: null };
  expect(mfaStatusSchema.safeParse(status).success).toBe(true);
  expect(mfaStatusSchema.safeParse({ ...status, encryptedSecret: "internal" }).success).toBe(false);
});
