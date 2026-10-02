import { readFile } from "node:fs/promises";
export async function verifyCommerceMetricUpgrade(prisma, assert) {
  const schema = `commerce_metric_upgrade_${process.pid}`;
  if (!/^commerce_metric_upgrade_\d+$/.test(schema)) throw new Error("Invalid upgrade fixture schema");
  const migration = await readFile(new URL("../../apps/api/prisma/migrations/20261002150000_commerce_metric_facts/migration.sql", import.meta.url), "utf8");
  const rollback = new Error("ROLLBACK_METRIC_UPGRADE");
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      for (const table of ["Organization", "SupplierOrder", "SupplierOrderItem"]) {
        await tx.$executeRawUnsafe(`CREATE TABLE "${table}" ("id" UUID PRIMARY KEY)`);
        await tx.$executeRawUnsafe(`INSERT INTO "${table}" VALUES ('10000000-0000-4000-8000-000000000001')`);
      }
      for (const statement of migration.split(";").map(value => value.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      for (const table of ["Organization", "SupplierOrder"]) {
        const [row] = await tx.$queryRawUnsafe(`SELECT "commerceDataset" FROM "${table}"`);
        assert(row.commerceDataset === "UNCLASSIFIED", "Migration invented business provenance");
      }
      const [row] = await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "CommerceMetricEvent"');
      assert(row.count === 0, "Migration fabricated historical accruals");
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  const remaining = await prisma.$queryRaw`SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${schema}`;
  assert(remaining.length === 0, "Metric upgrade fixture leaked");
  console.log("CORE07 additive upgrade: legacy provenance unknown, no invented facts, rollback PASS");
}
