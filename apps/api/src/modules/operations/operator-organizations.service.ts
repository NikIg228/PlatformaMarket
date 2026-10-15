import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { OperatorOrganization, OperatorOrganizationDetail, OperatorOrganizations, OperatorOrganizationsQuery } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import { PlatformAuthorityPolicy, type AuthorityActorContext } from "../access-control/platform-authority.policy";
import { organizationProfileFields } from "../organizations/organization-profile.service";

const selection = { id: true, legalName: true, displayName: true, bin: true, status: true, createdAt: true,
  capabilities: { select: { capability: true }, orderBy: { capability: "asc" } } } as const satisfies Prisma.OrganizationSelect;
type Selected = Prisma.OrganizationGetPayload<{ select: typeof selection }>;
const project = (row: Selected): OperatorOrganization => ({ id: row.id, legalName: row.legalName, displayName: row.displayName,
  bin: row.bin, status: row.status, createdAt: row.createdAt.toISOString(), capabilities: row.capabilities.map(item => item.capability) });

@Injectable()
export class OperatorOrganizationsService {
  constructor(private readonly prisma: PrismaService, private readonly authority: PlatformAuthorityPolicy, private readonly access: AccessControlService) {}

  private async authorize(context: AuthorityActorContext) {
    await this.authority.assertPlatformOperator(context);
    if (!await this.access.hasAll(context.actorId, context.organizationId, ["organization.view"])) throw new ForbiddenException("Insufficient permissions");
  }

  async list(query: OperatorOrganizationsQuery, context: AuthorityActorContext): Promise<OperatorOrganizations> {
    await this.authorize(context);
    const where: Prisma.OrganizationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.capability ? { capabilities: { some: { capability: query.capability } } } : {}),
      ...(query.q ? { OR: [{ legalName: { contains: query.q, mode: "insensitive" } }, { displayName: { contains: query.q, mode: "insensitive" } }, { bin: { contains: query.q } }] } : {}),
    };
    return this.prisma.$transaction(async tx => {
      const total = await tx.organization.count({ where });
      const rows = await tx.organization.findMany({ where, select: selection, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: query.offset, take: query.limit });
      return { items: rows.map(project), total, offset: query.offset, limit: query.limit };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async detail(id: string, context: AuthorityActorContext): Promise<OperatorOrganizationDetail> {
    await this.authorize(context);
    return this.prisma.$transaction(async tx => {
      const row = await tx.organization.findUnique({ where: { id }, select: { ...selection, version: true } });
      if (!row) throw new NotFoundException("Organization not found");
      const profile = await organizationProfileFields(tx, id);
      const cities = profile ? await tx.city.findMany({ where: { id: { in: [profile.legalAddress.cityId, profile.deliveryAddress.cityId] } }, select: { id: true, nameRu: true } }) : [];
      return { ...project(row), version: row.version, canEdit: false, profile,
        profileCities: profile ? { legal: cities.find(city => city.id === profile.legalAddress.cityId)?.nameRu ?? null,
          delivery: cities.find(city => city.id === profile.deliveryAddress.cityId)?.nameRu ?? null } : null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
