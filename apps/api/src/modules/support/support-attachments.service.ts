import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma, type UploadAsset } from "@prisma/client";
import { SUPPORT_FILE_MAX_BYTES, supportAttachmentSchema, type UploadSupportAttachmentInput } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { FileUploadPolicyService } from "../../platform/security/file-upload-policy.service";
import { ObjectStorageService } from "../../platform/storage/object-storage.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";

const pending = { supportPending: true };
const expired = { supportExpired: true };
const lifetime = 60 * 60_000;
const descriptor = (asset: UploadAsset) => supportAttachmentSchema.parse({ assetId: asset.id, name: asset.originalName, contentType: asset.detectedMime, sizeBytes: asset.sizeBytes });

@Injectable()
export class SupportAttachmentsService {
  constructor(private readonly prisma: PrismaService, private readonly uploads: FileUploadPolicyService, private readonly storage: ObjectStorageService) {}

  async upload(input: UploadSupportAttachmentInput, context: SupplierActorContext) {
    const asset = await this.uploads.quarantine({ ...context, purpose: "support", fileName: input.fileName,
      body: this.uploads.decodeBase64(input.contentBase64, SUPPORT_FILE_MAX_BYTES),
      allowedKinds: ["PNG", "JPEG", "PDF", "DOCX", "XLSX"], maxBytes: SUPPORT_FILE_MAX_BYTES });
    try {
      await this.prisma.uploadAsset.update({ where: { id: asset.id }, data: { metadata: pending } });
      return { ...descriptor(asset), expiresAt: new Date(asset.createdAt.getTime() + lifetime).toISOString() };
    } catch (error) {
      await this.uploads.release(asset.id, "Support upload could not be prepared");
      throw error;
    }
  }

  /** Conditional claim and message write share the caller's transaction. */
  async link(tx: Prisma.TransactionClient, references: { assetId: string }[], context: SupplierActorContext, ticketId: string, messageId: string) {
    const result = [];
    for (const reference of references) {
      const changed = await tx.uploadAsset.updateMany({ where: { id: reference.assetId, organizationId: context.organizationId,
        uploadedById: context.actorId, purpose: "support", status: "CLEAN", deletedAt: null,
        createdAt: { gt: new Date(Date.now() - lifetime) }, metadata: { equals: pending } },
      data: { metadata: { supportTicketId: ticketId, supportMessageId: messageId } } });
      if (changed.count !== 1) throw new ConflictException("Вложение недоступно или срок загрузки истёк. Удалите его и прикрепите заново.");
      result.push(descriptor(await tx.uploadAsset.findUniqueOrThrow({ where: { id: reference.assetId } })));
    }
    return result;
  }

  async download(ticketId: string, messageId: string, assetId: string, context: SupplierActorContext) {
    const operator = Boolean(await this.prisma.organizationCapability.findUnique({ where: { organizationId_capability: { organizationId: context.organizationId, capability: "MARKETPLACE_OPERATOR" } } }));
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id: ticketId, ...(operator ? {} : { organizationId: context.organizationId }) }, select: { id: true } });
    if (!ticket) throw new NotFoundException("Вложение не найдено");
    const message = await this.prisma.supportMessage.findFirst({ where: { id: messageId, ticketId, isInternal: operator ? undefined : false } });
    if (!message) throw new NotFoundException("Вложение не найдено");
    const attachments = supportAttachmentSchema.array().safeParse(message.attachments);
    if (!attachments.success || !attachments.data.some(file => file.assetId === assetId)) throw new NotFoundException("Вложение не найдено");
    const asset = await this.prisma.uploadAsset.findFirst({ where: { id: assetId, purpose: "support", status: "CLEAN", deletedAt: null,
      metadata: { equals: { supportTicketId: ticketId, supportMessageId: messageId } } } });
    if (!asset) throw new NotFoundException("Вложение не найдено");
    return { attachment: descriptor(asset), body: await this.storage.get(asset.storageKey) };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupPending() {
    const where: Prisma.UploadAssetWhereInput = { purpose: "support", status: { in: ["CLEAN", "QUARANTINED"] },
      OR: [{ metadata: { equals: pending }, createdAt: { lt: new Date(Date.now() - lifetime) } }, { metadata: { equals: expired } }] };
    const assets = await this.prisma.uploadAsset.findMany({ where, select: { id: true }, take: 100 });
    let deleted = 0;
    for (const asset of assets) {
      // A competing message claim wins or loses atomically; linked assets cannot be deleted.
      const claim = await this.prisma.uploadAsset.updateMany({ where: { ...where, id: asset.id }, data: { metadata: expired } });
      if (claim.count !== 1) continue;
      try { await this.uploads.release(asset.id, "Unsubmitted support attachment expired"); deleted++; }
      catch { /* Keep the expired marker so the next cleanup retries failed storage deletion. */ }
    }
    return { scanned: assets.length, deleted };
  }
}
