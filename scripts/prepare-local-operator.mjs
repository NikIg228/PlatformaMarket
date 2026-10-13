import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localDatabaseProfile, databaseLabel } from "./lib/local-database-profile.mjs";
import { passwordHash, passwordMatches } from "../apps/api/src/modules/identity/password-codec.ts";

// Owner-authorized local account provisioning, never a schema/production seed.
if (!process.argv.includes("--apply")) throw new Error("Use --apply only for the authorized local operator account.");
const { databaseUrl } = localDatabaseProfile();
const target = new URL(databaseUrl);
if (target.pathname !== "/marketplace" || target.port !== "5432" || target.search !== "?schema=public") throw new Error("Expected the canonical local marketplace database on port 5432.");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, ".tmp", "local-runtime");
const credentialsPath = path.join(directory, "operator-preview.json");
const receiptPath = path.join(directory, "OPERATOR-LOGIN.md");
await mkdir(directory, { recursive: true });
let account;
try { account = JSON.parse(await readFile(credentialsPath, "utf8")); }
catch (error) {
  if (error.code !== "ENOENT") throw error;
  account = { database: databaseLabel(databaseUrl), email: "operator-preview@example.invalid", password: randomBytes(24).toString("base64url") };
  await writeFile(credentialsPath, JSON.stringify(account, null, 2) + "\n", { flag: "wx", mode: 0o600 });
}
if (account.database !== databaseLabel(databaseUrl) || account.email !== "operator-preview@example.invalid" || typeof account.password !== "string" || account.password.length < 24) throw new Error("Local account receipt does not match the intended target.");
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  const [{ name }] = await db.$queryRaw`SELECT current_database() AS name`;
  if (name !== "marketplace") throw new Error("Connected database identity mismatch.");
  const result = await db.$transaction(async tx => {
    const organization = await tx.organization.findUnique({ where: { bin: "000000000001" }, include: { capabilities: true } });
    if (!organization || organization.status !== "ACTIVE" || !organization.capabilities.some(item => item.capability === "MARKETPLACE_OPERATOR")) throw new Error("Existing active operator organization is required; no organization was changed.");
    const role = await tx.role.findUnique({ where: { organizationId_code: { organizationId: organization.id, code: "platform_operator" } }, include: { permissions: { include: { permission: true } } } });
    const permissions = new Set(role?.permissions.map(item => item.permission.code));
    if (!role || ["organization.view", "support.ticket.view", "support.ticket.create", "support.ticket.manage", "notification.view"].some(code => !permissions.has(code))) throw new Error("Existing operator role is incomplete; permissions were not changed.");
    const existing = await tx.user.findUnique({ where: { email: account.email }, include: { memberships: { include: { roles: true } } } });
    if (existing) {
      const member = existing.memberships.find(item => item.organizationId === organization.id && item.status === "ACTIVE" && item.roles.some(link => link.roleId === role.id));
      if (!member || existing.status !== "ACTIVE" || !existing.emailVerifiedAt || !passwordMatches(account.password, existing.passwordHash)) throw new Error("Existing account differs from its receipt; nothing was overwritten.");
      return { created: false, userId: existing.id, organizationId: organization.id };
    }
    const user = await tx.user.create({ data: { email: account.email, displayName: "Оператор PlatformaMarket", passwordHash: passwordHash(account.password), emailVerifiedAt: new Date(), memberships: { create: { organizationId: organization.id, status: "ACTIVE", isPrimary: true, acceptedAt: new Date(), roles: { create: { roleId: role.id } } } } } });
    await tx.auditLog.create({ data: { actorId: user.id, organizationId: organization.id, action: "operator.local_account.provisioned", entityType: "User", entityId: user.id, after: { purpose: "owner_admin_preview" } } });
    return { created: true, userId: user.id, organizationId: organization.id };
  });
  await writeFile(receiptPath, `# Локальный оператор PlatformaMarket\n\nВход: http://127.0.0.1:3000/admin/login\n\nЛогин: ${account.email}\n\nПароль: ${account.password}\n\nТолько локальная БД ${account.database}. Файл не включается в Git.\n`, { mode: 0o600 });
  console.log(JSON.stringify({ ...result, database: databaseLabel(databaseUrl), credentialsFile: receiptPath }));
} finally { await db.$disconnect(); }
