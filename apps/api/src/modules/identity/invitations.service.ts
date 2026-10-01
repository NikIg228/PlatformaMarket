import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { AcceptInvitationInput, CreateInvitationInput } from "@marketplace/schemas";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { PlatformAuthorityPolicy } from "../access-control/platform-authority.policy";
import { environment } from "../../platform/config/environment";
import { deliverAuthMail, requireAuthMail } from "./auth-mail.delivery";
import { passwordHash, passwordMatches } from "./password-codec";
import { redeemInvitation } from "./redeem-invitation";
import { MfaService } from "./mfa.service";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService, private readonly authority: PlatformAuthorityPolicy, private readonly mfa: MfaService) {}

  async list(organizationId: string) {
    const invitations = await this.prisma.membershipInvitation.findMany({ where: { organizationId }, include: { roles: true }, orderBy: { createdAt: "desc" }, take: 200 });
    return invitations.map(invitation => ({ id: invitation.id, email: invitation.email,
      status: invitation.status === "PENDING" && invitation.expiresAt <= new Date() ? "EXPIRED" : invitation.status,
      expiresAt: invitation.expiresAt, createdAt: invitation.createdAt, roleIds: invitation.roles.map(role => role.roleId) }));
  }

  async create(organizationId: string, actorId: string, input: CreateInvitationInput) {
    await this.authority.assertCanAssignRoles({ actorId, organizationId }, input.roleIds);
    const token = randomBytes(32).toString("base64url");
    const roleIds = [...new Set(input.roleIds)];
    const invitation = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
      await this.authority.assertCanAssignRoles({ actorId, organizationId }, roleIds, "organization.members.manage");
      const organization = await tx.organization.findFirst({ where: { id: organizationId, status: "ACTIVE" } });
      if (!organization) throw new NotFoundException("Организация недоступна");
      const current = await tx.organizationMembership.findFirst({ where: { organizationId, user: { email: input.email } } });
      if (current) throw new ConflictException("Сотрудник уже добавлен. Измените его доступ в списке сотрудников.");
      await tx.membershipInvitation.updateMany({ where: { organizationId, email: input.email, status: "PENDING" }, data: { status: "REVOKED", revokedAt: new Date() } });
      const created = await tx.membershipInvitation.create({ data: { organizationId, email: input.email,
        createdById: actorId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + input.expiresInHours * 3_600_000),
        roles: { create: roleIds.map(roleId => ({ roleId })) } } });
      await tx.auditLog.create({ data: { actorId, organizationId, action: "membership.invited", entityType: "MembershipInvitation", entityId: created.id, after: { email: created.email, roleIds } } });
      await tx.outboxEvent.create({ data: { aggregateType: "MembershipInvitation", aggregateId: created.id, eventType: "MembershipInvited", payload: { invitationId: created.id, organizationId } } });
      return created;
    });
    return { invitationId: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt, token };
  }

  async deliver(organizationId: string, invitationId: string, actorId: string) {
    const config = environment();
    requireAuthMail(config);
    const token = randomBytes(32).toString("base64url");
    const invitation = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
      const current = await tx.membershipInvitation.findFirst({ where: { id: invitationId, organizationId }, include: { roles: true, organization: true } });
      if (!current) throw new NotFoundException("Приглашение не найдено");
      if (!["PENDING", "EXPIRED"].includes(current.status) || current.organization.status !== "ACTIVE") throw new ConflictException("Приглашение больше не активно");
      await this.authority.assertCanAssignRoles({ actorId, organizationId }, current.roles.map(role => role.roleId), "organization.members.manage");
      const updated = await tx.membershipInvitation.update({ where: { id: current.id }, data: { tokenHash: hashToken(token), status: "PENDING", expiresAt: new Date(Date.now() + 72 * 3_600_000) } });
      await tx.auditLog.create({ data: { actorId, organizationId, action: "membership.invitation.delivery_requested", entityType: "MembershipInvitation", entityId: invitationId } });
      return { ...updated, organizationName: current.organization.displayName };
    });
    const link = `${config.AUTH_EMAIL_BASE_URL}/invitation#token=${encodeURIComponent(token)}`;
    try {
      const delivery = await deliverAuthMail(config, { to: invitation.email, subject: "Приглашение в PlatformaMarket",
        text: `Вас пригласили в организацию «${invitation.organizationName}».\nПринять приглашение: ${link}\nСсылка действует до ${invitation.expiresAt.toISOString()}.` });
      return { invitationId, expiresAt: invitation.expiresAt, delivery };
    } catch (error) {
      // A later resend may already have replaced this token. Never expire that resend.
      await this.prisma.membershipInvitation.updateMany({ where: { id: invitationId, tokenHash: hashToken(token), status: "PENDING" }, data: { status: "EXPIRED", expiresAt: new Date() } });
      throw error;
    }
  }

  async revoke(organizationId: string, invitationId: string, actorId: string) {
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
      await this.authority.assertCanAssignRoles({ actorId, organizationId }, [], "organization.members.manage");
      const current = await tx.membershipInvitation.findFirst({ where: { id: invitationId, organizationId } });
      if (!current) throw new NotFoundException("Приглашение не найдено");
      if (current.status === "ACCEPTED") throw new ConflictException("Приглашение уже принято. Управляйте доступом сотрудника.");
      if (current.status !== "REVOKED") {
        await tx.membershipInvitation.update({ where: { id: invitationId }, data: { status: "REVOKED", revokedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId, organizationId, action: "membership.invitation.revoked", entityType: "MembershipInvitation", entityId: invitationId } });
      }
      return { ok: true as const };
    });
  }

  private async pending(token: string) {
    const invitation = await this.prisma.membershipInvitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { roles: { include: { role: true } }, organization: true } });
    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date() || invitation.organization.status !== "ACTIVE") throw new BadRequestException("Приглашение недействительно или истекло. Попросите новую ссылку.");
    return invitation;
  }

  async details(token: string) {
    const invitation = await this.pending(token);
    const account = await this.prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true, mfaFactor: { select: { status: true } } } });
    return { organizationName: invitation.organization.displayName, email: invitation.email, expiresAt: invitation.expiresAt,
      roles: invitation.roles.map(({ role }) => role.name), accountExists: Boolean(account), mfaRequired: account?.mfaFactor?.status === "ACTIVE" };
  }

  async accept(input: AcceptInvitationInput, actorId?: string) {
    const invitation = await this.pending(input.token);
    await this.authority.assertRolesBelongToOrganization(invitation.organizationId, invitation.roles.map(role => role.roleId));
    const user = await this.prisma.user.findUnique({ where: { email: invitation.email }, include: { mfaFactor: true } });
    if (user && (user.status !== "ACTIVE" || (user.lockedUntil && user.lockedUntil > new Date()))) throw new UnauthorizedException("Доступ к аккаунту недоступен");
    if (user && user.id !== actorId) {
      if (!input.password || !passwordMatches(input.password, user.passwordHash)) {
        await this.prisma.user.updateMany({ where: { id: user.id, failedLoginAttempts: user.failedLoginAttempts }, data: { failedLoginAttempts: { increment: 1 }, lockedUntil: user.failedLoginAttempts + 1 >= 5 ? new Date(Date.now() + 15 * 60_000) : undefined } });
        throw new UnauthorizedException("Введите действующий пароль аккаунта или войдите через провайдера.");
      }
    }
    if (!user && !input.password) throw new BadRequestException("Создайте пароль для нового аккаунта");
    if (user?.mfaFactor?.status === "ACTIVE") {
      if (!input.mfaCode) throw new UnauthorizedException("Подтвердите вход кодом MFA");
      await this.mfa.challenge({ code: input.mfaCode }, { actorId: user.id, organizationId: invitation.organizationId });
    }
    return redeemInvitation(this.prisma, input.token, { email: invitation.email, userId: user?.id,
      mfaVerified: user?.mfaFactor?.status === "ACTIVE",
      expectedPasswordHash: user && user.id !== actorId ? user.passwordHash : undefined,
      displayName: input.displayName, newPasswordHash: user ? undefined : passwordHash(input.password!) });
  }
}
