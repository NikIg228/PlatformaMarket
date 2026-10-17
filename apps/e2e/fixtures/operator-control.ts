import { PrismaClient } from "@prisma/client";
import { randomInt, randomUUID } from "node:crypto";
import { workspaceFixture } from "./workspace-session";
export async function operatorControlFixture() {
  const expected = process.env.GITHUB_ACTIONS === "true" ? "marketplace" : "dentmarket_audit_20260914", target = new URL(process.env.DATABASE_URL!);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.pathname !== `/${expected}`) throw new Error("Disposable operator control DB required");
  const db = new PrismaClient(), run = randomUUID(), orgIds: string[] = [], userIds: string[] = [], eventIds: string[] = [], keys: string[] = [];
  const [identity] = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  if (identity.name !== expected) { await db.$disconnect(); throw new Error("Wrong database identity"); }
  const dispose = async () => {
    try {
      await db.auditLog.deleteMany({ where: { OR: [{ entityId: { in: [run, ...eventIds] } }, { organizationId: { in: orgIds } }] } });
      await db.idempotencyRecord.deleteMany({ where: { scope: "outbox.dead-letter.replay", key: { in: keys } } });
      await db.outboxEvent.deleteMany({ where: { id: { in: eventIds } } });
      await db.authSession.deleteMany({ where: { userId: { in: userIds } } });
      await db.organizationMembership.deleteMany({ where: { userId: { in: userIds } } });
      await db.role.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.organizationProfile.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.address.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.organizationCapability.deleteMany({ where: { organizationId: { in: orgIds } } });
      await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    } finally { await db.$disconnect(); }
  };
  try {
    const actor = async (capability: "MARKETPLACE_OPERATOR" | "SUPPLIER", permissions: string[], label: string) => {
      const org = await db.organization.create({ data: { bin: String(randomInt(100_000_000_000, 999_999_999_999)), legalName: `Control ${run} ${label}`, displayName: `Организация ${label}`, capabilities: { create: { capability } } } }); orgIds.push(org.id);
      const user = await db.user.create({ data: { email: `control-${label}-${run}@example.invalid`, displayName: `Сотрудник ${label}`, emailVerifiedAt: new Date() } }); userIds.push(user.id);
      const role = await db.role.create({ data: { organizationId: org.id, code: "control", name: "Control fixture", permissions: { create: permissions.map(code => ({ permission: { connect: { code } } })) } } });
      const member = await db.organizationMembership.create({ data: { userId: user.id, organizationId: org.id, status: "ACTIVE", roles: { create: { roleId: role.id } } } });
      const session = await workspaceFixture(db, capability, { userId: user.id, organizationId: org.id, displayName: org.displayName });
      return { org, user, role, member, session, headers: { authorization: `Bearer ${session.accessToken}` } };
    };
    const permissions = ["audit.view", "operations.outbox.view", "operations.outbox.replay", "catalog.product.moderate", "notification.view", "order.confirm", "organization.view", "support.ticket.view"];
    const manager = await actor("MARKETPLACE_OPERATOR", permissions, "manager"), reader = await actor("MARKETPLACE_OPERATOR", ["audit.view", "operations.outbox.view"], "reader"), outsider = await actor("SUPPLIER", permissions, "outsider"), denied = await actor("MARKETPLACE_OPERATOR", ["organization.view"], "denied");
    await db.auditLog.createMany({ data: Array.from({ length: 27 }, (_, index) => ({ organizationId: index % 2 ? manager.org.id : outsider.org.id, actorId: manager.user.id, entityType: "SupplierOrder", entityId: run, action: "control.test.confirmed", createdAt: new Date("2026-10-17T00:00:00Z"), before: { status: "AWAITING_CONFIRMATION", version: 1, password: "PRIVATE_PASSWORD" }, after: { status: "CONFIRMED", version: 2, payload: { token: "PRIVATE_TOKEN" }, email: "PRIVATE_EMAIL", lastError: "PRIVATE_ERROR" }, ipAddress: "PRIVATE_IP", userAgent: "PRIVATE_AGENT", correlationId: "PRIVATE_CORRELATION" })) });
    for (const createdAt of [new Date("2026-10-16T18:59:59Z"), new Date("2026-10-17T19:00:00Z")]) await db.auditLog.create({ data: { entityType: "SupplierOrder", entityId: run, action: "outside.period", organizationId: manager.org.id, createdAt } });
    const eventType = `control.${run}`;
    for (let index = 0; index < 2; index++) { const event = await db.outboxEvent.create({ data: { aggregateType: "CONTROL_TEST", aggregateId: run, eventType, payload: { private: "PRIVATE_PAYLOAD", amount: "9007199254740993" }, status: "DEAD_LETTER", attempts: 10, lastError: "PRIVATE_PROVIDER_TOKEN" } }); eventIds.push(event.id); }
    const key = () => { const value = randomUUID(); keys.push(value); return value; };
    return { db, run, manager, reader, outsider, denied, eventIds, eventType, key, dispose };
  } catch (error) { await dispose(); throw error; }
}
