import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { PrismaService } from "../../platform/prisma/prisma.service";

/** Password or verified external identity is checked before this transaction.
 * Token possession never changes an existing account or disabled membership. */
export async function redeemInvitation(prisma: PrismaService, token: string, identity: {
  email: string; userId?: string; displayName?: string; newPasswordHash?: string; expectedPasswordHash?: string | null; mfaVerified?: boolean;
}) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return prisma.$transaction(async tx => {
    const initial = await tx.membershipInvitation.findUnique({ where: { tokenHash }, select: { organizationId: true } });
    if (!initial) throw new BadRequestException("Приглашение недействительно");
    await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${initial.organizationId}::uuid FOR UPDATE`;
    const invitation = await tx.membershipInvitation.findUnique({ where: { tokenHash }, include: { roles: { include: { role: true } }, organization: true } });
    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date() || invitation.email !== identity.email.toLowerCase() || invitation.organization.status !== "ACTIVE") throw new BadRequestException("Приглашение недействительно или истекло");
    if (invitation.roles.some(({ role }) => role.organizationId !== invitation.organizationId)) throw new ForbiddenException("Invitation roles must belong to its organization");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${invitation.email}, 5))`;
    let user = await tx.user.findUnique({ where: { email: invitation.email } });
    if (user) {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
      user = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (identity.userId !== user.id || user.status !== "ACTIVE" || (identity.expectedPasswordHash !== undefined && identity.expectedPasswordHash !== user.passwordHash)) throw new UnauthorizedException("Аккаунт изменился. Войдите снова.");
      const factor = await tx.userMfaFactor.findUnique({ where: { userId: user.id } });
      if (factor?.status === "ACTIVE" && !identity.mfaVerified) throw new UnauthorizedException("Примите приглашение на его странице с кодом MFA");
    } else {
      if (identity.userId || !identity.newPasswordHash || !identity.displayName) throw new UnauthorizedException("Создайте аккаунт для приглашения");
      user = await tx.user.create({ data: { email: invitation.email, displayName: identity.displayName, passwordHash: identity.newPasswordHash, emailVerifiedAt: new Date() } });
    }
    const membership = await tx.organizationMembership.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: invitation.organizationId } } });
    if (membership) throw new ConflictException("Сотрудник уже добавлен. Для изменения доступа обратитесь к администратору организации.");
    const claimed = await tx.membershipInvitation.updateMany({ where: { id: invitation.id, status: "PENDING", tokenHash, expiresAt: { gt: new Date() } }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
    if (claimed.count !== 1) throw new ConflictException("Приглашение уже использовано или изменилось");
    const created = await tx.organizationMembership.create({ data: { userId: user.id, organizationId: invitation.organizationId,
      status: "ACTIVE", acceptedAt: new Date(), roles: { create: invitation.roles.map(({ roleId }) => ({ roleId })) } }, include: { roles: true } });
    await tx.auditLog.create({ data: { actorId: user.id, organizationId: invitation.organizationId, action: "membership.accepted", entityType: "OrganizationMembership", entityId: created.id, after: { userId: user.id, invitationId: invitation.id } } });
    await tx.outboxEvent.create({ data: { aggregateType: "OrganizationMembership", aggregateId: created.id, eventType: "MembershipAccepted", payload: { membershipId: created.id, userId: user.id, organizationId: invitation.organizationId } } });
    return { user: { id: user.id, email: user.email, displayName: user.displayName },
      membership: { id: created.id, organizationId: created.organizationId, status: "ACTIVE" as const, roles: created.roles.map(({ roleId }) => ({ roleId })) } };
  });
}
