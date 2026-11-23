import { randomInt, randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { expect, it } from "vitest";
import { DocumentsService } from "./documents.service";

it.skipIf(!process.env.POSTGRES_TEST_DATABASE_URL)("signature completion is atomic, replayable and rejects revoked access and superseded versions", async () => {
  const url = new URL(process.env.POSTGRES_TEST_DATABASE_URL!);
  const database = process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_ENVIRONMENT === "github-hosted" ? "marketplace" : "dentmarket_audit_20260914";
  if (process.env.DATABASE_URL !== process.env.POSTGRES_TEST_DATABASE_URL || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== `/${database}`) throw new Error("Disposable signing database required");
  const db = new PrismaClient({ datasourceUrl: url.href });
  const actor = { actorId: randomUUID(), organizationId: randomUUID() };
  const docs: string[] = [];
  let roleId: string | undefined;
  const service = (client: object = db) => new DocumentsService(client as never, {} as never, {} as never, {} as never, {} as never);
  async function fixture() {
    const doc = await db.document.create({ data: { ownerOrganizationId: actor.organizationId, kind: "OTHER", format: "PDF", source: "GENERATED", status: "AWAITING_SIGNATURE", title: "Synthetic signing test", documentNumber: randomUUID(), storageKey: "synthetic/not-a-real-document", checksumSha256: "a".repeat(64), requiredSignatureCount: 1 } });
    docs.push(doc.id);
    const sig = await db.documentSignature.create({ data: { documentId: doc.id, signerOrganizationId: actor.organizationId, signerUserId: actor.actorId, method: "EDS", status: "SESSION_CREATED", externalSessionId: randomUUID(), expiresAt: new Date(Date.now() + 600000) } });
    return { doc, sig };
  }
  const input = { status: "SIGNED" as const, externalSignatureId: "synthetic-signature", signatureHash: "b".repeat(64), evidence: { synthetic: true } };
  try {
    await db.organization.create({ data: { id: actor.organizationId, legalName: "Synthetic signing", displayName: "Synthetic signing", bin: String(randomInt(100000000000, 999999999999)), commerceDataset: "TEST", status: "ACTIVE" } });
    await db.user.create({ data: { id: actor.actorId, email: `${actor.actorId}@example.invalid`, displayName: "Synthetic signer", status: "ACTIVE" } });
    const permission = await db.permission.findUniqueOrThrow({ where: { code: "document.sign" } });
    const role = await db.role.create({ data: { organizationId: actor.organizationId, code: randomUUID(), name: "Synthetic signer", permissions: { create: { permissionId: permission.id } } } });
    roleId = role.id;
    await db.organizationMembership.create({ data: { organizationId: actor.organizationId, userId: actor.actorId, status: "ACTIVE", roles: { create: { roleId } } } });
    const { doc, sig } = await fixture();
    const failed = new Proxy(db, { get(target, key) {
      if (key !== "$transaction") return Reflect.get(target, key);
      return (work: (tx: Prisma.TransactionClient) => Promise<unknown>) => db.$transaction(tx => work(new Proxy(tx, { get(inner, field) {
        if (field === "outboxEvent") return { create: async () => { throw new Error("synthetic outbox failure"); } };
        return Reflect.get(inner, field);
      } })));
    } });
    await expect(service(failed).completeSignature(sig.id, input, actor, true)).rejects.toThrow("synthetic outbox failure");
    expect((await db.documentSignature.findUniqueOrThrow({ where: { id: sig.id } })).status).toBe("SESSION_CREATED");
    expect((await db.document.findUniqueOrThrow({ where: { id: doc.id } })).status).toBe("AWAITING_SIGNATURE");
    expect(await db.auditLog.count({ where: { entityId: sig.id } })).toBe(0);
    const results = await Promise.all([service().completeSignature(sig.id, input, actor, true), service().completeSignature(sig.id, input, actor, true)]);
    expect(results.every(result => result.document.status === "SIGNED")).toBe(true);
    expect(await db.auditLog.count({ where: { entityId: sig.id, action: "document.signature.completed" } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { aggregateId: doc.id, eventType: "DocumentSigned" } })).toBe(1);
    await expect(service().completeSignature(sig.id, { ...input, signatureHash: "c".repeat(64) }, actor, true)).rejects.toThrow("conflicting terminal");
    const stale = await fixture();
    const next = await db.document.create({ data: { ownerOrganizationId: actor.organizationId, kind: "OTHER", format: "PDF", source: "GENERATED", title: "New synthetic version", documentNumber: stale.doc.documentNumber, version: 2, previousVersionId: stale.doc.id } });
    docs.push(next.id);
    await expect(service().completeSignature(stale.sig.id, input, actor, true)).rejects.toThrow("no longer available");
    const revoked = await fixture();
    await db.rolePermission.deleteMany({ where: { roleId } });
    await expect(service().completeSignature(revoked.sig.id, input, actor, true)).rejects.toThrow("no longer active");
    expect((await db.documentSignature.findUniqueOrThrow({ where: { id: revoked.sig.id } })).status).toBe("SESSION_CREATED");
  } finally {
    await db.outboxEvent.deleteMany({ where: { aggregateId: { in: docs } } });
    await db.auditLog.deleteMany({ where: { actorId: actor.actorId } });
    await db.documentSignature.deleteMany({ where: { documentId: { in: docs } } });
    await db.document.deleteMany({ where: { id: { in: docs }, previousVersionId: { not: null } } });
    await db.document.deleteMany({ where: { id: { in: docs } } });
    const memberships = await db.organizationMembership.findMany({ where: { organizationId: actor.organizationId }, select: { id: true } });
    await db.membershipRole.deleteMany({ where: { membershipId: { in: memberships.map(item => item.id) } } });
    await db.organizationMembership.deleteMany({ where: { organizationId: actor.organizationId } });
    if (roleId) { await db.rolePermission.deleteMany({ where: { roleId } }); await db.role.delete({ where: { id: roleId } }); }
    await db.user.deleteMany({ where: { id: actor.actorId } });
    await db.organization.deleteMany({ where: { id: actor.organizationId } });
    await db.$disconnect();
  }
}, 30000);
