import { expect, it } from "vitest";
import { invitationAcceptedSchema, invitationDetailsSchema, invitationListSchema, identitySessionRevokedSchema } from "./identity-management";
const id = "00000000-0000-4000-8000-000000000001";
it("session revocation confirms the exact session without exposing its credentials", () => {
  expect(identitySessionRevokedSchema.safeParse({ id, status: "REVOKED" }).success).toBe(true);
  expect(identitySessionRevokedSchema.safeParse({ id, status: "REVOKED", refreshTokenHash: "secret" }).success).toBe(false);
});
it("invitation acceptance excludes password and credential fields", () => {
  const result = { user: { id, email: "test@example.invalid", displayName: "Test" }, membership: { id, organizationId: id, status: "ACTIVE", roles: [{ roleId: id }] } };
  expect(invitationAcceptedSchema.safeParse(result).success).toBe(true);
  expect(invitationAcceptedSchema.safeParse({ ...result, user: { ...result.user, passwordHash: "secret" } }).success).toBe(false);
});
it("public proof metadata and authenticated invitation lists never contain the proof", () => {
  expect(invitationDetailsSchema.safeParse({ organizationName: "Synthetic", email: "test@example.invalid", expiresAt: new Date().toISOString(), roles: [], accountExists: false, token: "secret" }).success).toBe(false);
  expect(invitationListSchema.safeParse([{ id, email: "test@example.invalid", status: "PENDING", expiresAt: new Date().toISOString(), createdAt: new Date().toISOString(), roleIds: [], tokenHash: "secret" }]).success).toBe(false);
});
