import { readFile } from "node:fs/promises";

// Run the exact additive migrations against the legacy table shape inside a
// transaction-local, disposable schema. Rollback removes every test object.
export async function verifyManualPaymentUpgrade(prisma, assert) {
  const schema = `manual_payment_upgrade_${process.pid}`;
  if (!/^manual_payment_upgrade_\d+$/.test(schema)) throw new Error("Invalid upgrade fixture schema");
  const migrations = await Promise.all(["20261001101000_manual_transfer_review", "20261001105000_manual_transfer_statuses", "20261001120000_manual_order_returns"].map(name => readFile(new URL(`../../apps/api/prisma/migrations/${name}/migration.sql`, import.meta.url), "utf8")));
  const rollback = new Error("ROLLBACK_SYNTHETIC_UPGRADE");
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe('CREATE TABLE "SupplierProfile" ("organizationId" UUID PRIMARY KEY)');
      await tx.$executeRawUnsafe('CREATE TABLE "SupplierOrder" ("id" UUID PRIMARY KEY)');
      await tx.$executeRawUnsafe(`CREATE TABLE "OrderTransferClaim" ("id" UUID PRIMARY KEY, "status" TEXT NOT NULL, "amountMinor" DECIMAL(20,0) NOT NULL, CONSTRAINT "OrderTransferClaim_status_check" CHECK ("status" IN ('PENDING','NEEDS_INFORMATION','CONFIRMED')))`);
      await tx.$executeRawUnsafe(`INSERT INTO "OrderTransferClaim" VALUES ('10000000-0000-4000-8000-000000000001', 'CONFIRMED', 9007199254740993), ('10000000-0000-4000-8000-000000000002', 'PENDING', 10)`);
      for (const migration of migrations) for (const statement of migration.split(";").map(value => value.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      const rows = await tx.$queryRawUnsafe('SELECT "status", "receivedAmountMinor"::text AS "received" FROM "OrderTransferClaim" ORDER BY "id"');
      assert(rows.length === 2 && rows[0].received === "9007199254740993" && rows[1].received === null, "Legacy confirmation backfill changed money or credited a pending receipt");
      const returns = await tx.$queryRawUnsafe('SELECT count(*)::int AS count FROM "OrderManualReturn"');
      assert(returns[0].count === 0, "Upgrade fabricated historical returns");
      await tx.$executeRawUnsafe(`UPDATE "OrderTransferClaim" SET "status" = 'NOT_RECEIVED' WHERE "status" = 'PENDING'`);
      await tx.$executeRawUnsafe(`UPDATE "OrderTransferClaim" SET "status" = 'DISPUTED' WHERE "status" = 'NOT_RECEIVED'`);
      throw rollback;
    }, { timeout: 15000 });
  } catch (error) { if (error !== rollback) throw error; }
  const remaining = await prisma.$queryRaw`SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${schema}`;
  assert(remaining.length === 0, "Upgrade fixture schema leaked after rollback");
  console.log("Manual payment upgrade: exact legacy backfill, pending balance preserved, new statuses and schema rollback PASS");
}
