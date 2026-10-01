import { readFile } from "node:fs/promises";

export async function verifyPromotionUpgrade(prisma, assert) {
  const schema = `promotion_upgrade_${process.pid}`;
  if (!/^promotion_upgrade_\d+$/.test(schema)) throw new Error("Invalid upgrade fixture schema");
  const migration = await readFile(new URL("../../apps/api/prisma/migrations/20261001140000_offer_promotion_versions/migration.sql", import.meta.url), "utf8");
  const functionStart = migration.indexOf("CREATE FUNCTION guard_active_promotion_price");
  const functionEnd = migration.indexOf("$$;", functionStart) + 3;
  assert(functionStart > 0 && functionEnd > functionStart, "Exact promotion trigger definition missing");
  const statements = [...migration.slice(0, functionStart).split(";"), migration.slice(functionStart, functionEnd), ...migration.slice(functionEnd).split(";")].map(value => value.trim()).filter(Boolean);
  const rollback = new Error("ROLLBACK_PROMOTION_UPGRADE");
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe(`CREATE TYPE "PromotionKind" AS ENUM ('PERCENTAGE','FIXED_AMOUNT','FREE_SHIPPING')`);
      await tx.$executeRawUnsafe('CREATE TABLE "SupplierOffer" (id UUID PRIMARY KEY)');
      await tx.$executeRawUnsafe('CREATE TABLE "Promotion" (id UUID PRIMARY KEY, kind "PromotionKind", status TEXT, currency TEXT, "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3))');
      await tx.$executeRawUnsafe('CREATE TABLE "SupplierOrderItem" (id UUID PRIMARY KEY, "cartItemId" UUID NOT NULL, "unitPriceMinor" DECIMAL(20,0), "totalPriceMinor" DECIMAL(20,0))');
      await tx.$executeRawUnsafe('CREATE TABLE "OfferPrice" (id UUID PRIMARY KEY, "offerId" UUID, "amountMinor" DECIMAL(20,0), currency TEXT)');
      await tx.$executeRawUnsafe(`INSERT INTO "SupplierOffer" VALUES ('10000000-0000-4000-8000-000000000001')`);
      await tx.$executeRawUnsafe(`INSERT INTO "Promotion" VALUES ('10000000-0000-4000-8000-000000000002','PERCENTAGE','ACTIVE','KZT',CURRENT_TIMESTAMP - INTERVAL '1 day',CURRENT_TIMESTAMP + INTERVAL '1 day')`);
      await tx.$executeRawUnsafe(`INSERT INTO "SupplierOrderItem" VALUES ('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004',9007199254740993,9007199254740993)`);
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      const legacy = await tx.$queryRawUnsafe('SELECT "moderationStatus", "offerId" FROM "Promotion"');
      assert(legacy[0].moderationStatus === "LEGACY_UNREVIEWED" && legacy[0].offerId === null, "Legacy promotion was silently approved");
      const order = await tx.$queryRawUnsafe('SELECT "unitPriceMinor"::text AS amount, "giftForItemId" FROM "SupplierOrderItem"');
      assert(order[0].amount === "9007199254740993" && order[0].giftForItemId === null, "Upgrade changed old order price or added a gift");
      await tx.$executeRawUnsafe(`INSERT INTO "SupplierOrderItem" VALUES ('10000000-0000-4000-8000-000000000005',NULL,0,0,'10000000-0000-4000-8000-000000000003')`);
      await tx.$executeRawUnsafe(`UPDATE "Promotion" SET "offerId"='10000000-0000-4000-8000-000000000001', "baseAmountMinor"=9007199254740993, "moderationStatus"='APPROVED', "approvedRevision"=1`);
      await tx.$executeRawUnsafe(`INSERT INTO "OfferPrice" VALUES ('10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001',9007199254740993,'KZT')`);
      await tx.$executeRawUnsafe('SAVEPOINT forbidden_price');
      let rejected = false;
      try { await tx.$executeRawUnsafe(`UPDATE "OfferPrice" SET "amountMinor"=9007199254740994`); }
      catch { rejected = true; await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT forbidden_price'); }
      assert(rejected, "Upgrade price trigger accepted a changed active promotion base");
      throw rollback;
    }, { timeout: 15000 });
  } catch (error) { if (error !== rollback) throw error; }
  const remaining = await prisma.$queryRaw`SELECT schema_name FROM information_schema.schemata WHERE schema_name = ${schema}`;
  assert(remaining.length === 0, "Promotion upgrade schema leaked");
  console.log("Promotion upgrade: legacy money preserved, no silent approvals, zero-price gift and all-writer trigger PASS");
}
