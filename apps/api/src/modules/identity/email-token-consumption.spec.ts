import { describe, expect, it, vi } from "vitest";
import { AuthSessionsService } from "./auth-sessions.service";

function fixture(type: "EMAIL_VERIFICATION" | "PASSWORD_RESET", claimed = 1) {
  const token = { id: "token", userId: "user", type, consumedAt: null, expiresAt: new Date(Date.now() + 60_000), metadata: null,
    user: { id: "user", email: "synthetic@example.invalid", displayName: "Synthetic", status: "ACTIVE" } };
  const tx = { emailAuthToken: { updateMany: vi.fn(async () => ({ count: claimed })) }, user: { update: vi.fn() }, authSession: { updateMany: vi.fn() }, securityEvent: { create: vi.fn() } };
  const db = { emailAuthToken: { findUnique: vi.fn(async () => token) }, $transaction: vi.fn(async (run: (value: typeof tx) => Promise<unknown>) => run(tx)) };
  const service = new AuthSessionsService(db as never, {} as never, {} as never, {} as never);
  return { token, tx, service };
}
describe("one-time email proofs", () => {
  it("a lost reset claim cannot change credentials or revoke sessions", async () => {
    const { service, tx } = fixture("PASSWORD_RESET", 0);
    await expect(service.resetPassword("synthetic-proof", "synthetic-new-password")).rejects.toThrow("уже использована");
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.authSession.updateMany).not.toHaveBeenCalled();
  });
  it("a lost verification claim cannot verify an account or create a session", async () => {
    const { service, tx } = fixture("EMAIL_VERIFICATION", 0);
    await expect(service.verifyEmail("synthetic-proof", {})).rejects.toThrow("уже использована");
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it.each(["PASSWORD_RESET", "EMAIL_VERIFICATION"] as const)("rejects disabled accounts for %s", async type => {
    const { service, token, tx } = fixture(type);
    token.user.status = "BLOCKED";
    await expect(type === "PASSWORD_RESET" ? service.resetPassword("proof", "synthetic-new-password") : service.verifyEmail("proof", {})).rejects.toThrow("недействительна");
    expect(tx.emailAuthToken.updateMany).not.toHaveBeenCalled();
  });
  it("successful reset consumes proof and revokes all sessions in its transaction", async () => {
    const { service, tx } = fixture("PASSWORD_RESET");
    expect(await service.resetPassword("proof", "synthetic-new-password")).toEqual({ ok: true });
    expect(tx.emailAuthToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ consumedAt: null, expiresAt: { gt: expect.any(Date) } }) }));
    expect(tx.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user", status: "ACTIVE" }, data: expect.objectContaining({ status: "REVOKED", revokeReason: "password_reset" }) }));
  });
});
