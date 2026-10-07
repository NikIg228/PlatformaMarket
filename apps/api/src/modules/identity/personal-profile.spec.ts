import { afterEach, describe, expect, it, vi } from "vitest";
import { PersonalProfileService } from "./personal-profile.service";
import { PersonalProfileController } from "./personal-profile.controller";
import { verifyProfileEmailChange } from "./profile-email-verification";
import { resetEnvironmentForTests } from "../../platform/config/environment";
import { deliverAuthMail } from "./auth-mail.delivery";
vi.mock("./auth-mail.delivery", () => ({ requireAuthMail: vi.fn(), deliverAuthMail: vi.fn(async () => "LOCAL_FILE") }));
const actorId = "00000000-0000-4000-8000-000000000001", organizationId = "00000000-0000-4000-8000-000000000002", sessionId = "00000000-0000-4000-8000-000000000003", assetId = "00000000-0000-4000-8000-000000000004";
const context = { actorId, organizationId, sessionId };
function setup() {
  const user = { id: actorId, displayName: "Test Person", email: "first@example.invalid", phone: null, avatarAssetId: null as string | null, profileVersion: 1 };
  const db = {
    authSession: { findFirst: vi.fn(async () => ({ user })), updateMany: vi.fn(async () => ({ count: 1 })) },
    user: { updateMany: vi.fn(async ({ where, data }: { where: { profileVersion?: number }; data: Record<string, unknown> }) => {
      if (where.profileVersion !== undefined && where.profileVersion !== user.profileVersion) return { count: 0 };
      Object.assign(user, data, { profileVersion: user.profileVersion + 1 }); return { count: 1 };
    }), findUniqueOrThrow: vi.fn(async () => user) },
    auditLog: { create: vi.fn() }, securityEvent: { create: vi.fn() },
    emailAuthToken: { create: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    uploadAsset: { update: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async run => run(db));
  const uploads = { decodeBase64: vi.fn(() => Buffer.from("synthetic")), quarantine: vi.fn(async () => ({ id: assetId })), release: vi.fn() };
  const storage = { get: vi.fn(async () => Buffer.from("synthetic")) };
  const service = new PersonalProfileService(db as never, uploads as never, storage as never);
  return { db, user, uploads, storage, service, controller: new PersonalProfileController(service) };
}
afterEach(() => { vi.unstubAllEnvs(); resetEnvironmentForTests(); vi.mocked(deliverAuthMail).mockResolvedValue("LOCAL_FILE"); });
describe("personal profile boundaries", () => {
  it("reads only the active session owner with active organization membership", async () => {
    const t = setup(); expect(await t.service.current(context)).toMatchObject({ id: actorId, version: 1, phone: null });
    expect(t.db.authSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: sessionId, userId: actorId, status: "ACTIVE", user: { status: "ACTIVE", memberships: { some: { organizationId, status: "ACTIVE", organization: { status: "ACTIVE" } } } } }) }));
    t.db.authSession.findFirst.mockResolvedValue(null as never);
    await expect(t.service.save({ displayName: "Another Name", expectedVersion: 1 }, context)).rejects.toMatchObject({ status: 401 });
    expect(t.db.user.updateMany).not.toHaveBeenCalled();
    await expect(t.service.current({ ...context, actorId: "" })).rejects.toMatchObject({ status: 401 });
  });
  it("writes only validated self fields, rejects stale versions and retains audit without private values", async () => {
    const t = setup(); expect(await t.controller.save({ displayName: "New Name", phone: "+77000000001", expectedVersion: 1 }, actorId, organizationId, sessionId)).toMatchObject({ displayName: "New Name", phone: "+77000000001", version: 2 });
    await expect(t.service.save({ phone: "+77000000002", expectedVersion: 1 }, context)).rejects.toMatchObject({ status: 409 });
    expect(t.db.auditLog.create).toHaveBeenCalledTimes(1);
    for (const body of [{ displayName: " ", expectedVersion: 2 }, { phone: "", expectedVersion: 2 }, { actorId, displayName: "Foreign", expectedVersion: 2 }, { email: "unchecked@example.invalid", expectedVersion: 2 }]) {
      expect(() => t.controller.save(body, actorId, organizationId, sessionId)).toThrow();
    }
  });
  it("checks identity and version before decoding and compensates failed avatar linking", async () => {
    const t = setup(); const input = { expectedVersion: 1, fileName: "avatar.png", contentBase64: "cGlj" };
    await expect(t.service.uploadAvatar({ ...input, expectedVersion: 2 }, context)).rejects.toMatchObject({ status: 409 });
    expect(t.uploads.quarantine).not.toHaveBeenCalled();
    t.db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(t.service.uploadAvatar(input, context)).rejects.toMatchObject({ status: 409 });
    expect(t.uploads.release).toHaveBeenCalledWith(assetId, "Avatar was not linked");
    expect(t.uploads.quarantine).toHaveBeenCalledWith(expect.objectContaining({ organizationId, actorId, purpose: "profile-avatar", allowedKinds: ["PNG", "JPEG"], maxBytes: 2097152 }));
  });
  it("links only a scanned avatar, retires the old asset and never returns a foreign asset", async () => {
    const t = setup(); t.user.avatarAssetId = sessionId;
    expect(await t.service.uploadAvatar({ expectedVersion: 1, fileName: "avatar.png", contentBase64: "cGlj" }, context)).toMatchObject({ avatarAssetId: assetId, version: 2 });
    expect(t.db.uploadAsset.update).toHaveBeenCalledWith({ where: { id: assetId }, data: { metadata: { profileUserId: actorId } } });
    expect(t.db.uploadAsset.updateMany).toHaveBeenCalled();
    await expect(t.service.avatar(context)).rejects.toMatchObject({ status: 404 });
    expect(t.storage.get).not.toHaveBeenCalled();
    expect(t.db.uploadAsset.findFirst).toHaveBeenCalledWith({ where: { id: assetId, uploadedById: actorId, purpose: "profile-avatar", status: "CLEAN", deletedAt: null, metadata: { equals: { profileUserId: actorId } } } });
  });
  it("leaves login unchanged until verification and invalidates undelivered proof", async () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1/test"); resetEnvironmentForTests();
    const t = setup(); const input = { expectedVersion: 1, email: "next@example.invalid" };
    expect(await t.service.requestEmail(input, context)).toMatchObject({ verificationRequired: true, email: input.email });
    expect(t.user.email).toBe("first@example.invalid");
    expect(t.db.emailAuthToken.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: { purpose: "profile-email", previousEmail: t.user.email, email: input.email, sessionId } }) }));
    vi.mocked(deliverAuthMail).mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(t.service.requestEmail({ ...input, expectedVersion: 2 }, context)).rejects.toThrow("provider unavailable");
    expect(t.db.emailAuthToken.deleteMany).toHaveBeenLastCalledWith({ where: { tokenHash: expect.any(String), consumedAt: null } });
  });
  it("requires a live requesting session and invalidates old sessions/proofs only after verified email change", async () => {
    const t = setup(); const token = { userId: actorId, metadata: { purpose: "profile-email", email: "next@example.invalid", previousEmail: t.user.email, sessionId } };
    t.db.authSession.findFirst.mockResolvedValueOnce(null as never);
    await expect(verifyProfileEmailChange(t.db as never, token)).rejects.toMatchObject({ status: 401 });
    expect(t.db.user.updateMany).not.toHaveBeenCalled();
    expect(await verifyProfileEmailChange(t.db as never, token)).toMatchObject({ email: "next@example.invalid" });
    expect(t.db.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: actorId, status: "ACTIVE", email: "first@example.invalid" } }));
    expect(t.db.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ revokeReason: "email_changed" }) }));
  });
});
