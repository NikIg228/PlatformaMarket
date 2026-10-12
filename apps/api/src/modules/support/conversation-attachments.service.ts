import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma, type UploadAsset } from "@prisma/client";
import { CONVERSATION_FILE_MAX_BYTES, conversationAttachmentSchema, type UploadConversationAttachmentInput, type ConversationAttachment } from "@marketplace/schemas";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { FileUploadPolicyService } from "../../platform/security/file-upload-policy.service";
import { ObjectStorageService } from "../../platform/storage/object-storage.service";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";

type Context = { contextType: string; contextId: string };
const lifetime = 60 * 60_000;
const pending = (context: Context) => ({ conversationPending: true, contextType: context.contextType, contextId: context.contextId });
const linked = (context: Context, conversationId: string, messageId: string) => ({ conversationId, conversationMessageId: messageId, contextType: context.contextType, contextId: context.contextId });
const expired = { conversationExpired: true };
const descriptor = (asset: UploadAsset) => conversationAttachmentSchema.parse({ assetId: asset.id, name: asset.originalName, contentType: asset.detectedMime, sizeBytes: asset.sizeBytes });

/** ConversationsService authorizes the conversation before any upload/read here. */
@Injectable()
export class ConversationAttachmentsService {
  constructor(private readonly prisma: PrismaService, private readonly uploads: FileUploadPolicyService, private readonly storage: ObjectStorageService) {}

  async upload(input: UploadConversationAttachmentInput, actor: SupplierActorContext) {
    const asset = await this.uploads.quarantine({ ...actor, purpose: "conversation", fileName: input.fileName,
      body: this.uploads.decodeBase64(input.contentBase64, CONVERSATION_FILE_MAX_BYTES),
      allowedKinds: ["PNG", "JPEG", "PDF"], maxBytes: CONVERSATION_FILE_MAX_BYTES });
    try {
      await this.prisma.uploadAsset.update({ where: { id: asset.id }, data: { metadata: pending(input) } });
      return { ...descriptor(asset), expiresAt: new Date(asset.createdAt.getTime() + lifetime).toISOString() };
    } catch (error) {
      await this.uploads.release(asset.id, "Conversation upload could not be prepared");
      throw error;
    }
  }

  /** Asset claim, message, audit and outbox commit/roll back in the same transaction. */
  async link(tx: Prisma.TransactionClient, references: { assetId: string }[], actor: SupplierActorContext, context: Context, conversationId: string, messageId: string) {
    for (const reference of references) {
      const changed = await tx.uploadAsset.updateMany({ where: { id: reference.assetId, organizationId: actor.organizationId,
        uploadedById: actor.actorId, purpose: "conversation", status: "CLEAN", deletedAt: null,
        createdAt: { gt: new Date(Date.now() - lifetime) }, metadata: { equals: pending(context) } },
      data: { metadata: linked(context, conversationId, messageId) } });
      if (changed.count !== 1) throw new ConflictException("Вложение недоступно для этого диалога или срок загрузки истёк. Удалите его и прикрепите заново.");
    }
  }

  private where(conversationId: string, messageIds: string[]): Prisma.UploadAssetWhereInput {
    return { purpose: "conversation", AND: [{ metadata: { path: ["conversationId"], equals: conversationId } },
      { OR: messageIds.map(id => ({ metadata: { path: ["conversationMessageId"], equals: id } })) }] };
  }

  async sameReferences(tx: Prisma.TransactionClient, conversationId: string, messageId: string, references: { assetId: string }[]) {
    // Retain replay identity even if storage later becomes unavailable.
    const assets = await tx.uploadAsset.findMany({ where: this.where(conversationId, [messageId]), select: { id: true } });
    return assets.length === references.length && assets.every(asset => references.some(file => file.assetId === asset.id));
  }

  async list(conversationId: string, messageIds: string[]) {
    const result = new Map<string, ConversationAttachment[]>();
    if (!messageIds.length) return result;
    const assets = await this.prisma.uploadAsset.findMany({ where: this.where(conversationId, messageIds), orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    for (const asset of assets) {
      const messageId = (asset.metadata as { conversationMessageId: string }).conversationMessageId;
      result.set(messageId, [...(result.get(messageId) ?? []), descriptor(asset)]);
    }
    return result;
  }

  async download(context: Context, conversationId: string, messageId: string, assetId: string) {
    const asset = await this.prisma.uploadAsset.findFirst({ where: { id: assetId, purpose: "conversation", status: "CLEAN", deletedAt: null,
      metadata: { equals: linked(context, conversationId, messageId) } } });
    if (!asset) throw new NotFoundException("Вложение не найдено");
    return { attachment: descriptor(asset), body: await this.storage.get(asset.storageKey) };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupPending() {
    const where: Prisma.UploadAssetWhereInput = { purpose: "conversation", status: { in: ["CLEAN", "QUARANTINED"] },
      OR: [{ metadata: { path: ["conversationPending"], equals: true }, createdAt: { lt: new Date(Date.now() - lifetime) } }, { metadata: { equals: expired } }] };
    const assets = await this.prisma.uploadAsset.findMany({ where, select: { id: true }, take: 100 });
    let deleted = 0;
    for (const asset of assets) {
      const claim = await this.prisma.uploadAsset.updateMany({ where: { ...where, id: asset.id }, data: { metadata: expired } });
      if (claim.count !== 1) continue;
      try { await this.uploads.release(asset.id, "Unsubmitted conversation attachment expired"); deleted++; }
      catch { /* Retry storage deletion next hour; a linked file cannot match this claim. */ }
    }
    return { scanned: assets.length, deleted };
  }
}
