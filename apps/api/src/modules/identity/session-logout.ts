import { UnauthorizedException } from "@nestjs/common";
import { Prisma, type AuthSession } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { SessionLogoutRequest, SessionLogoutResponse } from "@marketplace/schemas";
import { environment } from "../../platform/config/environment";
import type { PrismaService } from "../../platform/prisma/prisma.service";

const invalidProof = () => new UnauthorizedException("Не удалось подтвердить целевую сессию выхода.");
const expiredProof = () => new UnauthorizedException({ code: "SESSION_LOGOUT_PROOF_EXPIRED", message: "Подтверждение выхода истекло. Восстановите выбранную сессию и повторите выход." });

export async function lockSessionRows(tx: Prisma.TransactionClient, ids: string[]) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "AuthSession" WHERE "id" IN (${Prisma.join([...new Set(ids)].map(id => Prisma.sql`${id}::uuid`))}) ORDER BY "id" FOR UPDATE`);
}

function verifyLogoutProof(input: SessionLogoutRequest, now: Date) {
  const config = environment();
  const key = (config.JWT_PUBLIC_KEY ?? config.JWT_SECRET)?.replaceAll("\\n", "\n");
  if (!key) throw invalidProof();
  try {
    // Expired proofs can identify an already terminal session, never authorize a write.
    const claims = jwt.verify(input.accessToken, key, {
      issuer: config.JWT_ISSUER ?? "dentmarket-kz", audience: config.JWT_AUDIENCE ?? "dentmarket-web",
      algorithms: config.JWT_PUBLIC_KEY ? ["RS256", "ES256"] : ["HS256"], ignoreExpiration: true,
    });
    if (typeof claims === "string" || typeof claims.sub !== "string" || claims.jti !== input.sessionId ||
      typeof claims.exp !== "number" || typeof claims.iat !== "number" || claims.exp <= claims.iat ||
      claims.iat * 1000 > now.getTime() + 5000) throw invalidProof();
    return { userId: claims.sub, expired: claims.exp * 1000 <= now.getTime() };
  } catch { throw invalidProof(); }
}

function terminalStatus(session: AuthSession, now: Date): "REVOKED" | "EXPIRED" | undefined {
  if (session.status === "REVOKED") return "REVOKED";
  if (session.expiresAt <= now || session.status === "EXPIRED") return "EXPIRED";
  return undefined;
}

/** No ambient cookies, identity headers, token rotation, or Set-Cookie response. */
export async function logoutTargetSession(prisma: PrismaService, input: SessionLogoutRequest): Promise<SessionLogoutResponse> {
  const now = new Date();
  const proof = verifyLogoutProof(input, now);
  return prisma.$transaction(async tx => {
    const selected = await tx.authSession.findUnique({ where: { id: input.sessionId } });
    if (!selected || selected.userId !== proof.userId) throw invalidProof();
    const rootId = selected.originLoginSessionId;
    await lockSessionRows(tx, [selected.id, ...(rootId ? [rootId] : [])]);
    const target = await tx.authSession.findUnique({ where: { id: selected.id } });
    if (!target || target.userId !== proof.userId || target.originLoginSessionId !== rootId) throw invalidProof();
    const root = rootId && rootId !== target.id ? await tx.authSession.findUnique({ where: { id: rootId } }) : null;
    if (rootId && rootId !== target.id && (!root || root.userId !== proof.userId || root.originLoginSessionId !== root.id ||
      root.authMethods.includes("operator_password") !== target.authMethods.includes("operator_password"))) throw invalidProof();
    const sessions = root ? [target, root] : [target];
    if (proof.expired && sessions.some(session => !terminalStatus(session, now))) throw expiredProof();
    for (const session of sessions) {
      if (terminalStatus(session, now)) continue;
      const changed = await tx.authSession.updateMany({ where: { id: session.id, userId: proof.userId, status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: now, revokeReason: "user_logout" } });
      if (changed.count !== 1) throw invalidProof();
      await tx.securityEvent.create({ data: { type: "auth.session.logout", severity: "INFO", actorId: proof.userId, sessionId: session.id } });
    }
    return { sessionId: target.id, status: terminalStatus(target, now) ?? "REVOKED",
      loginStatus: root ? terminalStatus(root, now) ?? "REVOKED" : rootId === target.id ? "SAME_SESSION" : "NOT_LINKED" };
  });
}
