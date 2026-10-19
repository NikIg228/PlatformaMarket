import { Injectable } from "@nestjs/common";
import { createPilotIdentityChallengeSchema, submitPilotCmsSchema, cancelPilotSigningSessionSchema,
  pilotIdentityViewSchema, PILOT_SIGNING_CHALLENGE_TTL_MS } from "@marketplace/schemas";
import { randomBytes, randomUUID } from "node:crypto";
import { SecurityCryptoService } from "../../platform/security/security-crypto.service";
import { NcaIdentityVerifierService } from "./nca-identity-verifier.service";
import { IdentitySigningStore, identityError, identityHash, type IdentityActor } from "./identity-signing.store";

@Injectable()
export class IdentitySigningService {
  constructor(private readonly store: IdentitySigningStore, private readonly crypto: SecurityCryptoService,
    private readonly verifier: NcaIdentityVerifierService) {}

  current(actor: IdentityActor) {
    return this.store.transaction(async db => {
      await this.store.authorize(db, actor);
      const binding = await db.signingIdentityBinding.findFirst({ where: { userId: actor.actorId, status: "ACTIVE" } });
      if (binding) return pilotIdentityViewSchema.parse({ status: "VERIFIED", bindingId: binding.id, version: binding.version,
        maskedIin: binding.maskedIin, verifiedAt: binding.verifiedAt.toISOString() });
      const active = await db.identitySigningSession.findFirst({ where: { userId: actor.actorId, organizationId: actor.organizationId,
        authSessionId: actor.sessionId, OR: [{ status: "AWAITING_USER", expiresAt: { gt: new Date() } }, { status: { in: ["VERIFYING", "UNKNOWN"] } }] }, orderBy: { createdAt: "desc" } });
      return pilotIdentityViewSchema.parse({ status: "UNVERIFIED", verificationAvailable: this.verifier.configured(), activeSessionId: active?.id ?? null });
    });
  }

  get(actor: IdentityActor, id: string) {
    return this.store.transaction(async db => {
      await this.store.authorize(db, actor);
      return this.store.view(db, await this.store.owned(db, actor, id));
    });
  }

  async create(actor: IdentityActor, body: unknown) {
    const parsed = createPilotIdentityChallengeSchema.safeParse(body);
    if (!parsed.success) identityError("BAD_REQUEST");
    const input = parsed.data;
    return this.store.transaction(async db => {
      await this.store.authorize(db, actor);
      const replay = await this.store.replay(db, actor, "create", input.idempotencyKey, input);
      if (replay) return replay;
      if (!this.verifier.configured()) identityError("VERIFIER_UNAVAILABLE");
      if (await db.signingIdentityBinding.findFirst({ where: { userId: actor.actorId, status: "ACTIVE" } })) identityError("IDENTITY_CONFLICT");
      const active = await db.identitySigningSession.findFirst({ where: { userId: actor.actorId, organizationId: actor.organizationId,
        authSessionId: actor.sessionId, OR: [{ status: "AWAITING_USER", expiresAt: { gt: new Date() } }, { status: { in: ["VERIFYING", "UNKNOWN"] } }] } });
      if (active) identityError("SESSION_ALREADY_ACTIVE", { sessionId: active.id });
      const id = randomUUID(), createdAt = new Date(), expiresAt = new Date(createdAt.getTime() + PILOT_SIGNING_CHALLENGE_TTL_MS);
      const original = JSON.stringify({ protocol: 1, audience: "PlatformaMarket:identity-binding", purpose: "BIND_IDENTITY",
        sessionId: id, userId: actor.actorId, organizationId: actor.organizationId, authSessionId: actor.sessionId,
        nonce: randomBytes(32).toString("base64url"), createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() });
      const session = await db.identitySigningSession.create({ data: { id, userId: actor.actorId, organizationId: actor.organizationId,
        authSessionId: actor.sessionId, original, originalSha256: identityHash(original), createdAt, expiresAt } });
      await this.store.audit(db, session, "created");
      return this.store.remember(db, actor, "create", input.idempotencyKey, input, session);
    });
  }

  async submit(actor: IdentityActor, id: string, body: unknown) {
    const parsed = submitPilotCmsSchema.safeParse(body);
    if (!parsed.success || parsed.data.sessionId !== id) identityError("BAD_REQUEST");
    const input = parsed.data, cms = Buffer.from(input.cmsBase64, "base64");
    // Reject ambiguous encodings, including nonzero base64 padding bits.
    if (cms.toString("base64") !== input.cmsBase64) identityError("BAD_REQUEST");
    return this.store.transaction(async db => {
      await this.store.authorize(db, actor);
      const scope = `submit:${id}`, replay = await this.store.replay(db, actor, scope, input.idempotencyKey, input);
      if (replay) return replay;
      const previous = await this.store.owned(db, actor, id);
      if (previous.status === "COMMITTED") identityError("SESSION_ALREADY_COMMITTED");
      if (previous.status === "CANCELLED") identityError("SESSION_CANCELLED");
      if (previous.status === "EXPIRED" || previous.expiresAt.getTime() <= Date.now()) identityError("SESSION_EXPIRED");
      if (previous.version !== input.expectedSessionVersion || previous.status !== "AWAITING_USER") identityError("VERSION_CONFLICT", { currentVersion: previous.version });
      const acceptedAt = new Date();
      if (acceptedAt >= previous.expiresAt) identityError("SESSION_EXPIRED");
      const session = await db.identitySigningSession.update({ where: { id }, data: { status: "VERIFYING", version: { increment: 1 },
        acceptedAt, cmsEncrypted: this.crypto.encrypt(input.cmsBase64), cmsSha256: identityHash(cms), nextAttemptAt: acceptedAt } });
      await this.store.audit(db, session, "submitted");
      return this.store.remember(db, actor, scope, input.idempotencyKey, input, session);
    });
  }

  async transition(actor: IdentityActor, id: string, body: unknown, action: "cancel" | "retry") {
    const parsed = cancelPilotSigningSessionSchema.safeParse(body);
    if (!parsed.success) identityError("BAD_REQUEST");
    const input = parsed.data;
    return this.store.transaction(async db => {
      await this.store.authorize(db, actor);
      const scope = `${action}:${id}`, replay = await this.store.replay(db, actor, scope, input.idempotencyKey, input);
      if (replay) return replay;
      const previous = await this.store.owned(db, actor, id);
      if (previous.status === "COMMITTED") identityError("SESSION_ALREADY_COMMITTED");
      if (previous.version !== input.expectedSessionVersion) identityError("VERSION_CONFLICT", { currentVersion: previous.version });
      if (action === "retry" && (previous.status !== "UNKNOWN" || !previous.cmsEncrypted || !previous.acceptedAt)) identityError("VERSION_CONFLICT", { currentVersion: previous.version });
      if (action === "cancel" && !["AWAITING_USER", "VERIFYING", "UNKNOWN"].includes(previous.status)) identityError("VERSION_CONFLICT", { currentVersion: previous.version });
      const session = await db.identitySigningSession.update({ where: { id }, data: { status: action === "cancel" ? "CANCELLED" : "VERIFYING",
        version: { increment: 1 }, leaseId: null, leaseUntil: null, reasonCode: null,
        ...(action === "retry" ? { attempts: 0, nextAttemptAt: new Date() } : { nextAttemptAt: null, completedAt: new Date() }) } });
      await this.store.audit(db, session, action);
      return this.store.remember(db, actor, scope, input.idempotencyKey, input, session);
    });
  }
}
