import { readFile } from "node:fs/promises";

export async function verifyOrderInvoiceUpgrade(prisma, assert) {
  const schema = `invoice_upgrade_${process.pid}`;
  const migration = await readFile(new URL("../../apps/api/prisma/migrations/20261015090000_order_invoice_preparation/migration.sql", import.meta.url), "utf8");
  const definition = migration.match(/CREATE FUNCTION[\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0];
  assert(Boolean(definition), "Expected invoice immutability function");
  const statements = migration.replace(definition, "__FUNCTION__;").split(";").map(value => value.trim()).filter(Boolean).map(value => value === "__FUNCTION__" ? definition : value);
  const id = "10000000-0000-4000-8000-000000000001", rollback = new Error("ROLLBACK_INVOICE_UPGRADE");
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe('CREATE TABLE "Document" ("id" UUID PRIMARY KEY, "source" TEXT, "checksumSha256" TEXT)');
      await tx.$executeRawUnsafe('CREATE TABLE "SupplierOrder" ("id" UUID PRIMARY KEY, "subtotalAmountMinor" NUMERIC(20,0))');
      await tx.$executeRawUnsafe(`INSERT INTO "Document" VALUES ('${id}', 'UPLOADED', 'legacy-checksum')`);
      await tx.$executeRawUnsafe(`INSERT INTO "SupplierOrder" VALUES ('${id}', 9007199254740993)`);
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      const [document] = await tx.$queryRawUnsafe('SELECT * FROM "Document"');
      const [order] = await tx.$queryRawUnsafe('SELECT "subtotalAmountMinor"::text AS amount FROM "SupplierOrder"');
      assert(document.source === "UPLOADED" && document.checksumSha256 === "legacy-checksum" && order.amount === "9007199254740993", "Invoice migration changed legacy data");
      const [empty] = await tx.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "OrderInvoicePreparation"');
      assert(empty.count === 0, "Migration invented invoice confirmations");
      await tx.$executeRawUnsafe(`INSERT INTO "OrderInvoicePreparation" ("documentId", "supplierOrderId", "idempotencyKey", "requestHash", "actorId", "number", "version") VALUES ('${id}', '${id}', 'key', 'hash', '${id}', 'PM-INV-TEST', 1)`);
      await tx.$executeRawUnsafe(`UPDATE "OrderInvoicePreparation" SET "confirmedAt" = NOW(), "confirmedById" = '${id}', "confirmedByName" = 'Fixture'`);
      await tx.$executeRawUnsafe('SAVEPOINT immutable_check');
      let rejected = false;
      try { await tx.$executeRawUnsafe('UPDATE "OrderInvoicePreparation" SET "confirmedAt" = NULL, "confirmedById" = NULL, "confirmedByName" = NULL'); } catch { rejected = true; }
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT immutable_check');
      assert(rejected, "Invoice confirmation could be erased");
      throw rollback;
    }, { timeout: 15000 });
  } catch (error) { if (error !== rollback) throw error; }
  const remaining = await prisma.$queryRaw`SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${schema}`;
  assert(remaining.length === 0, "Invoice upgrade fixture leaked");
  console.log("Invoice additive upgrade PASS: uploaded documents/exact amounts preserved, no invented confirmations, immutable confirmation and schema rollback");
}
