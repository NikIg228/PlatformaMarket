import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { workspaceFixture } from "./workspace-session";

export async function operationQueueFixture() {
  const target = new URL(process.env.DATABASE_URL!);
  const database = process.env.GITHUB_ACTIONS === "true" ? "marketplace" : "dentmarket_audit_20260914";
  if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== `/${database}` || target.port !== "5432") throw new Error("Queue tests require the approved disposable DB");
  const db = new PrismaClient();
  const [identity] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (identity.name !== database) { await db.$disconnect(); throw new Error("Wrong test database identity"); }
  const key = randomUUID(), prefix = `queue-${key}`, orgIds: string[] = [], userIds: string[] = [];
  const cleanup = async () => {
    await db.auditLog.deleteMany({ where: { organizationId: { in: orgIds } } });
    for (const org of orgIds) await db.idempotencyRecord.deleteMany({ where: { scope: { startsWith: `operation.assign:${org}:` } } });
    await db.operationAssignment.deleteMany({ where: { operatorOrganizationId: { in: orgIds } } });
    await db.productCandidate.deleteMany({ where: { supplierOrganizationId: { in: orgIds } } });
    await db.supplierExternalItem.deleteMany({ where: { supplierOrganizationId: { in: orgIds } } });
    await db.importBatch.deleteMany({ where: { supplierOrganizationId: { in: orgIds } } });
    await db.supplierDataSource.deleteMany({ where: { supplierOrganizationId: { in: orgIds } } });
    await db.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await db.organizationMembership.deleteMany({ where: { userId: { in: userIds } } });
    await db.role.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.organizationProfile.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.address.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.supplierProfile.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.organizationCapability.deleteMany({ where: { organizationId: { in: orgIds } } });
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
  };
  try {
    const createOrganization = async (capability: "MARKETPLACE_OPERATOR" | "SUPPLIER" | "BUYER", digit: number) => {
      const org = await db.organization.create({ data: { bin: `95${digit}${Date.now().toString().slice(-9)}`, legalName: prefix, displayName: `${capability} ${prefix}`, capabilities: { create: { capability } }, ...(capability === "SUPPLIER" ? { supplierProfile: { create: {} } } : {}) } });
      orgIds.push(org.id); return org;
    };
    const operatorOrg = await createOrganization("MARKETPLACE_OPERATOR", 1), otherOrg = await createOrganization("MARKETPLACE_OPERATOR", 2), supplier = await createOrganization("SUPPLIER", 3), buyer = await createOrganization("BUYER", 4);
    const actor = async (org: typeof operatorOrg, capability: "MARKETPLACE_OPERATOR" | "BUYER", permissions: string[], name: string) => {
      const user = await db.user.create({ data: { email: `${name}-${key}@example.invalid`, displayName: name, emailVerifiedAt: new Date() } }); userIds.push(user.id);
      const role = await db.role.create({ data: { organizationId: org.id, code: name, name, permissions: { create: permissions.map(code => ({ permission: { connect: { code } } })) } } });
      await db.organizationMembership.create({ data: { userId: user.id, organizationId: org.id, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
      const session = await workspaceFixture(db, capability, { userId: user.id, organizationId: org.id, displayName: name });
      return { user, org, role, session, headers: { authorization: `Bearer ${session.accessToken}` } };
    };
    const manager = await actor(operatorOrg, "MARKETPLACE_OPERATOR", ["organization.view", "support.ticket.manage", "notification.view"], "QueueManager");
    const reader = await actor(operatorOrg, "MARKETPLACE_OPERATOR", ["organization.view"], "QueueReader");
    const denied = await actor(operatorOrg, "MARKETPLACE_OPERATOR", [], "QueueDenied");
    const other = await actor(otherOrg, "MARKETPLACE_OPERATOR", ["organization.view", "support.ticket.manage"], "QueueOther");
    const outsider = await actor(buyer, "BUYER", ["organization.view", "support.ticket.manage"], "QueueBuyer");
    const source = await db.supplierDataSource.create({ data: { supplierOrganizationId: supplier.id, name: prefix, type: "CSV" } });
    const candidateIds = Array.from({ length: 60 }, () => randomUUID()), importIds = Array.from({ length: 60 }, () => randomUUID()), externalIds = Array.from({ length: 60 }, () => randomUUID());
    const at = new Date("2026-10-16T00:00:00Z");
    await db.supplierExternalItem.createMany({ data: externalIds.map((id, i) => ({ id, supplierOrganizationId: supplier.id, sourceId: source.id, externalId: `${prefix}-${i}`, name: `Товар ${i}`, normalizedName: `товар ${i}`, rawData: {} })) });
    await db.productCandidate.createMany({ data: candidateIds.map((id, i) => ({ id, supplierOrganizationId: supplier.id, externalItemId: externalIds[i], proposedName: `${prefix} товар ${i}`, proposedSku: `SKU-${key}-${i}`, createdAt: at, updatedAt: at })) });
    await db.importBatch.createMany({ data: importIds.map((id, i) => ({ id, supplierOrganizationId: supplier.id, sourceId: source.id, fileName: `${prefix} файл ${i}${i === 59 ? " 100%_literal" : ""}.csv`, fileType: "CSV" as const, status: "REVIEW_REQUIRED" as const, createdAt: at, updatedAt: at })) });
    return { db, prefix, key, supplier, manager, reader, denied, other, outsider, candidateIds, importIds, at,
      dispose: async () => { try { await cleanup(); } finally { await db.$disconnect(); } } };
  } catch (error) { try { await cleanup(); } finally { await db.$disconnect(); } throw error; }
}
