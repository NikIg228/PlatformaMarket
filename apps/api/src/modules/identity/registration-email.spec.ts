import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { requestRegistrationEmailCorrection, verifyRegistrationEmailCorrection } from "./registration-email";
import { deliverAuthMail } from "./auth-mail.delivery";
import { passwordHash } from "./password-codec";

vi.mock("../../platform/config/environment", () => ({ environment: () => ({ AUTH_EMAIL_BASE_URL: "https://market.example.invalid", AUTH_EMAIL_VERIFICATION_TTL_HOURS: 24 }) }));
vi.mock("./auth-mail.delivery", () => ({ requireAuthMail: vi.fn(), deliverAuthMail: vi.fn(async () => "LOCAL_FILE") }));
const registrationToken = "synthetic-registration-proof".repeat(2);
const password = "synthetic-original-password";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const userHash = passwordHash(password);
beforeEach(() => vi.mocked(deliverAuthMail).mockReset().mockResolvedValue("LOCAL_FILE"));

function fixture() {
  const registration = { id: "00000000-0000-4000-8000-000000000001", tokenHash: digest(registrationToken), email: "typo@example.invalid", status: "PENDING", organizationId: null, expiresAt: new Date(Date.now() + 60_000) };
  const user = { id: "00000000-0000-4000-8000-000000000002", email: registration.email, status: "ACTIVE", emailVerifiedAt: null as Date | null, lockedUntil: null as Date | null, failedLoginAttempts: 0, passwordHash: userHash };
  const db = {
    $queryRaw: vi.fn(async () => []),
    registrationIntent: { findUnique: vi.fn(async () => registration), findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn(async () => ({ count: 1 })) },
    user: { findUnique: vi.fn(async ({ where }) => where.email && where.email !== user.email ? null : user), update: vi.fn(async ({ data }) => ({ ...user, ...data })) },
    emailAuthToken: { findFirst: vi.fn().mockResolvedValue({ id: "bound-proof" }), updateMany: vi.fn(async () => ({ count: 1 })), create: vi.fn(async ({ data }) => ({ id: "new-proof", ...data })) },
    securityEvent: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (operation: (tx: unknown) => unknown) => operation(db)),
  };
  const input = { registrationToken, password, email: "correct@example.invalid", returnTo: "/catalog" };
  const proof = { userId: user.id, metadata: { purpose: "registration-email", registrationId: registration.id, registrationToken, previousEmail: user.email, email: input.email } };
  return { db, registration, user, input, proof };
}

