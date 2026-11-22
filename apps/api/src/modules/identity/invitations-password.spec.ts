import { expect, it, vi } from "vitest";
import { redeemInvitation } from "./redeem-invitation";
import { passwordHash, passwordMatches } from "./password-codec";
vi.mock("./redeem-invitation", () => ({ redeemInvitation: vi.fn().mockResolvedValue({ ok: true }) }));
import { InvitationsService } from "./invitations.service";
it.each(["abcdefgh", "Abcdefgh", "Abcdefg", "А1234567"])("rejects invalid new invitation password %s", async password => {
  const db = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
  const authority = { assertRolesBelongToOrganization: vi.fn() };
  const service = new InvitationsService(db as never, authority as never, {} as never);
  vi.spyOn(service as any, "pending").mockResolvedValue({ organizationId: "org", email: "test@example.invalid", roles: [] });
  await expect(service.accept({ token: "synthetic-token", displayName: "Test owner", password })).rejects.toThrow("Минимум 8");
});

it.each([false, true])("accepts credentials for existing=%s without applying new policy to existing accounts", async existing => {
  const password = existing ? "old" : "Abcdefg1";
  const user = existing ? { id: "existing", status: "ACTIVE", passwordHash: passwordHash(password), failedLoginAttempts: 0 } : null;
  const db = { user: { findUnique: vi.fn().mockResolvedValue(user) } };
  const service = new InvitationsService(db as never, { assertRolesBelongToOrganization: vi.fn() } as never, {} as never);
  vi.spyOn(service as any, "pending").mockResolvedValue({ organizationId: "org", email: "test@example.invalid", roles: [] });
  await expect(service.accept({ token: "synthetic-token", displayName: "Test owner", password })).resolves.toEqual({ ok: true });
  const identity = vi.mocked(redeemInvitation).mock.calls.at(-1)![2];
  if (existing) expect(identity.newPasswordHash).toBeUndefined();
  else expect(passwordMatches(password, identity.newPasswordHash!)).toBe(true);
});
