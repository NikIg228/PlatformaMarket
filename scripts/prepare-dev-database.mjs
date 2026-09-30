import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { passwordHash, passwordMatches } from "../apps/api/src/modules/identity/password-codec.ts";
import { localDatabaseProfile, databaseLabel } from "./lib/local-database-profile.mjs";
import { localDataReadiness } from "./lib/local-data-readiness.mjs";
import { localDevelopmentPermissions } from "./lib/local-development-permissions.mjs";

const { databaseUrl } = localDatabaseProfile();
const target = new URL(databaseUrl);
const directory = path.resolve(".tmp/local-runtime");
const env = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "development" };
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Use npm run db:prepare:dev.");
mkdirSync(directory, { recursive: true });
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const run = args => {
  const result = spawnSync(process.execPath, [npmCli, ...args], { env, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) throw new Error("Preparation stopped; the existing database and backup are retained.");
};

try {
  // Verify the target is reachable before any writes. This command never creates,
  // drops or resets a database and never touches the separate test database.
  await db.$queryRaw`SELECT 1`;
  const pgBin = process.env.POSTGRES_BIN_DIR ?? (process.platform === "win32" ? "C:/Program Files/PostgreSQL/17/bin" : "");
  const dump = path.join(directory, `dev-before-prepare-${Date.now()}.dump`);
  const toolEnv = { ...process.env, PGHOST: target.hostname, PGPORT: target.port || "5432", PGUSER: decodeURIComponent(target.username), PGPASSWORD: decodeURIComponent(target.password), PGDATABASE: decodeURIComponent(target.pathname.slice(1)), PGCONNECT_TIMEOUT: "5" };
  const tool = name => pgBin ? path.join(pgBin, process.platform === "win32" ? `${name}.exe` : name) : name;
  const backup = spawnSync(tool("pg_dump"), ["-w", "-Fc", "-f", dump], { env: toolEnv, windowsHide: true, encoding: "utf8" });
  if (backup.status !== 0) throw new Error("Backup failed; database unchanged. Check POSTGRES_BIN_DIR and local connection.");
  if (spawnSync(tool("pg_restore"), ["--list", dump], { env: toolEnv, windowsHide: true, stdio: "ignore" }).status !== 0) throw new Error("Backup archive could not be read; database unchanged.");
  console.log(`Preparing ${databaseLabel(databaseUrl)}; backup: ${dump}`);
  await db.$disconnect();
  run(["exec", "--workspace=@marketplace/api", "--", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"]);

  const products = await db.product.count();
  if (products === 0) {
    // Reuse the versioned PILOT catalog; never rebuild tracked source artifacts.
    run(["run", "db:seed:reference"]);
    run(["run", "db:seed:operator"]);
    run(["run", "catalog:sync-production:apply"]);
    run(["run", "db:seed:pilot"]);
  }
  const accountsFile = path.join(directory, "dev-accounts.json");
  const credentials = existsSync(accountsFile) ? JSON.parse(readFileSync(accountsFile, "utf8")) : {};
  if (credentials.database && credentials.database !== databaseLabel(databaseUrl)) throw new Error("Credentials belong to another database; preserve them and choose a separate local credentials file before preparing this target.");
  credentials.database = databaseLabel(databaseUrl);
  credentials.accounts ??= {};
  const profiles = [
    { key: "clinic", bin: "970000000001", capability: "BUYER", permissions: localDevelopmentPermissions.clinic },
    { key: "supplier", bin: "980000000001", capability: "SUPPLIER", permissions: localDevelopmentPermissions.supplier },
    { key: "operator", bin: "000000000001", capability: "MARKETPLACE_OPERATOR", permissions: null },
  ];
  // Persist newly generated credentials BEFORE the transaction so an interruption
  // cannot leave an account with an unknown password. Existing passwords stay intact.
  for (const profile of profiles) credentials.accounts[profile.key] ??= { email: `dev-${profile.key}@example.invalid`, password: randomBytes(24).toString("base64url") };
  writeFileSync(accountsFile, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  await db.$transaction(async tx => {
    for (const profile of profiles) {
      const account = credentials.accounts[profile.key];
      const organization = await tx.organization.findUniqueOrThrow({ where: { bin: profile.bin }, include: { capabilities: true } });
      if (!organization.capabilities.some(c => c.capability === profile.capability)) throw new Error(`Missing ${profile.key} capability; existing data retained.`);
      const existing = await tx.user.findUnique({ where: { email: account.email } });
      if (existing) {
        const membership = await tx.organizationMembership.findUnique({ where: { userId_organizationId: { userId: existing.id, organizationId: organization.id } } });
        if (!membership || membership.status !== "ACTIVE" || existing.status !== "ACTIVE" || !existing.emailVerifiedAt || !passwordMatches(account.password, existing.passwordHash)) throw new Error(`Existing dev ${profile.key} account needs review; it was not overwritten.`);
        continue;
      }
      const permissions = await tx.permission.findMany({ where: profile.permissions ? { code: { in: profile.permissions } } : {} });
      if (profile.permissions && permissions.length !== profile.permissions.length) throw new Error(`Missing permissions for ${profile.key}; run the reference profile explicitly after review.`);
      const role = await tx.role.upsert({ where: { organizationId_code: { organizationId: organization.id, code: `local_dev_${profile.key}` } }, update: {}, create: { organizationId: organization.id, code: `local_dev_${profile.key}`, name: `Local development ${profile.key}`, permissions: { create: permissions.map(p => ({ permissionId: p.id })) } } });
      const assigned = await tx.rolePermission.findMany({ where: { roleId: role.id }, select: { permissionId: true } });
      if (assigned.length !== permissions.length || permissions.some(permission => !assigned.some(item => item.permissionId === permission.id))) throw new Error(`Existing dev ${profile.key} role needs review; permissions were not overwritten.`);
      await tx.user.create({ data: { email: account.email, displayName: `Dev ${profile.key}`, passwordHash: passwordHash(account.password), emailVerifiedAt: new Date(), memberships: { create: { organizationId: organization.id, status: "ACTIVE", acceptedAt: new Date(), isPrimary: true, roles: { create: { roleId: role.id } } } } } });
    }
  });
  const readiness = await localDataReadiness(databaseUrl, process.env.PUBLIC_CATALOG_ORGANIZATION_ID);
  console.log(`Prepared: ${readiness.products} products. Login credentials: ${accountsFile}. Run npm run dev. Test DB unchanged.`);
} catch (error) {
  // Never print a Prisma connection error containing credentials or record data.
  console.error(error instanceof Error && !error.name.startsWith("Prisma") ? error.message : "Local preparation failed; inspect schema/profile and retain the backup.");
  process.exitCode = 1;
} finally { await db.$disconnect(); }
