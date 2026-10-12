import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { expect, it, vi } from "vitest";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { AccessControlService } from "../access-control/access-control.service";
import { FileUploadPolicyService } from "../../platform/security/file-upload-policy.service";
import { MediaAccessService } from "../../platform/storage/media-access.service";
import { ConversationAttachmentsService } from "./conversation-attachments.service";
import { ConversationsService } from "./conversations.service";

it.skipIf(!process.env.POSTGRES_TEST_DATABASE_URL)("conversation files: parties, context, replay, races, rollback, read and operator access", async () => {
  const target = new URL(process.env.POSTGRES_TEST_DATABASE_URL!);
  expect(["localhost", "127.0.0.1"]).toContain(target.hostname);
  expect(target.pathname).toBe("/dentmarket_audit_20260914");
  expect(process.env.DATABASE_URL).toBe(process.env.POSTGRES_TEST_DATABASE_URL);
  vi.stubEnv("ACCESS_CONTROL_MODE", "ROLE_BASED");
  const db = new PrismaClient();
  const actors = Array.from({ length: 4 }, () => ({ organizationId: randomUUID(), actorId: randomUUID() }));
  const [buyer, supplier, operator, outsider] = actors;
  const organizations = actors.map(actor => actor.organizationId), users = actors.map(actor => actor.actorId);
  const productId = randomUUID(), variantId = randomUUID(), offerId = randomUUID();
  const scope = { contextType: "OFFER" as const, contextId: offerId };
  const objects = new Map<string, Buffer>();
  const storage = { put: vi.fn(async (key: string, body: Buffer) => { objects.set(key, body); }), delete: vi.fn(async (key: string) => { objects.delete(key); }), get: vi.fn(async (key: string) => objects.get(key) ?? Buffer.from("%PDF-1.7")) };
  const policy = new FileUploadPolicyService(db as unknown as PrismaService, storage as never, { scan: async () => ({ provider: "synthetic-test" }) } as never);
  const files = new ConversationAttachmentsService(db as unknown as PrismaService, policy, storage as never);
  const access = new AccessControlService(db as unknown as PrismaService), media = new MediaAccessService();
  const service = new ConversationsService(db as unknown as PrismaService, access, files, media);
  const makeFile = async (owner = buyer, patch: Record<string, unknown> = {}) => {
    const asset = await db.uploadAsset.create({ data: { organizationId: owner.organizationId, uploadedById: owner.actorId, purpose: "conversation",
      storageKey: `synthetic/conversation/${randomUUID()}`, originalName: "Документ.pdf", safeName: "document.pdf", declaredMime: "application/pdf", detectedMime: "application/pdf", sizeBytes: 8,
      checksumSha256: "synthetic", status: "CLEAN", metadata: { conversationPending: true, ...scope }, ...patch } });
    return { assetId: asset.id };
  };
  try {
    expect((await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`)[0].name).toBe("dentmarket_audit_20260914");
    for (const [index, actor] of actors.entries()) {
      await db.organization.create({ data: { id: actor.organizationId, legalName: "Synthetic conversation", displayName: `Conversation party ${index}`, bin: `${Date.now()}`.slice(-11) + index,
        capabilities: { create: { capability: index === 1 ? "SUPPLIER" : index === 2 ? "MARKETPLACE_OPERATOR" : "BUYER" } } } });
      await db.user.create({ data: { id: actor.actorId, email: `conversation-${actor.actorId}@example.invalid`, displayName: `Employee ${index}` } });
      const role = await db.role.create({ data: { organizationId: actor.organizationId, code: "messages-test", name: "Conversation test",
        permissions: { create: ["support.ticket.view", "support.ticket.create", ...(index === 2 ? ["support.ticket.manage"] : [])].map(code => ({ permission: { connect: { code } } })) } } });
      await db.organizationMembership.create({ data: { userId: actor.actorId, organizationId: actor.organizationId, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
    }
    await db.supplierProfile.create({ data: { organizationId: supplier.organizationId } });
    await db.product.create({ data: { id: productId, canonicalName: "Synthetic composite", slug: `conversation-${productId}`, productType: "CONSUMABLE", status: "ACTIVE" } });
    await db.productVariant.create({ data: { id: variantId, productId, status: "ACTIVE", externalMetadata: { label: "A2" } } });
    await db.supplierOffer.create({ data: { id: offerId, supplierOrganizationId: supplier.organizationId, productVariantId: variantId, status: "ACTIVE", publication: { create: { status: "PUBLISHED", marketplaceVisible: true } } } });

    expect(await service.lookup(scope, buyer)).toMatchObject({ conversationId: null, context: { counterpartyName: "Conversation party 1", productName: "Synthetic composite", variantLabel: "A2" } });
    expect(await db.businessConversation.count({ where: { contextId: offerId } })).toBe(0);
    await expect(service.lookup(scope, supplier)).rejects.toThrow("Only a buyer");
    const uploaded = await service.uploadAttachment({ ...scope, fileName: "Документ.pdf", contentBase64: Buffer.from("%PDF-1.7").toString("base64") }, buyer);
    const input = { ...scope, body: "Question", idempotencyKey: randomUUID(), attachments: [{ assetId: uploaded.assetId }] };
    const [first, replay] = await Promise.all([service.start(input, buyer), service.start(input, buyer)]);
    expect(replay).toEqual(first);
    const id = first.conversationId;
    expect(await db.conversationMessage.count({ where: { conversationId: id } })).toBe(1);
    const detail = await service.get(id, supplier), message = detail.messages[0];
    expect(message.attachments).toEqual([{ assetId: uploaded.assetId, name: "Документ.pdf", contentType: "application/pdf", sizeBytes: 8 }]);
    expect((await service.lookup(scope, supplier)).context?.counterpartyName).toBe("Conversation party 0");
    expect((await service.downloadAttachment(id, message.id, uploaded.assetId, supplier)).body.toString()).toContain("%PDF");
    await expect(service.downloadAttachment(id, message.id, uploaded.assetId, outsider)).rejects.toThrow("Conversation not found");
    await expect(service.downloadAttachment(id, message.id, uploaded.assetId, operator)).rejects.toThrow("Conversation not found");
    await expect(service.downloadAttachment(id, randomUUID(), uploaded.assetId, buyer)).rejects.toThrow("Вложение не найдено");
    await expect(service.start({ ...input, attachments: [] }, buyer)).rejects.toThrow("different content");
    await service.read(id, message.sequence, supplier);
    expect((await service.get(id, buyer)).messages[0].readByCounterparty).toBe(true);

    const replyFile = await makeFile(supplier);
    const reply = { body: "", idempotencyKey: randomUUID(), attachments: [replyFile] };
    await Promise.all([service.send(id, reply, supplier), service.send(id, reply, supplier)]);
    expect(await db.conversationMessage.count({ where: { conversationId: id } })).toBe(2);
    expect((await service.list({ filter: "ALL", offset: 0, limit: 30 }, buyer)).items[0].lastMessage).toBe("Вложение");
    const second = (await service.get(id, buyer)).messages[1];
    await service.downloadAttachment(id, second.id, replyFile.assetId, buyer);
    for (const attachment of [replyFile, await makeFile(outsider), await makeFile({ ...buyer, actorId: supplier.actorId }),
      await makeFile(buyer, { status: "QUARANTINED" }), await makeFile(buyer, { purpose: "support" }),
      await makeFile(buyer, { createdAt: new Date(Date.now() - 3_600_001) }),
      await makeFile(buyer, { metadata: { conversationPending: true, ...scope, contextId: randomUUID() } })]) {
      await expect(service.send(id, { body: "Invalid", idempotencyKey: randomUUID(), attachments: [attachment] }, buyer)).rejects.toThrow("Вложение недоступно");
    }
    expect(await db.conversationMessage.count({ where: { conversationId: id } })).toBe(2);
    const rollbackFile = await makeFile();
    const rollback = new Proxy(db, { get(source, property) {
      if (property === "$transaction") return (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => db.$transaction(tx => callback(new Proxy(tx, { get(transaction, name) {
        return name === "outboxEvent" ? { create: async () => { throw new Error("Synthetic outbox failure"); } } : Reflect.get(transaction, name);
      } })));
      return Reflect.get(source, property);
    } });
    const rollbackService = new ConversationsService(rollback as unknown as PrismaService, access, files, media);
    const attempt = { body: "Rollback", idempotencyKey: randomUUID(), attachments: [rollbackFile] };
    await expect(rollbackService.send(id, attempt, buyer)).rejects.toThrow("Synthetic outbox failure");
    expect((await db.uploadAsset.findUniqueOrThrow({ where: { id: rollbackFile.assetId } })).metadata).toEqual({ conversationPending: true, ...scope });
    expect(await db.conversationMessage.count({ where: { conversationId: id } })).toBe(2);
    await service.send(id, attempt, buyer);
    const raceFile = await makeFile();
    const race = await Promise.allSettled([1, 2].map(() => service.send(id, { body: "Race", idempotencyKey: randomUUID(), attachments: [raceFile] }, buyer)));
    expect(race.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(race.filter(result => result.status === "rejected")).toHaveLength(1);
    const saved = await service.get(id, buyer);
    expect(saved.messages.map(item => item.sequence)).toEqual([1, 2, 3, 4]);
    await service.resolve(id, saved.conversation.version, buyer);
    await service.send(id, { body: "Reopen", idempotencyKey: randomUUID() }, supplier);
    expect((await service.get(id, buyer)).conversation.resolved).toBe(false);

    await db.organizationMembership.update({ where: { userId_organizationId: { userId: buyer.actorId, organizationId: buyer.organizationId } }, data: { status: "BLOCKED" } });
    await expect(service.downloadAttachment(id, message.id, uploaded.assetId, buyer)).rejects.toThrow("permission");
    await expect(service.uploadAttachment({ ...scope, fileName: "x.pdf", contentBase64: "JVBERi0=" }, buyer)).rejects.toThrow("permission");
    await db.organizationMembership.update({ where: { userId_organizationId: { userId: buyer.actorId, organizationId: buyer.organizationId } }, data: { status: "ACTIVE" } });
    await service.escalate(id, { reason: "Synthetic operator assistance", idempotencyKey: randomUUID() }, buyer);
    await service.downloadAttachment(id, message.id, uploaded.assetId, operator);
    const operatorRole = await db.role.findFirstOrThrow({ where: { organizationId: operator.organizationId } });
    await db.rolePermission.deleteMany({ where: { roleId: operatorRole.id, permission: { code: "support.ticket.manage" } } });
    await expect(service.downloadAttachment(id, message.id, uploaded.assetId, operator)).rejects.toThrow("Conversation not found");
    await files.cleanupPending();
    await service.downloadAttachment(id, message.id, uploaded.assetId, supplier);
  } finally {
    const conversations = (await db.businessConversation.findMany({ where: { contextId: offerId }, select: { id: true, supportTicketId: true } }));
    const ids = conversations.map(item => item.id), tickets = conversations.flatMap(item => item.supportTicketId ? [item.supportTicketId] : []);
    await db.conversationRead.deleteMany({ where: { conversationId: { in: ids } } });
    await db.conversationMessage.deleteMany({ where: { conversationId: { in: ids } } });
    await db.businessConversation.deleteMany({ where: { id: { in: ids } } });
    await db.supportMessage.deleteMany({ where: { ticketId: { in: tickets } } });
    await db.supportLink.deleteMany({ where: { ticketId: { in: tickets } } });
    await db.supportTicket.deleteMany({ where: { id: { in: tickets } } });
    await db.outboxEvent.deleteMany({ where: { aggregateId: { in: [...ids, ...tickets] } } });
    await db.auditLog.deleteMany({ where: { organizationId: { in: organizations } } });
    await db.uploadAsset.deleteMany({ where: { organizationId: { in: organizations } } });
    await db.supplierOffer.deleteMany({ where: { id: offerId } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.organization.deleteMany({ where: { id: { in: organizations } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect(); vi.unstubAllEnvs();
  }
}, 45_000);
