import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { expect, it, vi } from "vitest";
import type { PrismaService } from "../../platform/prisma/prisma.service";
import { SupportService } from "./support.service";
import { SupportAttachmentsService } from "./support-attachments.service";
import { FileUploadPolicyService } from "../../platform/security/file-upload-policy.service";

it.skipIf(!process.env.POSTGRES_TEST_DATABASE_URL)("support attachments: atomic claim, tenant/private download, concurrent replay and rollback", async () => {
  const target = new URL(process.env.POSTGRES_TEST_DATABASE_URL!);
  expect(["localhost", "127.0.0.1"]).toContain(target.hostname);
  expect(target.pathname).toBe("/dentmarket_audit_20260914");
  expect(process.env.DATABASE_URL).toBe(process.env.POSTGRES_TEST_DATABASE_URL);
  const db = new PrismaClient();
  const customer = { organizationId: randomUUID(), actorId: randomUUID() };
  const operator = { organizationId: randomUUID(), actorId: randomUUID() };
  const other = { organizationId: randomUUID(), actorId: randomUUID() };
  const organizations = [customer, operator, other].map(item => item.organizationId);
  const objects = new Map<string, Buffer>();
  const storage = { put: vi.fn(async (key: string, body: Buffer) => { objects.set(key, body); }), delete: vi.fn(async (key: string) => { objects.delete(key); }), get: vi.fn(async (key: string) => objects.get(key) ?? Buffer.from("%PDF-1.7")) };
  const policy = new FileUploadPolicyService(db as unknown as PrismaService, storage as never, { scan: async () => ({ provider: "synthetic-test" }) } as never);
  const files = new SupportAttachmentsService(db as unknown as PrismaService, policy, storage as never);
  const service = new SupportService(db as unknown as PrismaService, { hasAll: async () => true } as never, files);
  const ids: string[] = [];
  const makeFile = async (owner = customer, patch: Record<string, unknown> = {}) => {
    const asset = await db.uploadAsset.create({ data: { organizationId: owner.organizationId, uploadedById: owner.actorId, purpose: "support", storageKey: `synthetic/support/${randomUUID()}`, originalName: "Документ.pdf", safeName: "document.pdf", declaredMime: "application/pdf", detectedMime: "application/pdf", sizeBytes: 8, checksumSha256: "synthetic", status: "CLEAN", metadata: { supportPending: true }, ...patch } });
    ids.push(asset.id); return { assetId: asset.id, name: "untrusted filename.pdf" };
  };
  try {
    expect((await db.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`)[0].name).toBe("dentmarket_audit_20260914");
    await db.organization.createMany({ data: organizations.map((id, index) => ({ id, legalName: "Synthetic support attachment", displayName: "Synthetic support attachment", bin: `${Date.now()}`.slice(-11) + index })) });
    await db.organizationCapability.create({ data: { organizationId: operator.organizationId, capability: "MARKETPLACE_OPERATOR" } });
    const uploaded = await files.upload({ fileName: "Документ.pdf", contentBase64: Buffer.from("%PDF-1.7").toString("base64") }, customer);
    ids.push(uploaded.assetId);
    const first = { assetId: uploaded.assetId, name: "untrusted filename.pdf" };
    expect((await db.uploadAsset.findUniqueOrThrow({ where: { id: first.assetId } })).metadata).toEqual({ supportPending: true });
    const create = { idempotencyKey: randomUUID(), subject: "Attachment fixture", description: "Synthetic attachment description", category: "GENERAL", priority: "NORMAL" as const, links: [], attachments: [first] };
    const ticket = await service.create(create, customer);
    expect((await service.create(create, customer)).id).toBe(ticket.id);
    const initial = (await service.get(ticket.id, customer)).messages[0];
    expect(initial.attachments[0].name).toBe("Документ.pdf");
    expect((await files.download(ticket.id, initial.id, first.assetId, operator)).body.toString()).toContain("%PDF");
    await expect(files.download(ticket.id, initial.id, first.assetId, other)).rejects.toThrow("Вложение не найдено");

    const replyFile = await makeFile();
    const reply = { idempotencyKey: randomUUID(), body: "", isInternal: false, attachments: [replyFile] };
    const [a, b] = await Promise.all([service.addMessage(ticket.id, reply, customer), service.addMessage(ticket.id, reply, customer)]);
    expect(a.id).toBe(b.id);
    expect(await db.supportMessage.count({ where: { ticketId: ticket.id } })).toBe(2);
    await expect(service.addMessage(ticket.id, { ...reply, idempotencyKey: randomUUID() }, customer)).rejects.toThrow("Вложение недоступно");
    for (const reference of [await makeFile(other), await makeFile({ ...customer, actorId: randomUUID() }), await makeFile(customer, { status: "QUARANTINED" }), await makeFile(customer, { purpose: "document" }), await makeFile(customer, { createdAt: new Date(Date.now() - 3_600_001) })]) {
      await expect(service.addMessage(ticket.id, { ...reply, idempotencyKey: randomUUID(), attachments: [reference] }, customer)).rejects.toThrow("Вложение недоступно");
    }
    const privateFile = await makeFile(operator);
    const internal = await service.addMessage(ticket.id, { ...reply, idempotencyKey: randomUUID(), body: "Private note", isInternal: true, attachments: [privateFile] }, operator);
    await expect(files.download(ticket.id, internal.id, privateFile.assetId, customer)).rejects.toThrow("Вложение не найдено");
    await files.download(ticket.id, internal.id, privateFile.assetId, operator);
    expect((await service.get(ticket.id, customer)).messages).toHaveLength(2);

    const rollbackFile = await makeFile();
    const rollback = new Proxy(db, { get(source, property) {
      if (property === "$transaction") return (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => db.$transaction(tx => callback(new Proxy(tx, { get(transaction, name) { return name === "outboxEvent" ? { create: async () => { throw new Error("Synthetic failure"); } } : Reflect.get(transaction, name); } })));
      return Reflect.get(source, property);
    } });
    const rollbackService = new SupportService(rollback as unknown as PrismaService, {} as never, files);
    const attempt = { ...reply, idempotencyKey: randomUUID(), attachments: [rollbackFile] };
    await expect(rollbackService.addMessage(ticket.id, attempt, customer)).rejects.toThrow("Synthetic failure");
    expect((await db.uploadAsset.findUniqueOrThrow({ where: { id: rollbackFile.assetId } })).metadata).toEqual({ supportPending: true });
    await service.addMessage(ticket.id, attempt, customer);
    // Different commands racing for one attachment can claim it only once.
    const concurrent = await makeFile();
    const results = await Promise.allSettled([1, 2].map(() => service.addMessage(ticket.id, { ...reply, idempotencyKey: randomUUID(), attachments: [concurrent] }, customer)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  } finally {
    const tickets = (await db.supportTicket.findMany({ where: { organizationId: { in: organizations } }, select: { id: true } })).map(ticket => ticket.id);
    await db.supportMessage.deleteMany({ where: { ticketId: { in: tickets } } });
    await db.supportLink.deleteMany({ where: { ticketId: { in: tickets } } });
    await db.outboxEvent.deleteMany({ where: { aggregateId: { in: tickets } } });
    await db.auditLog.deleteMany({ where: { organizationId: { in: organizations } } });
    await db.idempotencyRecord.deleteMany({ where: { OR: [customer, operator, other].map(actor => ({ scope: { contains: actor.actorId } })) } });
    await db.supportTicket.deleteMany({ where: { id: { in: tickets } } });
    await db.uploadAsset.deleteMany({ where: { id: { in: ids } } });
    await db.organization.deleteMany({ where: { id: { in: organizations } } });
    await db.$disconnect();
  }
}, 30_000);
