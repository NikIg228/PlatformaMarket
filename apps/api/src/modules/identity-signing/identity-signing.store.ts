import { HttpException, Injectable } from "@nestjs/common";
import { Prisma, type IdentitySigningSession } from "@prisma/client";
import { pilotSigningHttpStatus, pilotSigningSessionViewSchema } from "@marketplace/schemas";
import { createHash } from "node:crypto";
import { z } from "zod";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { environment } from "../../platform/config/environment";

export type IdentityActor = { actorId: string; organizationId: string; sessionId: string };
export type IdentityDatabase = Prisma.TransactionClient;
export const identityHash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export function identityError(code: keyof typeof pilotSigningHttpStatus, details?: { sessionId?: string; currentVersion?: number }): never {
  throw new HttpException({ code, message: code, ...details }, pilotSigningHttpStatus[code]);
}
const actorSchema = z.strictObject({ actorId: z.uuid(), organizationId: z.uuid(), sessionId: z.uuid() });

@Injectable()
export class IdentitySigningStore {
  constructor(readonly prisma: PrismaService) {}

  async transaction<T>(work: (db: IdentityDatabase) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.prisma.$transaction(work, { isolationLevel: "Serializable", timeout: 10_000 }); }
      catch (error) {
        if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) continue;
        throw error;
      }
    }
  }

  async authorize(db: IdentityDatabase, actor: IdentityActor) {
    // Development headers are not a source of authorization for identity binding.
    if (environment().AUTH_MODE !== "jwt" || !actorSchema.safeParse(actor).success) identityError("UNAUTHORIZED");
    await this.lockAuthorization(db, actor);
    if (!await this.active(db, actor)) identityError("UNAUTHORIZED");
  }

  async lockAuthorization(db: IdentityDatabase, actor: IdentityActor) {
    // Serialize with account/session/membership revocation, as well as other commands.
    await db.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.actorId}::uuid FOR UPDATE`;
    await db.$queryRaw`SELECT "id" FROM "AuthSession" WHERE "id" = ${actor.sessionId}::uuid FOR SHARE`;
    await db.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${actor.organizationId}::uuid FOR SHARE`;
    await db.$queryRaw`SELECT "id" FROM "OrganizationMembership" WHERE "userId" = ${actor.actorId}::uuid AND "organizationId" = ${actor.organizationId}::uuid FOR SHARE`;
  }

  async active(db: IdentityDatabase, actor: IdentityActor) {
    return Boolean(await db.authSession.findFirst({ where: { id: actor.sessionId, userId: actor.actorId,
      status: "ACTIVE", revokedAt: null, expiresAt: { gt: new Date() }, organizationIds: { has: actor.organizationId },
      user: { status: "ACTIVE", memberships: { some: { organizationId: actor.organizationId, status: "ACTIVE", organization: { status: "ACTIVE" } } } } }, select: { id: true } }));
  }

  async owned(db: IdentityDatabase, actor: IdentityActor, id: string) {
    if (!z.uuid().safeParse(id).success) identityError("BAD_REQUEST");
    const session = await db.identitySigningSession.findFirst({ where: { id, userId: actor.actorId,
      organizationId: actor.organizationId, authSessionId: actor.sessionId } });
    if (!session) identityError("NOT_FOUND");
    return session;
  }

  async replay(db: IdentityDatabase, actor: IdentityActor, scope: string, key: string, request: unknown) {
    const saved = await db.identitySigningCommand.findUnique({ where: { authSessionId_organizationId_scope_idempotencyKey: {
      authSessionId: actor.sessionId, organizationId: actor.organizationId, scope, idempotencyKey: key } } });
    if (!saved) return null;
    if (saved.userId !== actor.actorId || saved.requestSha256 !== identityHash(JSON.stringify(request))) identityError("IDEMPOTENCY_CONFLICT");
    return pilotSigningSessionViewSchema.parse(saved.response);
  }

  async remember(db: IdentityDatabase, actor: IdentityActor, scope: string, key: string, request: unknown, session: IdentitySigningSession) {
    const response = await this.view(db, session);
    await db.identitySigningCommand.create({ data: { userId: actor.actorId, organizationId: actor.organizationId,
      authSessionId: actor.sessionId, sessionId: session.id, scope, idempotencyKey: key,
      requestSha256: identityHash(JSON.stringify(request)), response } });
    return response;
  }

  async audit(db: IdentityDatabase, session: IdentitySigningSession, action: string) {
    await db.auditLog.create({ data: { actorId: session.userId, organizationId: session.organizationId,
      action: `identity.signing.${action}`, entityType: "IdentitySigningSession", entityId: session.id,
      after: { status: session.status, version: session.version, reasonCode: session.reasonCode } } });
  }

  async view(db: IdentityDatabase, session: IdentitySigningSession) {
    const base = { id: session.id, version: session.version, purpose: "BIND_IDENTITY" as const };
    switch (session.status) {
      case "AWAITING_USER":
        if (session.expiresAt.getTime() <= Date.now()) return pilotSigningSessionViewSchema.parse({ ...base, status: "EXPIRED" });
        return pilotSigningSessionViewSchema.parse({ ...base, status: session.status, signingInput: {
          kind: "CHALLENGE", id: session.id, purpose: base.purpose, contentBase64: Buffer.from(session.original).toString("base64"),
          checksumSha256: session.originalSha256, createdAt: session.createdAt.toISOString(), expiresAt: session.expiresAt.toISOString(),
        } });
      case "COMMITTED": case "EVIDENCE_ONLY": {
        const evidence = await db.identitySigningEvidence.findUniqueOrThrow({ where: { sessionId: session.id } });
        return pilotSigningSessionViewSchema.parse({ ...base, status: session.status, evidenceId: evidence.id,
          ...(session.status === "COMMITTED" ? { committedAt: session.completedAt!.toISOString() } : { reasonCode: session.reasonCode }) });
      }
      case "UNKNOWN": case "REJECTED":
        return pilotSigningSessionViewSchema.parse({ ...base, status: session.status, reasonCode: session.reasonCode });
      default: return pilotSigningSessionViewSchema.parse({ ...base, status: session.status });
    }
  }
}