describe("registration email correction request", () => {
  it("binds a new proof, invalidates the old email link, and leaves account/intent unchanged until verification", async () => {
    const f = fixture();
    expect(await requestRegistrationEmailCorrection(f.db as never, f.input)).toEqual({ ok: true, verificationRequired: true, email: f.input.email, delivery: "LOCAL_FILE" });
    expect(f.db.registrationIntent.updateMany).not.toHaveBeenCalled();
    expect(f.db.user.update).toHaveBeenCalledWith({ where: { id: f.user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    expect(f.db.emailAuthToken.updateMany).toHaveBeenCalledWith({ where: { userId: f.user.id, type: "EMAIL_VERIFICATION", consumedAt: null }, data: { consumedAt: expect.any(Date) } });
    const data = f.db.emailAuthToken.create.mock.calls[0][0].data;
    expect(data.metadata).toEqual(f.proof.metadata);
    expect(data.expiresAt).toEqual(f.registration.expiresAt);
    expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(deliverAuthMail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ to: f.input.email, text: expect.stringContaining("returnTo=%2Fcatalog") }));
  });

  it.each(["expired", "claimed", "verified", "locked", "unbound"])("rejects %s registration without delivery or proof mutation", async state => {
    const f = fixture();
    if (state === "expired") f.registration.expiresAt = new Date(0);
    if (state === "claimed") f.registration.status = "CLAIMED";
    if (state === "verified") f.user.emailVerifiedAt = new Date();
    if (state === "locked") f.user.lockedUntil = new Date(Date.now() + 60000);
    if (state === "unbound") f.db.emailAuthToken.findFirst.mockResolvedValue(null);
    await expect(requestRegistrationEmailCorrection(f.db as never, f.input)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.db.emailAuthToken.create).not.toHaveBeenCalled();
    expect(f.db.emailAuthToken.updateMany).not.toHaveBeenCalled();
    expect(deliverAuthMail).not.toHaveBeenCalled();
  });

  it("persists a failed password attempt and locks on the fifth failure", async () => {
    const f = fixture(); f.user.failedLoginAttempts = 4;
    await expect(requestRegistrationEmailCorrection(f.db as never, { ...f.input, password: "wrong-synthetic-password" })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.db.user.update).toHaveBeenCalledWith({ where: { id: f.user.id }, data: { failedLoginAttempts: 5, lockedUntil: expect.any(Date) } });
    expect(f.db.emailAuthToken.updateMany).not.toHaveBeenCalled();
    expect(deliverAuthMail).not.toHaveBeenCalled();
  });

  it("rejects an address reserved by another registration without changing the old link", async () => {
    const f = fixture(); f.db.registrationIntent.findFirst.mockResolvedValue({ id: "other" });
    await expect(requestRegistrationEmailCorrection(f.db as never, f.input)).rejects.toBeInstanceOf(ConflictException);
    expect(f.db.emailAuthToken.updateMany).not.toHaveBeenCalled();
  });

  it("invalidates only its own undelivered proof and permits a later retry", async () => {
    const f = fixture(); vi.mocked(deliverAuthMail).mockRejectedValueOnce(new Error("delivery unavailable"));
    await expect(requestRegistrationEmailCorrection(f.db as never, f.input)).rejects.toThrow("delivery unavailable");
    expect(f.db.emailAuthToken.updateMany).toHaveBeenLastCalledWith({ where: { id: "new-proof", consumedAt: null }, data: { consumedAt: expect.any(Date) } });
    await expect(requestRegistrationEmailCorrection(f.db as never, f.input)).resolves.toMatchObject({ ok: true });
  });
});

describe("registration email proof verification", () => {
  it("updates the same intent and account and invalidates old password/email proofs", async () => {
    const f = fixture();
    const result = await verifyRegistrationEmailCorrection(f.db as never, f.proof, f.user as never);
    expect(result.email).toBe(f.input.email);
    expect(result.emailVerifiedAt).toBeInstanceOf(Date);
    expect(f.db.registrationIntent.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: f.registration.id, email: f.user.email, status: "PENDING" }), data: { email: f.input.email } }));
    expect(f.db.emailAuthToken.updateMany).toHaveBeenCalledWith({ where: { userId: f.user.id, consumedAt: null }, data: { consumedAt: expect.any(Date) } });
  });
  it.each(["expired", "claimed", "verified", "changed-email", "different-proof", "foreign-user"])("does not mutate %s state", async state => {
    const f = fixture();
    if (state === "expired") f.registration.expiresAt = new Date(0);
    if (state === "claimed") f.registration.status = "CLAIMED";
    if (state === "verified") f.user.emailVerifiedAt = new Date();
    if (state === "changed-email") f.user.email = "other@example.invalid";
    if (state === "different-proof") f.registration.tokenHash = digest("different");
    if (state === "foreign-user") f.proof.userId = "other";
    await expect(verifyRegistrationEmailCorrection(f.db as never, f.proof, f.user as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.db.user.update).not.toHaveBeenCalled();
    expect(f.db.registrationIntent.updateMany).not.toHaveBeenCalled();
  });
  it("rejects a concurrent claim before updating the user", async () => {
    const f = fixture(); f.db.registrationIntent.updateMany.mockResolvedValue({ count: 0 });
    await expect(verifyRegistrationEmailCorrection(f.db as never, f.proof, f.user as never)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.db.user.update).not.toHaveBeenCalled();
  });
});
