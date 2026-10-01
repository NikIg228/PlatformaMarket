import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  CreateRoleInput,
  UpdateMembershipInput,
} from "@marketplace/schemas";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { PlatformAuthorityPolicy } from "./platform-authority.policy";

const membershipUserSelect = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  emailVerifiedAt: true,
  locale: true,
} as const;

@Injectable()
export class RoleManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authority: PlatformAuthorityPolicy,
  ) {}

  listRoles(organizationId: string) {
    return this.prisma.role.findMany({
      where: { organizationId },
      include: { permissions: { include: { permission: true } } },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }

  async createRole(
    organizationId: string,
    actorId: string,
    input: CreateRoleInput,
  ) {
    await this.authority.assertCanCreateRole(
      { actorId, organizationId },
      input.permissionCodes,
    );
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: input.permissionCodes } },
      select: { id: true, code: true },
    });
    if (permissions.length !== new Set(input.permissionCodes).size)
      throw new BadRequestException("One or more permissions do not exist");
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
        await this.authority.assertCanAssignRoles({ actorId, organizationId }, [], "organization.roles.manage");
        await this.authority.assertCanCreateRole({ actorId, organizationId }, input.permissionCodes);
        const role = await tx.role.create({
          data: {
            organizationId,
            code: input.code,
            name: input.name,
            permissions: {
              create: permissions.map(({ id }) => ({ permissionId: id })),
            },
          },
          include: { permissions: { include: { permission: true } } },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            organizationId,
            action: "access.role.created",
            entityType: "Role",
            entityId: role.id,
            after: { code: role.code, permissionCodes: input.permissionCodes },
          },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: "Role",
            aggregateId: role.id,
            eventType: "RoleCreated",
            payload: { roleId: role.id, organizationId },
          },
        });
        return role;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException(
          "Role code already exists in this organization",
        );
      throw error;
    }
  }

  listMemberships(organizationId: string) {
    return this.prisma.organizationMembership.findMany({
      where: { organizationId },
      include: { user: { select: membershipUserSelect }, roles: { include: { role: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async updateMembership(
    organizationId: string,
    membershipId: string,
    actorId: string,
    input: UpdateMembershipInput,
  ) {
    const current = await this.prisma.organizationMembership.findFirst({
      where: { id: membershipId, organizationId },
      include: { roles: true },
    });
    if (!current) throw new NotFoundException("Membership not found");
    await this.authority.assertCanAssignRoles({ actorId, organizationId }, current.roles.map(({ roleId }) => roleId));
    if (current.userId === actorId && input.status && input.status !== "ACTIVE")
      throw new BadRequestException(
        "An actor cannot block or revoke their own active membership",
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
      const locked = await tx.organizationMembership.findUniqueOrThrow({ where: { id: membershipId }, include: { roles: true } });
      await this.authority.assertCanAssignRoles({ actorId, organizationId }, locked.roles.map(({ roleId }) => roleId), "organization.members.manage");
      if (input.status && input.status !== "ACTIVE") {
        await this.requireRemainingManager(tx, organizationId, membershipId);
        await tx.authSession.updateMany({ where: { userId: current.userId, status: "ACTIVE", OR: [{ activeOrganizationId: organizationId }, { organizationIds: { has: organizationId } }] },
          data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "membership_disabled" } });
        await tx.membershipInvitation.updateMany({ where: { organizationId, createdById: current.userId, status: "PENDING" }, data: { status: "REVOKED", revokedAt: new Date() } });
      }
      const membership = await tx.organizationMembership.update({
        where: { id: membershipId },
        data: {
          title: input.title,
          status: input.status,
          blockedAt:
            input.status === "BLOCKED"
              ? new Date()
              : input.status === "ACTIVE"
                ? null
                : undefined,
        },
        include: { user: { select: membershipUserSelect }, roles: { include: { role: true } } },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId,
          action: "membership.updated",
          entityType: "OrganizationMembership",
          entityId: membership.id,
          before: current,
          after: membership,
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "OrganizationMembership",
          aggregateId: membership.id,
          eventType: "MembershipUpdated",
          payload: { membershipId: membership.id, status: membership.status },
        },
      });
      return membership;
    });
  }

  async assignRole(
    organizationId: string,
    membershipId: string,
    roleId: string,
    actorId: string,
  ) {
    await this.authority.assertCanAssignRoles({ actorId, organizationId }, [
      roleId,
    ]);
    const [membership, role] = await Promise.all([
      this.prisma.organizationMembership.findFirst({
        where: { id: membershipId, organizationId },
      }),
      this.prisma.role.findFirst({ where: { id: roleId, organizationId } }),
    ]);
    if (!membership) throw new NotFoundException("Membership not found");
    if (!role) throw new NotFoundException("Role not found");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
      await this.authority.assertCanAssignRoles({ actorId, organizationId }, [roleId], "organization.roles.manage");
      const assignment = await tx.membershipRole.upsert({
        where: { membershipId_roleId: { membershipId, roleId } },
        update: {},
        create: { membershipId, roleId },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId,
          action: "membership.role.assigned",
          entityType: "OrganizationMembership",
          entityId: membershipId,
          after: { roleId },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "OrganizationMembership",
          aggregateId: membershipId,
          eventType: "MembershipRoleAssigned",
          payload: { membershipId, roleId },
        },
      });
      return assignment;
    });
  }

  async removeRole(
    organizationId: string,
    membershipId: string,
    roleId: string,
    actorId: string,
  ) {
    await this.authority.assertCanAssignRoles({ actorId, organizationId }, [roleId]);
    const assignment = await this.prisma.membershipRole.findUnique({
      where: { membershipId_roleId: { membershipId, roleId } },
      include: { membership: true },
    });
    if (!assignment || assignment.membership.organizationId !== organizationId)
      throw new NotFoundException("Role assignment not found");
    const roleCount = await this.prisma.membershipRole.count({
      where: { membershipId },
    });
    if (assignment.membership.userId === actorId && roleCount === 1)
      throw new BadRequestException("An actor cannot remove their last role");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
      await this.authority.assertCanAssignRoles({ actorId, organizationId }, [roleId], "organization.roles.manage");
      const count = await tx.membershipRole.count({ where: { membershipId } });
      if (assignment.membership.userId === actorId && count <= 1) throw new BadRequestException("An actor cannot remove their last role");
      await tx.membershipRole.delete({
        where: { membershipId_roleId: { membershipId, roleId } },
      });
      const managers = await tx.organizationMembership.count({ where: { organizationId, status: "ACTIVE", roles: { some: { role: { organizationId, permissions: { some: { permission: { code: "organization.members.manage" } } } } } } } });
      if (managers === 0) throw new ConflictException("Нельзя удалить последнее право управления сотрудниками организации");
      await tx.authSession.updateMany({ where: { userId: assignment.membership.userId, status: "ACTIVE", OR: [{ activeOrganizationId: organizationId }, { organizationIds: { has: organizationId } }] }, data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "membership_role_removed" } });
      await tx.auditLog.create({
        data: {
          actorId,
          organizationId,
          action: "membership.role.removed",
          entityType: "OrganizationMembership",
          entityId: membershipId,
          before: { roleId },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "OrganizationMembership",
          aggregateId: membershipId,
          eventType: "MembershipRoleRemoved",
          payload: { membershipId, roleId },
        },
      });
      return { membershipId, roleId, removed: true };
    });
  }

  private async requireRemainingManager(tx: Prisma.TransactionClient, organizationId: string, membershipId: string) {
    const manages = await tx.organizationMembership.count({ where: { id: membershipId, status: "ACTIVE", roles: { some: { role: { organizationId, permissions: { some: { permission: { code: "organization.members.manage" } } } } } } } });
    if (!manages) return;
    const others = await tx.organizationMembership.count({ where: { organizationId, id: { not: membershipId }, status: "ACTIVE", user: { status: "ACTIVE" }, roles: { some: { role: { organizationId, permissions: { some: { permission: { code: "organization.members.manage" } } } } } } } });
    if (!others) throw new ConflictException("В организации должен остаться сотрудник с правом управления доступом");
  }
}
