import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma, type OrganizationRequisitesRevision as StoredRevision } from "@prisma/client";
import {
  organizationRequisitesMutationSchema, organizationRequisitesRevisionSchema, organizationRequisitesSourceSchema,
  saveOrganizationRequisitesSchema, confirmOrganizationRequisitesSchema, supplierOrganizationProfileFieldsSchema,
  type OrganizationRequisitesHistory, type OrganizationRequisitesHistoryQuery, type OrganizationRequisitesMutation,
  type OrganizationRequisitesResponse, type SaveOrganizationRequisitesInput, type ConfirmOrganizationRequisitesInput,
} from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { membershipPermission } from "../access-control/access-mode";
import type { AuthorityActorContext } from "../access-control/platform-authority.policy";
import { organizationProfileFields } from "./organization-profile.service";
import { requisitesReadiness, sameRequisitesSource } from "./organization-requisites.rules";

type Database = Prisma.TransactionClient;
const conflict = (message = "Реквизиты изменились. Обновите сохранённые данные перед повтором") => new ConflictException({ code: "ORGANIZATION_REQUISITES_CONFLICT", message });

function revision(value: StoredRevision) {
  return organizationRequisitesRevisionSchema.parse({
    id: value.id, version: value.version, fields: value.fields, source: value.source,
    createdAt: value.createdAt.toISOString(), createdBy: { id: value.createdById, displayName: value.createdByName },
    confirmedAt: value.confirmedAt?.toISOString() ?? null,
    confirmedBy: value.confirmedById ? { id: value.confirmedById, displayName: value.confirmedByName } : null,
  });
}

export async function organizationRequisitesSource(db: Database, organization: Prisma.OrganizationGetPayload<{ include: { capabilities: true } }>) {
    const profile = await organizationProfileFields(db, organization.id);
    const requiresPaymentDetails = organization.capabilities.some(item => item.capability === "SUPPLIER");
    const cities = profile ? await db.city.findMany({ where: { id: { in: [profile.legalAddress.cityId, profile.deliveryAddress.cityId] } }, include: { region: { include: { country: true } } } }) : [];
    const addressText = (address: NonNullable<typeof profile>["legalAddress"] | undefined) => {
      const city = cities.find(item => item.id === address?.cityId);
      return address && city ? [city.region.country.nameRu, city.region.nameRu, city.nameRu, address.line1, address.postalCode].filter(Boolean).join(", ") : null;
    };
    return organizationRequisitesSourceSchema.parse({
      organizationVersion: organization.version, legalName: organization.legalName, displayName: organization.displayName, identifier: organization.bin,
      profile, legalAddressText: addressText(profile?.legalAddress), deliveryAddressText: addressText(profile?.deliveryAddress),
      profileComplete: requiresPaymentDetails ? supplierOrganizationProfileFieldsSchema.safeParse(profile).success : Boolean(profile), requiresPaymentDetails,
    });
  }


@Injectable()
export class OrganizationRequisitesService {
  constructor(private readonly prisma: PrismaService) {}

  private async member(context: AuthorityActorContext, write: boolean, db: Database = this.prisma) {
    if (!context.actorId || !context.organizationId) throw new ForbiddenException("Войдите в организацию");
    const member = await db.organizationMembership.findFirst({
      where: {
        userId: context.actorId, organizationId: context.organizationId, status: "ACTIVE", user: { status: "ACTIVE" },
        organization: { status: "ACTIVE", capabilities: { some: { capability: { in: ["BUYER", "SUPPLIER"] } } } },
        ...membershipPermission(context.organizationId, write ? "organization.members.manage" : "organization.view"),
      },
      include: { user: { select: { displayName: true } }, organization: { include: { capabilities: true } } },
    });
    if (!member) throw new ForbiddenException(write ? "Изменить и подтвердить реквизиты может сотрудник с правом управления организацией" : "Нет доступа к реквизитам организации");
    return member;
  }


