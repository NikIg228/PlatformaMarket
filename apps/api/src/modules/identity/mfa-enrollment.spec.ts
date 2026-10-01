import { expect, it, vi } from "vitest";
import { MfaService } from "./mfa.service";
import { generateTotp, generateTotpSecret } from "../../platform/security/totp";

const context = { actorId: "00000000-0000-4000-8000-000000000001", organizationId: "00000000-0000-4000-8000-000000000002" };
function fixture() {
  const secret = generateTotpSecret();
  const factor = { id: "factor", status: "PENDING", encryptedSecret: "original-secret", recoveryCodeHashes: [] };
  const tx = { $queryRaw: vi.fn(), userMfaFactor: { findUnique: vi.fn(async () => ({ ...factor, status: "ACTIVE" })), upsert: vi.fn(), updateMany: vi.fn(async () => ({ count: 0 })) } };
  const db = { user: { findUnique: vi.fn(async () => ({ id: context.actorId, email: "synthetic@example.invalid", status: "ACTIVE" })) }, userMfaFactor: { findUnique: vi.fn(async () => factor) }, auditLog: { create: vi.fn() }, $transaction: vi.fn(async (run: (value: typeof tx) => Promise<unknown>) => run(tx)) };
  return { service: new MfaService(db as never, { encrypt: () => "new-secret", decrypt: () => secret } as never), tx, db, secret };
}
it("enrollment started before activation cannot overwrite the active factor", async () => {
  const { service, tx, db } = fixture();
  await expect(service.enroll(context)).rejects.toThrow("Active MFA must be disabled");
  expect(tx.userMfaFactor.upsert).not.toHaveBeenCalled();
  expect(db.auditLog.create).not.toHaveBeenCalled();
});
it("proof for a replaced pending secret cannot activate the new factor", async () => {
  const { service, tx, db, secret } = fixture();
  await expect(service.verifyEnrollment({ code: generateTotp(secret) }, context)).rejects.toThrow("enrollment has changed");
  expect(tx.userMfaFactor.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "factor", status: "PENDING", encryptedSecret: "original-secret" } }));
  expect(db.auditLog.create).not.toHaveBeenCalled();
});
