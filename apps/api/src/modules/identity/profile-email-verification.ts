import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const proof = z.object({ purpose: z.literal("profile-email"), email: z.email().max(254), previousEmail: z.email(), sessionId: z.uuid() });

/** Runs after the one-use token claim, in the same transaction. */
export async function verifyProfileEmailChange(tx: Prisma.TransactionClient, token: { userId: string; metadata: unknown }) {
  const parsed = proof.safeParse(token.metadata);
  if (!parsed.success) throw new UnauthorizedException("Ссылка смены почты недействительна");
  const value = parsed.data;
  const session = await tx.authSession.findFirst({ where: { id: value.sessionId, userId: token.userId, status: "ACTIVE", expiresAt: { gt: new Date() } } });
  if (!session) throw new UnauthorizedException("Запрос смены почты устарел. Войдите в профиль и повторите его.");
  try {
    const changed = await tx.user.updateMany({ where: { id: token.userId, status: "ACTIVE", email: value.previousEmail },
      data: { email: value.email, emailVerifiedAt: new Date(), profileVersion: { increment: 1 } } });
    if (changed.count !== 1) throw new ConflictException("Почта уже изменилась. Повторите запрос из профиля.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("Этот адрес нельзя использовать. Укажите другой адрес в профиле.");
    throw error;
  }
  await tx.emailAuthToken.updateMany({ where: { userId: token.userId, consumedAt: null }, data: { consumedAt: new Date() } });
  await tx.authSession.updateMany({ where: { userId: token.userId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "email_changed" } });
  await tx.securityEvent.create({ data: { type: "auth.email.changed", severity: "INFO", actorId: token.userId } });
  return tx.user.findUniqueOrThrow({ where: { id: token.userId } });
}
