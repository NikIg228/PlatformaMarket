import { ConflictException, UnauthorizedException } from "@nestjs/common";
import type { RegistrationEmailCorrection } from "@marketplace/schemas";
import { withWorkspaceReturn } from "@marketplace/schemas";
import { Prisma, type User } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { environment } from "../../platform/config/environment";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { deliverAuthMail, requireAuthMail } from "./auth-mail.delivery";
import { passwordMatches } from "./password-codec";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const invalid = () => new UnauthorizedException("Не удалось подтвердить незавершённую регистрацию. Проверьте пароль или перейдите ко входу.");
const unavailableEmail = () => new ConflictException("Этот адрес нельзя использовать для заявки. Укажите другой email.");
const correctionProof = z.object({
  purpose: z.literal("registration-email"), registrationId: z.uuid(),
  registrationToken: z.string().min(32).max(512), previousEmail: z.email(), email: z.email(),
}).strict();

export async function lockIdentityUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`);
}

async function assertEmailAvailable(tx: Prisma.TransactionClient, email: string, userId: string, registrationId: string) {
  const user = await tx.user.findUnique({ where: { email }, select: { id: true } });
  const registration = await tx.registrationIntent.findFirst({ where: { email, id: { not: registrationId }, status: "PENDING", expiresAt: { gt: new Date() } }, select: { id: true } });
  if ((user && user.id !== userId) || registration) throw unavailableEmail();
}

export async function requestRegistrationEmailCorrection(prisma: PrismaService, input: RegistrationEmailCorrection) {
  const config = environment();
  requireAuthMail(config);
  const source = await prisma.registrationIntent.findUnique({ where: { tokenHash: digest(input.registrationToken) } });
  if (!source) throw invalid();
  const account = await prisma.user.findUnique({ where: { email: source.email }, select: { id: true } });
  if (!account) throw invalid();
  const raw = randomBytes(48).toString("base64url");
  const result = await prisma.$transaction(async tx => {
    await lockIdentityUser(tx, account.id);
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "RegistrationIntent" WHERE "id" = ${source.id}::uuid FOR UPDATE`);
    const registration = await tx.registrationIntent.findUnique({ where: { id: source.id } });
    const user = await tx.user.findUnique({ where: { id: account.id } });
    const now = new Date();
    if (!registration || registration.tokenHash !== digest(input.registrationToken) || registration.status !== "PENDING" || registration.organizationId || registration.expiresAt <= now ||
      !user || user.status !== "ACTIVE" || user.emailVerifiedAt || user.email !== registration.email || (user.lockedUntil && user.lockedUntil > now)) throw invalid();
    // A new intent for an existing address does not authorize changing that account.
    const bound = await tx.emailAuthToken.findFirst({ where: { userId: user.id, type: "EMAIL_VERIFICATION", metadata: { path: ["registrationToken"], equals: input.registrationToken } }, select: { id: true } });
    if (!bound) throw invalid();
    if (!passwordMatches(input.password, user.passwordHash)) {
      const failures = user.failedLoginAttempts + 1;
      await tx.user.update({ where: { id: user.id }, data: { failedLoginAttempts: failures, lockedUntil: failures >= 5 ? new Date(now.getTime() + 15 * 60_000) : null } });
      return null;
    }
    await assertEmailAvailable(tx, input.email, user.id, registration.id);
    const expiresAt = new Date(Math.min(registration.expiresAt.getTime(), now.getTime() + config.AUTH_EMAIL_VERIFICATION_TTL_HOURS * 3_600_000));
    await tx.emailAuthToken.updateMany({ where: { userId: user.id, type: "EMAIL_VERIFICATION", consumedAt: null }, data: { consumedAt: now } });
    const proof = await tx.emailAuthToken.create({ data: { userId: user.id, type: "EMAIL_VERIFICATION", tokenHash: digest(raw), expiresAt,
      metadata: { purpose: "registration-email", registrationId: registration.id, registrationToken: input.registrationToken, previousEmail: user.email, email: input.email } } });
    await tx.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    return { proofId: proof.id, expiresAt };
  });
  if (!result) throw invalid();
  const link = withWorkspaceReturn(`${config.AUTH_EMAIL_BASE_URL}/verify-email?token=${encodeURIComponent(raw)}`, input.returnTo);
  try {
    const delivery = await deliverAuthMail(config, { to: input.email, subject: "Подтвердите исправленный email в PlatformaMarket",
      text: `Подтвердите новый адрес для незавершённой регистрации:\n${link}\n\nСсылка действует до ${result.expiresAt.toISOString()}. Предыдущая ссылка больше не действует.` });
    return { ok: true as const, verificationRequired: true as const, email: input.email, delivery };
  } catch (error) {
    await prisma.emailAuthToken.updateMany({ where: { id: result.proofId, consumedAt: null }, data: { consumedAt: new Date() } });
    throw error;
  }
}

/** Called with the user locked and the email proof consumed in this transaction. */
export async function verifyRegistrationEmailCorrection(tx: Prisma.TransactionClient, token: { userId: string; metadata: unknown }, user: User) {
  const parsed = correctionProof.safeParse(token.metadata);
  if (!parsed.success) throw invalid();
  const proof = parsed.data;
  const registration = await tx.registrationIntent.findUnique({ where: { id: proof.registrationId } });
  const now = new Date();
  if (!registration || registration.tokenHash !== digest(proof.registrationToken) || registration.status !== "PENDING" || registration.organizationId || registration.expiresAt <= now ||
    user.id !== token.userId || user.status !== "ACTIVE" || user.emailVerifiedAt || user.email !== proof.previousEmail || registration.email !== user.email) throw invalid();
  await assertEmailAvailable(tx, proof.email, user.id, registration.id);
  try {
    const changed = await tx.registrationIntent.updateMany({ where: { id: registration.id, tokenHash: registration.tokenHash, email: proof.previousEmail, status: "PENDING", organizationId: null, expiresAt: { gt: now } }, data: { email: proof.email } });
    if (changed.count !== 1) throw invalid();
    const verifiedUser = await tx.user.update({ where: { id: user.id }, data: { email: proof.email, emailVerifiedAt: now, profileVersion: { increment: 1 }, failedLoginAttempts: 0, lockedUntil: null } });
    await tx.emailAuthToken.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: now } });
    await tx.securityEvent.create({ data: { type: "auth.registration.email.corrected", severity: "INFO", actorId: user.id, metadata: { registrationId: registration.id } } });
    return verifiedUser;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw unavailableEmail();
    throw error;
  }
}
