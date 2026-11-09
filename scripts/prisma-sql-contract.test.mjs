import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";
import { assertPrismaSqlDiff, assertSqlOnlyContract, prismaCommand } from "./lib/prisma-sql-contract.mjs";

test("migration replay, search writes, metadata upgrade and drift detection", { timeout: 240_000 }, async t => {
  const base = testDatabaseUrl();
  const schema = `prisma_sql_${randomUUID().replaceAll("-", "")}`;
  const target = new URL(base);
  target.searchParams.set("schema", schema);
  const url = target.toString();
  const admin = new PrismaClient({ datasourceUrl: base });
  const db = new PrismaClient({ datasourceUrl: url });
  let created = false;
  const rollback = new Error("ROLLBACK_PROBE");
  const probe = async operation => {
    await assert.rejects(db.$transaction(async tx => {
      await operation(tx);
      throw rollback;
    }), error => error === rollback);
  };
  try {
    const [identity] = await admin.$queryRaw`SELECT current_database() AS name`;
    assert.equal(identity.name, decodeURIComponent(target.pathname.slice(1)));
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    created = true;
    // pg_trgm is database-wide and already lives in public. Prisma migrate deploy
    // restricts search_path to one schema; replay the unchanged SQL with both visible.
    const migrations = path.resolve(import.meta.dirname, "../apps/api/prisma/migrations");
    const sql = readdirSync(migrations, { withFileTypes: true }).filter(entry => entry.isDirectory())
      .map(entry => entry.name).sort().map(name => readFileSync(path.join(migrations, name, "migration.sql"), "utf8")).join("\n");
    prismaCommand(["db", "execute", "--stdin", "--schema", "apps/api/prisma/schema.prisma"], url,
      `SET search_path TO "${schema}", public;\n${sql}`);
    assertPrismaSqlDiff(url);
    await assertSqlOnlyContract(db, schema);
    await t.test("MFA defaults work through Prisma and SQL, updatedAt still advances", async () => {
      const user = await db.user.create({ data: { email: `${randomUUID()}@example.invalid`, displayName: "Schema probe" } });
      const factor = await db.userMfaFactor.create({ data: { userId: user.id, encryptedSecret: "synthetic-not-a-secret" } });
      assert.match(factor.id, /^[a-f0-9-]{36}$/);
      assert.ok(factor.updatedAt instanceof Date);
      await db.userMfaFactor.update({ where: { id: factor.id }, data: { updatedAt: new Date("2000-01-01") } });
      const updated = await db.userMfaFactor.update({ where: { id: factor.id }, data: { failedAttempts: 1 } });
      assert.ok(updated.updatedAt > new Date("2000-01-01"));
      await db.userMfaFactor.delete({ where: { id: factor.id } });
      const [raw] = await db.$queryRaw`
        INSERT INTO "UserMfaFactor" ("userId", "encryptedSecret")
        VALUES (${user.id}::uuid, 'synthetic-not-a-secret') RETURNING id, "updatedAt"`;
      assert.match(raw.id, /^[a-f0-9-]{36}$/);
      assert.ok(raw.updatedAt instanceof Date);
    });
    await t.test("Prisma writes retain generated Cyrillic FTS and all search indexes", async () => {
      const product = await db.product.create({ data: { canonicalName: "Перчатки", slug: randomUUID(), productType: "CONSUMABLE" } });
      const data = { productId: product.id, searchableText: "Перчатки", normalizedText: "перчатки", facets: {} };
      await db.productSearchDocument.create({ data });
      const matches = async word => (await db.$queryRaw`
        SELECT "searchVector" @@ plainto_tsquery('simple', ${word}) AS found
        FROM "ProductSearchDocument" WHERE "productId" = ${product.id}::uuid`)[0].found;
      assert.equal(await matches("перчатки"), true);
      await db.productSearchDocument.update({ where: { productId: product.id }, data: { normalizedText: "стоматология" } });
      assert.equal(await matches("перчатки"), false);
      assert.equal(await matches("стоматология"), true);
      const indexes = await db.$queryRaw`
        SELECT i.relname, x.indisvalid, x.indisready, am.amname
        FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid
        JOIN pg_namespace n ON n.oid=i.relnamespace JOIN pg_am am ON am.oid=i.relam
        WHERE n.nspname=${schema} AND i.relname IN ('Product_canonicalName_trgm_idx',
          'ProductSearchDocument_normalizedText_trgm_idx', 'ProductSearchDocument_searchVector_idx')`;
      assert.equal(indexes.length, 3);
      assert.ok(indexes.every(i => i.amname === "gin" && i.indisvalid && i.indisready));

      // Reapply only the metadata migration to a populated, already migrated schema.
      const before = await db.$queryRaw`SELECT to_jsonb(d) AS data FROM "ProductSearchDocument" d`;
      prismaCommand(["db", "execute", "--file", path.join(migrations, "20261109000000_prisma_sql_alignment/migration.sql"), "--schema", "apps/api/prisma/schema.prisma"], url);
      assert.deepEqual(await db.$queryRaw`SELECT to_jsonb(d) AS data FROM "ProductSearchDocument" d`, before);
      assertPrismaSqlDiff(url);
    });
    await t.test("generated-column loss is rejected even when its type survives", async () => {
      await probe(async tx => {
        await tx.$executeRawUnsafe('ALTER TABLE "ProductSearchDocument" ALTER COLUMN "searchVector" DROP EXPRESSION');
        await assert.rejects(assertSqlOnlyContract(tx, schema), /must be STORED generated/);
      });
    });
    await t.test("missing, weakened and unvalidated CHECKs are rejected", async () => {
      for (const replacement of ["", 'CHECK (quantity >= 0)', "CHECK (quantity > 0 AND quantity < 'Infinity'::numeric) NOT VALID"]) {
        await probe(async tx => {
          await tx.$executeRawUnsafe('ALTER TABLE "InventoryReservation" DROP CONSTRAINT "InventoryReservation_quantity_positive_check"');
          if (replacement) await tx.$executeRawUnsafe(`ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_quantity_positive_check" ${replacement}`);
          await assert.rejects(assertSqlOnlyContract(tx, schema), /SQL CHECK/);
        });
      }
    });
    await t.test("missing search index fails Prisma diff", async () => {
      await db.$executeRawUnsafe('DROP INDEX "ProductSearchDocument_searchVector_idx"');
      assert.throws(() => assertPrismaSqlDiff(url), /failed \(2\)/);
      await db.$executeRawUnsafe('CREATE INDEX "ProductSearchDocument_searchVector_idx" ON "ProductSearchDocument" USING GIN ("searchVector")');
      assertPrismaSqlDiff(url);
      await assertSqlOnlyContract(db, schema);
    });
  } finally {
    await db.$disconnect();
    try {
      if (created && /^prisma_sql_[a-f0-9]{32}$/.test(schema)) await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      await admin.$disconnect();
    }
  }
});
