import assert from "node:assert/strict";
import { randomUUID, randomInt } from "node:crypto";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const url = process.env.POSTGRES_TEST_DATABASE_URL;
assert(url && url === process.env.DATABASE_URL, "Run through npm run db:test -- exec -- node scripts/verify-ai-actions.mjs");
const target = new URL(url);
assert(["127.0.0.1", "localhost"].includes(target.hostname) && target.pathname === "/dentmarket_audit_20260914" && (target.searchParams.get("schema") ?? "public") === "public", "Only the approved disposable database is allowed");
const require = createRequire(import.meta.url);
const { AiAssistantService } = require("../apps/api/dist/src/modules/ai/ai-assistant.service.js");
const { AiSafetyService } = require("../apps/api/dist/src/modules/ai/ai-safety.service.js");
const { AiToolsService } = require("../apps/api/dist/src/modules/ai/ai-tools.service.js");
const { PlatformAuthorityPolicy } = require("../apps/api/dist/src/modules/access-control/platform-authority.policy.js");
process.env.ACCESS_CONTROL_MODE = "ROLE_BASED";
const prisma = new PrismaClient({ datasourceUrl: url });
const peer = new PrismaClient({ datasourceUrl: url });
const orgId = randomUUID(), userId = randomUUID(), conversationId = randomUUID(), roleId = randomUUID();
const context = { actorId: userId, organizationId: orgId };
const safety = new AiSafetyService();
const entitlements = { resolve: async () => ({ enabled: true }) };
const model = { summarize: async () => null };
const makeService = db => {
  const authority = new PlatformAuthorityPolicy(db);
  return new AiAssistantService(db, entitlements, safety, new AiToolsService(db, authority), model, authority);
};
const service = makeService(prisma);
const confirm = (instance, id, actor = context) => instance.send(conversationId, { content: "Да", confirmedToolExecutionId: id }, actor);
const pending = async () => {
  const reply = await service.send(conversationId, { content: "Создай обращение: token=SYNTHETIC_AI_SECRET" }, context);
  assert(reply.requiresConfirmation);
  assert(!JSON.stringify(reply).includes("SYNTHETIC_AI_SECRET"));
  return reply.toolExecution.id;
};
const rejectStatus = async (operation, status) => assert.rejects(operation, error => error.getStatus?.() === status);
try {
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS db, current_schema() AS schema`;
  assert.equal(identity.db, "dentmarket_audit_20260914");
  assert.equal(identity.schema, "public");
  await prisma.user.create({ data: { id: userId, email: `ai-${userId}@example.invalid`, displayName: "AI test" } });
  await prisma.organization.create({ data: { id: orgId, legalName: "AI regression", displayName: "AI regression", commerceDataset: "TEST", bin: `99${String(randomInt(0, 1e10)).padStart(10, "0")}`, capabilities: { create: { capability: "BUYER" } } } });
  await prisma.role.create({ data: { id: roleId, organizationId: orgId, code: "ai_regression", name: "AI regression", permissions: { create: [{ permission: { connect: { code: "support.ticket.create" } } }] } } });
  await prisma.organizationMembership.create({ data: { userId, organizationId: orgId, status: "ACTIVE", roles: { create: { roleId } } } });
  await prisma.aiConversation.create({ data: { id: conversationId, userId, organizationId: orgId, role: "BUYER" } });
  const id = await pending();
  let readCount = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const raced = db => new Proxy(db, { get(client, key) {
    if (key === "aiToolExecution") return new Proxy(client.aiToolExecution, { get(delegate, method) {
      if (method === "findFirst") return async args => {
        const row = await delegate.findFirst(args);
        if (args.where.id === id) { if (++readCount === 2) release(); await barrier; }
        return row;
      };
      const value = Reflect.get(delegate, method); return typeof value === "function" ? value.bind(delegate) : value;
    } });
    const value = Reflect.get(client, key); return typeof value === "function" ? value.bind(client) : value;
  } });
  const outcomes = await Promise.allSettled([confirm(makeService(raced(prisma)), id), confirm(makeService(raced(peer)), id)]);
  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(outcomes.find(result => result.status === "rejected")?.reason.getStatus(), 409);
  assert.equal(await prisma.supportTicket.count({ where: { organizationId: orgId } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { organizationId: orgId, action: "support.ticket.ai_created" } }), 1);
  assert.equal((await prisma.aiToolExecution.findUniqueOrThrow({ where: { id } })).status, "SUCCEEDED");
  await rejectStatus(() => confirm(service, id), 404);
  const ticket = await prisma.supportTicket.findFirstOrThrow({ where: { organizationId: orgId } });
  assert(!ticket.description.includes("SYNTHETIC_AI_SECRET"));
  assert.equal(await prisma.supportMessage.count({ where: { ticketId: ticket.id } }), 1);

  const deniedId = await pending();
  await rejectStatus(() => confirm(service, deniedId, { ...context, organizationId: randomUUID() }), 404);
  await rejectStatus(() => confirm(service, deniedId, { ...context, actorId: randomUUID() }), 404);
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  await rejectStatus(() => confirm(service, deniedId), 403);
  assert.equal((await prisma.aiToolExecution.findUniqueOrThrow({ where: { id: deniedId } })).status, "AWAITING_CONFIRMATION");
  await prisma.rolePermission.create({ data: { roleId, permissionId: (await prisma.permission.findUniqueOrThrow({ where: { code: "support.ticket.create" } })).id } });
  await confirm(service, deniedId);
  assert.equal(await prisma.supportTicket.count({ where: { organizationId: orgId } }), 2);
  const failedId = await pending();
  const failingDb = new Proxy(prisma, { get(client, key) {
    if (key === "$transaction") return (callback, options) => client.$transaction(tx => callback(new Proxy(tx, { get(transaction, field) {
      if (field === "supportMessage") return { create: async () => { throw new Error("AI_TEST_MESSAGE_FAILURE"); } };
      return Reflect.get(transaction, field);
    } })), options);
    const value = Reflect.get(client, key); return typeof value === "function" ? value.bind(client) : value;
  } });
  await assert.rejects(() => confirm(makeService(failingDb), failedId), /AI_TEST_MESSAGE_FAILURE/);
  assert.equal((await prisma.aiToolExecution.findUniqueOrThrow({ where: { id: failedId } })).status, "FAILED");
  assert.equal(await prisma.supportTicket.count({ where: { organizationId: orgId } }), 2);
  assert.equal(await prisma.auditLog.count({ where: { organizationId: orgId, action: "support.ticket.ai_created" } }), 2);
  await rejectStatus(() => confirm(service, failedId), 404);
  console.log("AI PG PASS: two connections/one ticket+message+audit, replay, tenant/actor/permission denial, sanitized support content, ordinary confirmation, transaction rollback and no failed-action replay");
} finally {
  const tickets = await prisma.supportTicket.findMany({ where: { organizationId: orgId }, select: { id: true } });
  await prisma.supportMessage.deleteMany({ where: { ticketId: { in: tickets.map(row => row.id) } } });
  await prisma.supportTicket.deleteMany({ where: { organizationId: orgId } });
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
  await prisma.aiToolExecution.deleteMany({ where: { conversationId } });
  await prisma.aiMessage.deleteMany({ where: { conversationId } });
  await prisma.aiConversation.deleteMany({ where: { id: conversationId } });
  await prisma.organizationMembership.deleteMany({ where: { userId, organizationId: orgId } });
  await prisma.role.deleteMany({ where: { id: roleId } });
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await Promise.all([prisma.$disconnect(), peer.$disconnect()]);
}
