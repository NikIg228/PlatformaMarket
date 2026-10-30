import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AVATAR_MAX_BYTES, storefrontContentSchema, type SaveSupplierStorefront, type SupplierStorefront, type SupplierStorefrontSettings, type UploadSupplierLogo } from "@marketplace/schemas";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { FileUploadPolicyService } from "../../platform/security/file-upload-policy.service";
import { ObjectStorageService } from "../../platform/storage/object-storage.service";
import { membershipPermission } from "../access-control/access-mode";
import { SupplierTermsService } from "../agreements/supplier-terms.service";
import { publicContactSelect, publicOrganizationContact } from "../organizations/contact-projection";
import type { SupplierActorContext } from "./supplier-access.service";

const select = {
  organizationId: true, status: true, storefrontContent: true, storefrontVersion: true, storefrontLogoAssetId: true,
  organization: { select: { displayName: true, status: true, profile: { select: publicContactSelect } } },
} as const;
type Database = Prisma.TransactionClient;
const conflict = () => new ConflictException("Сведения витрины изменились. Загрузите сохранённую версию перед повторной записью.");

@Injectable()
export class SupplierStorefrontService {
  constructor(private readonly prisma: PrismaService, private readonly terms: SupplierTermsService,
    private readonly uploads: FileUploadPolicyService, private readonly storage: ObjectStorageService) {}

  private async member(supplierId: string, context: SupplierActorContext, write: boolean, db: Database = this.prisma) {
    if (!context.actorId || supplierId !== context.organizationId) throw new ForbiddenException("Нет доступа к витрине поставщика");
    const member = await db.organizationMembership.findFirst({ where: {
      userId: context.actorId, organizationId: supplierId, status: "ACTIVE", user: { status: "ACTIVE" },
      organization: { status: "ACTIVE", capabilities: { some: { capability: "SUPPLIER" } } },
      ...membershipPermission(supplierId, write ? "supplier.profile.manage" : "organization.view"),
    }, select: { id: true } });
    if (!member) throw new ForbiddenException("Нет права на просмотр или изменение витрины поставщика");
  }

  private async profile(supplierId: string, db: Database = this.prisma) {
    const profile = await db.supplierProfile.findUnique({ where: { organizationId: supplierId }, select });
    if (!profile || profile.status !== "ACTIVE" || profile.organization.status !== "ACTIVE") throw new NotFoundException("Витрина поставщика недоступна");
    return profile;
  }

  private present(profile: Awaited<ReturnType<SupplierStorefrontService["profile"]>>): SupplierStorefront {
    const parsed = storefrontContentSchema.safeParse(profile.storefrontContent);
    return { supplierId: profile.organizationId, name: profile.organization.displayName,
      content: parsed.success ? parsed.data : storefrontContentSchema.parse({ ru: {}, kk: {} }),
      logoUrl: profile.storefrontLogoAssetId ? `/catalog/suppliers/${profile.organizationId}/logo` : null,
      contact: publicOrganizationContact(profile.organization.profile) };
  }

  async publicPage(supplierId: string): Promise<SupplierStorefront> {
    const profile = await this.profile(supplierId);
    if (!(await this.terms.commercialState(supplierId)).admitted) throw new NotFoundException("Витрина поставщика недоступна");
    return this.present(profile);
  }

  async current(supplierId: string, context: SupplierActorContext): Promise<SupplierStorefrontSettings> {
    await this.member(supplierId, context, false);
    const profile = await this.profile(supplierId);
    let canEdit = false;
    try { await this.member(supplierId, context, true); canEdit = true; } catch (error) { if (!(error instanceof ForbiddenException)) throw error; }
    return { ...this.present(profile), version: profile.storefrontVersion,
      published: (await this.terms.commercialState(supplierId)).admitted, canEdit };
  }

  private async update(db: Database, supplierId: string, context: SupplierActorContext, expectedVersion: number, fields: Prisma.SupplierProfileUpdateManyMutationInput) {
    await this.member(supplierId, context, true, db);
    const changed = await db.supplierProfile.updateMany({ where: { organizationId: supplierId, status: "ACTIVE", storefrontVersion: expectedVersion },
      data: { ...fields, storefrontVersion: { increment: 1 } } });
    if (changed.count !== 1) throw conflict();
    await db.auditLog.create({ data: { ...context, action: "supplier.storefront.updated", entityType: "SupplierProfile", entityId: supplierId, after: { version: expectedVersion + 1 } } });
    await db.outboxEvent.create({ data: { aggregateType: "SupplierProfile", aggregateId: supplierId, eventType: "SupplierStorefrontUpdated", payload: { supplierOrganizationId: supplierId, version: expectedVersion + 1 } } });
  }

  async save(supplierId: string, input: SaveSupplierStorefront, context: SupplierActorContext) {
    await this.member(supplierId, context, true);
    await this.prisma.$transaction(tx => this.update(tx, supplierId, context, input.expectedVersion, { storefrontContent: input.content }));
    return this.current(supplierId, context);
  }

  async uploadLogo(supplierId: string, input: UploadSupplierLogo, context: SupplierActorContext) {
    await this.member(supplierId, context, true);
    const profile = await this.profile(supplierId);
    if (profile.storefrontVersion !== input.expectedVersion) throw conflict();
    const asset = await this.uploads.quarantine({ organizationId: supplierId, actorId: context.actorId, purpose: "supplier-storefront-logo", fileName: input.fileName,
      body: this.uploads.decodeBase64(input.contentBase64, AVATAR_MAX_BYTES), allowedKinds: ["PNG", "JPEG"], maxBytes: AVATAR_MAX_BYTES });
    try {
      await this.prisma.$transaction(async tx => {
        await this.update(tx, supplierId, context, input.expectedVersion, { storefrontLogoAssetId: asset.id });
        await tx.uploadAsset.update({ where: { id: asset.id }, data: { metadata: { storefrontSupplierId: supplierId } } });
        if (profile.storefrontLogoAssetId) await tx.uploadAsset.updateMany({ where: { id: profile.storefrontLogoAssetId, organizationId: supplierId, purpose: "supplier-storefront-logo" }, data: { metadata: Prisma.DbNull } });
      });
    } catch (error) { await this.uploads.release(asset.id, "Storefront logo was not linked"); throw error; }
    return this.current(supplierId, context);
  }

  async logo(supplierId: string, context?: SupplierActorContext) {
    if (context) await this.member(supplierId, context, false);
    else await this.publicPage(supplierId);
    const profile = await this.profile(supplierId);
    if (!profile.storefrontLogoAssetId) throw new NotFoundException("Логотип не добавлен");
    const asset = await this.prisma.uploadAsset.findFirst({ where: {
      id: profile.storefrontLogoAssetId, organizationId: supplierId, purpose: "supplier-storefront-logo", status: "CLEAN", deletedAt: null,
      metadata: { equals: { storefrontSupplierId: supplierId } },
    }, select: { detectedMime: true, storageKey: true } });
    if (!asset || !["image/png", "image/jpeg"].includes(asset.detectedMime ?? "")) throw new NotFoundException("Логотип недоступен");
    return { contentType: asset.detectedMime!, contentBase64: (await this.storage.get(asset.storageKey)).toString("base64") };
  }
}