  async current(context: AuthorityActorContext): Promise<OrganizationRequisitesResponse> {
    return this.prisma.$transaction(async tx => {
      const { organization } = await this.member(context, false, tx);
      let canEdit = false;
      try { await this.member(context, true, tx); canEdit = true; } catch (error) { if (!(error instanceof ForbiddenException)) throw error; }
      const source = await organizationRequisitesSource(tx, organization);
      const head = await tx.organizationRequisites.findUnique({ where: { organizationId: organization.id } });
      const current = head?.version ? revision(await tx.organizationRequisitesRevision.findUniqueOrThrow({ where: { organizationId_version: { organizationId: organization.id, version: head.version } } })) : null;
      return { organizationId: organization.id, canEdit, version: head?.version ?? 0, source, current, readiness: requisitesReadiness(source, current) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async history(query: OrganizationRequisitesHistoryQuery, context: AuthorityActorContext): Promise<OrganizationRequisitesHistory> {
    await this.member(context, false);
    const rows = await this.prisma.organizationRequisitesRevision.findMany({
      where: { organizationId: context.organizationId, ...(query.beforeVersion === undefined ? {} : { version: { lt: query.beforeVersion } }) },
      orderBy: { version: "desc" }, take: 21,
    });
    return { items: rows.slice(0, 20).map(revision), nextBeforeVersion: rows.length > 20 ? rows[19].version : null };
  }

  private async replay(db: Database, scope: string, key: string, requestHash: string): Promise<OrganizationRequisitesMutation | null> {
    const previous = await db.idempotencyRecord.findUnique({ where: { scope_key: { scope, key } } });
    if (!previous) return null;
    if (previous.requestHash !== requestHash) throw conflict("Ключ повтора принадлежит другому действию с реквизитами");
    return organizationRequisitesMutationSchema.parse(previous.responseBody);
  }

  private async remember(db: Database, scope: string, key: string, requestHash: string, result: OrganizationRequisitesMutation) {
    await db.idempotencyRecord.create({ data: { scope, key, requestHash, responseCode: 201, responseBody: result, expiresAt: new Date(Date.now() + 86400_000) } });
    return result;
  }

  private async event(db: Database, context: AuthorityActorContext, result: OrganizationRequisitesMutation, action: "saved" | "confirmed") {
    const metadata = { revisionId: result.revisionId, version: result.version };
    await db.auditLog.create({ data: { ...context, action: `organization.requisites.${action}`, entityType: "OrganizationRequisites", entityId: context.organizationId, after: metadata } });
    await db.outboxEvent.create({ data: { aggregateType: "Organization", aggregateId: context.organizationId, eventType: action === "saved" ? "OrganizationRequisitesSaved" : "OrganizationRequisitesConfirmed", payload: { organizationId: context.organizationId, ...metadata } } });
  }

  private transaction<T>(run: (tx: Database) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(error => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw conflict();
      throw error;
    });
  }

  async save(input: SaveOrganizationRequisitesInput, context: AuthorityActorContext): Promise<OrganizationRequisitesMutation> {
    await this.member(context, true);
    const parsed = saveOrganizationRequisitesSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ code: "INVALID_ORGANIZATION_REQUISITES", message: "Проверьте реквизиты", details: parsed.error.flatten() });
    const command = parsed.data, scope = `organization-requisites:${context.organizationId}:save`;
    const requestHash = createHash("sha256").update(JSON.stringify({ actorId: context.actorId, ...command })).digest("hex");
    return this.transaction(async tx => {
      const member = await this.member(context, true, tx);
      const replay = await this.replay(tx, scope, command.idempotencyKey, requestHash);
      if (replay) return replay;
      const source = await organizationRequisitesSource(tx, member.organization);
      if (source.organizationVersion !== command.expectedOrganizationVersion) throw conflict("Данные организации изменились. Обновите их перед сохранением реквизитов");
      const head = await tx.organizationRequisites.upsert({ where: { organizationId: context.organizationId }, create: { organizationId: context.organizationId }, update: {} });
      if (head.version !== command.expectedVersion) throw conflict();
      const previous = head.version ? await tx.organizationRequisitesRevision.findUniqueOrThrow({ where: { organizationId_version: { organizationId: context.organizationId, version: head.version } } }) : null;
      if (previous) {
        const existing = revision(previous);
        if (JSON.stringify(existing.fields) === JSON.stringify(command.fields) && sameRequisitesSource(existing.source, source)) {
          return this.remember(tx, scope, command.idempotencyKey, requestHash, { revisionId: previous.id, version: previous.version });
        }
      }
      const nextVersion = head.version + 1;
      const updated = await tx.organizationRequisites.updateMany({ where: { organizationId: context.organizationId, version: command.expectedVersion }, data: { version: nextVersion } });
      if (updated.count !== 1) throw conflict();
      const saved = await tx.organizationRequisitesRevision.create({ data: {
        organizationId: context.organizationId, version: nextVersion, fields: command.fields, source,
        createdById: context.actorId, createdByName: member.user.displayName,
      } });
      const result = { revisionId: saved.id, version: saved.version };
      await this.event(tx, context, result, "saved");
      return this.remember(tx, scope, command.idempotencyKey, requestHash, result);
    });
  }

  async confirm(input: ConfirmOrganizationRequisitesInput, context: AuthorityActorContext): Promise<OrganizationRequisitesMutation> {
    await this.member(context, true);
    const parsed = confirmOrganizationRequisitesSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ code: "INVALID_ORGANIZATION_REQUISITES", message: "Подтвердите достоверность выбранной версии", details: parsed.error.flatten() });
    const command = parsed.data, scope = `organization-requisites:${context.organizationId}:confirm`;
    const requestHash = createHash("sha256").update(JSON.stringify({ actorId: context.actorId, ...command })).digest("hex");
    return this.transaction(async tx => {
      const member = await this.member(context, true, tx);
      const replay = await this.replay(tx, scope, command.idempotencyKey, requestHash);
      if (replay) return replay;
      const head = await tx.organizationRequisites.findUnique({ where: { organizationId: context.organizationId } });
      if (!head || head.version !== command.expectedVersion) throw conflict();
      const source = await organizationRequisitesSource(tx, member.organization);
      if (source.organizationVersion !== command.expectedOrganizationVersion) throw conflict("Данные организации изменились. Обновите их перед подтверждением");
      const current = revision(await tx.organizationRequisitesRevision.findUniqueOrThrow({ where: { organizationId_version: { organizationId: context.organizationId, version: head.version } } }));
      const now = new Date(), readiness = requisitesReadiness(source, current, now);
      if (!readiness.complete) throw new ConflictException({
        code: "ORGANIZATION_REQUISITES_INCOMPLETE", message: "Реквизиты пока нельзя подтвердить. Исправьте указанные поля", details: { issues: readiness.issues.filter(issue => issue.code !== "UNCONFIRMED") },
      });
      const result = { revisionId: current.id, version: current.version };
      if (!current.confirmedAt) {
        // Only metadata changes. The database also protects the revision payload.
        const updated = await tx.organizationRequisitesRevision.updateMany({
          where: { id: current.id, organizationId: context.organizationId, version: command.expectedVersion, confirmedAt: null },
          data: { confirmedAt: now, confirmedById: context.actorId, confirmedByName: member.user.displayName },
        });
        if (updated.count !== 1) throw conflict();
        await this.event(tx, context, result, "confirmed");
      }
      return this.remember(tx, scope, command.idempotencyKey, requestHash, result);
    });
  }
}
