import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { accessControlMode, hasFullAccess, membershipPermission } from "./access-mode";

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async policyFor(userId: string, organizationId: string) {
    return { mode: accessControlMode(), permissions: await this.permissionsFor(userId, organizationId) };
  }

  async permissionsFor(userId: string, organizationId: string) {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId }, user: { status: "ACTIVE" }, organization: { status: "ACTIVE" } },
      include: {
        roles: {
          where: { role: { organizationId } },
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    if (!membership || membership.status !== "ACTIVE") return [];
    if (hasFullAccess()) {
      const permissions = await this.prisma.permission.findMany({ select: { code: true }, orderBy: { code: "asc" } });
      return permissions.map(({ code }) => code);
    }
    return [
      ...new Set(
        membership.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.code),
        ),
      ),
    ].sort();
  }

  async hasAll(userId: string, organizationId: string, required: string[]) {
    const permissionCodes = [...new Set(required)];
    if (permissionCodes.length === 0) return true;
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId,
        organizationId,
        status: "ACTIVE",
        user: { status: "ACTIVE" },
        organization: { status: "ACTIVE" },
        AND: permissionCodes.map((code) => membershipPermission(organizationId, code)),
      },
      select: { id: true },
    });
    return Boolean(membership);
  }
}
