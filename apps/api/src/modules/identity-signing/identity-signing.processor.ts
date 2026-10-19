import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import type { IdentitySigningSession } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { environment } from "../../platform/config/environment";
import { runtimeCapabilities } from "../../platform/runtime/process-role";
import { SecurityCryptoService } from "../../platform/security/security-crypto.service";
import { IdentitySigningStore, identityHash } from "./identity-signing.store";
import { NcaIdentityVerifierService } from "./nca-identity-verifier.service";
import type { IdentityVerification } from "./identity-verifier.contract";

@Injectable()
export class IdentitySigningProcessor {
  private running = false;
  private readonly logger = new Logger(IdentitySigningProcessor.name);
  constructor(private readonly store: IdentitySigningStore, private readonly crypto: SecurityCryptoService,
    private readonly verifier: NcaIdentityVerifierService) {}

  @Interval(5000)
  async tick() {
    if (this.running || !runtimeCapabilities(environment().PROCESS_ROLE).schedules) return;
    this.running = true;
    try { await Promise.all([this.processOne(), this.processOne()]); }
    catch { this.logger.error("Identity verification job failed; saved submission remains recoverable"); }
    finally { this.running = false; }
  }

  async processOne() {
    const session = await this.store.transaction(async db => {
      const rows = await db.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "IdentitySigningSession"
        WHERE "status" IN ('VERIFYING', 'UNKNOWN')
          AND "nextAttemptAt" <= CURRENT_TIMESTAMP
          AND ("leaseUntil" IS NULL OR "leaseUntil" < CURRENT_TIMESTAMP)
        ORDER BY "nextAttemptAt", "id" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      return db.identitySigningSession.update({ where: { id: rows[0].id }, data: {
        leaseId: randomUUID(), leaseUntil: new Date(Date.now() + 90_000), attempts: { increment: 1 },
      } });
    });
    if (!session) return false;
    if (session.attempts > 8) {
      await this.finalize(session, { protocol: 1, status: "REJECTED", code: "VERIFIER_UNAVAILABLE" });
      return true;
    }
    let result: IdentityVerification;
    try {
      const original = Buffer.from(session.original), cms = Buffer.from(this.crypto.decrypt(session.cmsEncrypted!), "base64");
      if (identityHash(original) !== session.originalSha256 || identityHash(cms) !== session.cmsSha256 || !session.acceptedAt) throw new Error("Stored content mismatch");
      result = await this.verifier.verify({ original, cms, createdAt: session.createdAt, acceptedAt: session.acceptedAt });
    } catch { result = { protocol: 1, status: "REJECTED", code: "VERIFIER_UNAVAILABLE" }; }
    await this.finalize(session, result);
    return true;
  }

  async finalize(claim: IdentitySigningSession, result: IdentityVerification) {
    const actor = { actorId: claim.userId, organizationId: claim.organizationId, sessionId: claim.authSessionId };
    await this.store.transaction(async db => {
      await this.store.lockAuthorization(db, actor);
      const current = await db.identitySigningSession.findUniqueOrThrow({ where: { id: claim.id } });
      const cancelled = current.status === "CANCELLED";
      // A cancelled job may retain a valid late receipt, but may never bind identity.
      // A superseded lease must not overwrite another worker's result.
      if (!cancelled && (current.leaseId !== claim.leaseId || !["VERIFYING", "UNKNOWN"].includes(current.status))) return;
      if (current.cmsSha256 !== claim.cmsSha256 || current.originalSha256 !== claim.originalSha256) return;
      if (await db.identitySigningEvidence.findUnique({ where: { sessionId: claim.id } })) return;
      if (result.status === "REJECTED") {
        if (cancelled) return;
        const temporary = ["VERIFIER_UNAVAILABLE", "TRUST_INDETERMINATE"].includes(result.code);
        const session = await db.identitySigningSession.update({ where: { id: claim.id }, data: {
          status: temporary ? "UNKNOWN" : "REJECTED", reasonCode: result.code, version: { increment: 1 },
          leaseId: null, leaseUntil: null,
          nextAttemptAt: temporary && current.attempts < 8 ? new Date(Date.now() + Math.min(300000, 5000 * 2 ** current.attempts)) : null,
          completedAt: temporary ? null : new Date(),
        } });
        await this.store.audit(db, session, temporary ? "verification.pending" : "rejected");
        return;
      }
      // Defense in depth at the persistence boundary, even with a verified adapter receipt.
      if (result.originalSha256 !== current.originalSha256 || result.cmsSha256 !== current.cmsSha256) throw new Error("Verifier receipt does not match stored submission");
      const live = !cancelled && await this.store.active(db, actor);
      const fingerprint = this.crypto.fingerprint(result.iin, "signing-identity-iin");
      const conflict = await db.signingIdentityBinding.findFirst({ where: { status: "ACTIVE",
        OR: [{ userId: current.userId }, { iinFingerprint: fingerprint }] }, select: { id: true } });
      const accepted = live && !conflict;
      const reasonCode = accepted ? null : !live ? "SESSION_CANCELLED" : "IDENTITY_CONFLICT";
      const payload = JSON.stringify(result);
      const evidence = await db.identitySigningEvidence.create({ data: { sessionId: current.id, encryptedPayload: this.crypto.encrypt(payload),
        payloadSha256: identityHash(payload), policySha256: result.policySha256, accepted, reasonCode } });
      if (accepted) await db.signingIdentityBinding.create({ data: { userId: current.userId, iinEncrypted: this.crypto.encrypt(result.iin),
        iinFingerprint: fingerprint, maskedIin: `********${result.iin.slice(-4)}`, evidenceId: evidence.id, verifiedAt: new Date(result.verifiedAt) } });
      const session = await db.identitySigningSession.update({ where: { id: current.id }, data: {
        status: cancelled ? "CANCELLED" : accepted ? "COMMITTED" : "EVIDENCE_ONLY", reasonCode,
        version: { increment: 1 }, leaseId: null, leaseUntil: null, nextAttemptAt: null, completedAt: new Date(),
      } });
      await this.store.audit(db, session, accepted ? "committed" : "evidence.retained");
    });
  }
}
