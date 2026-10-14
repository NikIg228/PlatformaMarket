import { readFile } from "node:fs/promises";

export async function verifyOrganizationRequisitesUpgrade(prisma, assert) {
  const schema = `requisites_upgrade_${process.pid}`;
  const migration = await readFile(new URL("../../apps/api/prisma/migrations/20261014010000_organization_requisites/migration.sql", import.meta.url), "utf8");
  // Keep the PL/pgSQL body intact; its internal semicolons are not SQL boundaries.
  const functionPattern = /CREATE FUNCTION[\s\S]*?\$\$ LANGUAGE plpgsql;/;
  const definition = migration.match(functionPattern)?.[0];
  assert(Boolean(definition), "Expected immutable revision trigger function");
  const statements = migration.replace(definition, "__FUNCTION__;").split(";").map(value => value.replace(/--[^\n]*/g, "").trim()).filter(Boolean).map(value => value === "__FUNCTION__" ? definition : value);
  const rollback = new Error("ROLLBACK_REQUISITES_UPGRADE");
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe('CREATE TABLE "Organization" ("id" UUID PRIMARY KEY, "legalName" TEXT, "version" INTEGER)');
      await tx.$executeRawUnsafe(`INSERT INTO "Organization" VALUES ('10000000-0000-4000-8000-000000000001', 'Legacy unchanged', 7)`);
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      const [legacy] = await tx.$queryRawUnsafe('SELECT * FROM "Organization"');
      assert(legacy.legalName === "Legacy unchanged" && legacy.version === 7, "Migration changed existing organization");
      for (const table of ["OrganizationRequisites", "OrganizationRequisitesRevision"]) {
        const [row] = await tx.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${table}"`);
        assert(row.count === 0, "Migration invented banking or tax data");
      }
      throw rollback;
    }, { timeout: 15000 });
  } catch (error) { if (error !== rollback) throw error; }
  const remaining = await prisma.$queryRaw`SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${schema}`;
  assert(remaining.length === 0, "Upgrade fixture leaked");
  console.log("Requisites additive upgrade PASS: legacy row preserved, no inferred data, scratch schema rolled back");
}
