import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, it } from "vitest";

it.skipIf(!process.env.POSTGRES_TEST_DATABASE_URL)("inventory quantity CHECK migration: clean install, legacy validation, INSERT/UPDATE rejection and rollback", async () => {
  const target = new URL(process.env.POSTGRES_TEST_DATABASE_URL!);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.pathname !== "/dentmarket_audit_20260914" ||
    process.env.DATABASE_URL !== process.env.POSTGRES_TEST_DATABASE_URL) throw new Error("Isolated inventory test database required");
  const db = new PrismaClient({ datasourceUrl: target.toString() });
  const migration = readFileSync(join(__dirname, "../../../prisma/migrations/20261106000000_inventory_quantity_checks/migration.sql"), "utf8");
  expect(migration.trim()).toMatch(/^BEGIN;[\s\S]*COMMIT;$/);
  const statements = migration.trim().slice("BEGIN;".length, -"COMMIT;".length).split(";").map(sql => sql.trim()).filter(Boolean);
  const tables = ["InventoryBalance", "InventoryLot", "InventoryReservation"] as const;
  type Table = typeof tables[number];
  const schemas: string[] = [];
  const ids = Object.fromEntries(tables.map(table => [table, randomUUID()])) as Record<Table, string>;
  const createSchema = async () => {
    const schema = `quantity_checks_${randomUUID().replaceAll("-", "")}`;
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemas.push(schema);
    // Keep deployed column types/defaults, but omit CHECK/FK/index constraints to model pre-upgrade rows.
    for (const table of tables) await db.$executeRawUnsafe(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING DEFAULTS)`);
    return schema;
  };
  const dropSchema = async (schema: string) => {
    if (!/^quantity_checks_[a-f0-9]{32}$/.test(schema) || !schemas.includes(schema)) throw new Error("Unexpected cleanup schema");
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  };
  const apply = (schema: string) => db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}", public`);
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  });
  const constraints = (schema: string) => db.$queryRaw<Array<{ name: string; validated: boolean }>>`
    SELECT c.conname AS name, c.convalidated AS validated FROM pg_constraint c
    JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname=${schema} AND c.contype='c' ORDER BY c.conname
  `;
  const row = async (schema: string, table: Table) => (await db.$queryRawUnsafe<Array<{ data: unknown }>>(
    `SELECT to_jsonb(t) AS data FROM "${schema}"."${table}" t WHERE id=$1::uuid`, ids[table]))[0].data;
  const update = (schema: string, table: Table, patch: Record<string, number | string>) => db.$executeRawUnsafe(
    `UPDATE "${schema}"."${table}" SET ${Object.keys(patch).map((column, i) => `"${column}"=$${i + 1}::numeric`).join(", ")} WHERE id=$${Object.keys(patch).length + 1}::uuid`,
    ...Object.values(patch), ids[table]);
  const insertCopy = (schema: string, table: Table, patch: Record<string, number | string>) => db.$executeRawUnsafe(
    `INSERT INTO "${schema}"."${table}" SELECT (jsonb_populate_record(NULL::"${schema}"."${table}", to_jsonb(t) || $1::jsonb)).* FROM "${schema}"."${table}" t WHERE id=$2::uuid`,
    JSON.stringify({ ...patch, id: randomUUID() }), ids[table]);
  const checkViolation = async (operation: () => Promise<unknown>) => {
    let error: unknown;
    try { await operation(); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: "P2010", meta: { code: "23514" } });
  };
  try {
    expect((await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`)[0].name).toBe("dentmarket_audit_20260914");
    const empty = await createSchema();
    await apply(empty);
    expect(await constraints(empty)).toHaveLength(5);
    expect((await constraints(empty)).every(item => item.validated)).toBe(true);

    const schema = await createSchema();
    const supplier = randomUUID(), warehouse = randomUUID(), variant = randomUUID();
    await db.$executeRawUnsafe(`INSERT INTO "${schema}"."InventoryBalance"
      (id,"supplierOrganizationId","warehouseId","productVariantId","quantityOnHand","quantityReserved","safetyStock","quantityAvailable","updatedAt")
      VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,10,2,1,7,now())`, ids.InventoryBalance, supplier, warehouse, variant);
    await db.$executeRawUnsafe(`INSERT INTO "${schema}"."InventoryLot"
      (id,"inventoryBalanceId","supplierOrganizationId","warehouseId","productVariantId","lotNumber","quantityOnHand","quantityReserved","quantityAvailable","updatedAt")
      VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'synthetic',10,2,8,now())`, ids.InventoryLot, ids.InventoryBalance, supplier, warehouse, variant);
    await db.$executeRawUnsafe(`INSERT INTO "${schema}"."InventoryReservation"
      (id,"inventoryBalanceId","supplierOrganizationId","warehouseId","productVariantId",quantity,"expiresAt","idempotencyKey","updatedAt")
      VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,2,now()+interval '1 hour','synthetic',now())`, ids.InventoryReservation, ids.InventoryBalance, supplier, warehouse, variant);

    const legacyCases: Array<{ table: Table; invalid: Record<string, number | string>; restore: Record<string, number | string> }> = [
      { table: "InventoryBalance", invalid: { quantityOnHand: "NaN" }, restore: { quantityOnHand: 10 } },
      { table: "InventoryBalance", invalid: { quantityAvailable: 8 }, restore: { quantityAvailable: 7 } },
      { table: "InventoryLot", invalid: { quantityReserved: -1 }, restore: { quantityReserved: 2 } },
      { table: "InventoryLot", invalid: { quantityAvailable: 9 }, restore: { quantityAvailable: 8 } },
      { table: "InventoryReservation", invalid: { quantity: 0 }, restore: { quantity: 2 } },
    ];
    for (const legacy of legacyCases) {
      await update(schema, legacy.table, legacy.invalid);
      const before = await row(schema, legacy.table);
      await checkViolation(() => apply(schema));
      expect(await constraints(schema)).toEqual([]);
      expect(await row(schema, legacy.table)).toEqual(before);
      await update(schema, legacy.table, legacy.restore);
    }
    const before = await Promise.all(tables.map(table => row(schema, table)));
    await apply(schema);
    expect(await Promise.all(tables.map(table => row(schema, table)))).toEqual(before);
    expect(await constraints(schema)).toHaveLength(5);
    expect((await constraints(schema)).every(item => item.validated)).toBe(true);

    const cases: Array<{ table: Table; patch: Record<string, number | string> }> = [];
    for (const table of ["InventoryBalance", "InventoryLot"] as const) {
      const columns = ["quantityOnHand", "quantityReserved", "quantityAvailable", ...(table === "InventoryBalance" ? ["safetyStock"] : [])];
      for (const column of columns) for (const value of [-1, "NaN"]) cases.push({ table, patch: { [column]: value } });
      cases.push({ table, patch: { quantityReserved: 11 } }, { table, patch: { quantityAvailable: 11 } });
    }
    cases.push({ table: "InventoryBalance", patch: { quantityAvailable: 8 } }, { table: "InventoryBalance", patch: { safetyStock: 9 } },
      { table: "InventoryLot", patch: { quantityAvailable: 9 } });
    for (const quantity of [0, -1, "NaN"]) cases.push({ table: "InventoryReservation", patch: { quantity } });
    for (const { table, patch } of cases) {
      const before = await row(schema, table);
      await checkViolation(() => update(schema, table, patch));
      await checkViolation(() => insertCopy(schema, table, patch));
      expect(await row(schema, table)).toEqual(before);
      expect((await db.$queryRawUnsafe<Array<{ count: number }>>(`SELECT count(*)::int AS count FROM "${schema}"."${table}"`))[0].count).toBe(1);
    }

    // A later constraint violation must also roll back an earlier valid write in the transaction.
    const prior = await row(schema, "InventoryBalance");
    await checkViolation(() => db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`UPDATE "${schema}"."InventoryBalance" SET "quantityAvailable"=0 WHERE id=$1::uuid`, ids.InventoryBalance);
      await tx.$executeRawUnsafe(`UPDATE "${schema}"."InventoryReservation" SET quantity=0 WHERE id=$1::uuid`, ids.InventoryReservation);
    }));
    expect(await row(schema, "InventoryBalance")).toEqual(prior);

    for (const table of ["InventoryBalance", "InventoryLot"] as const) {
      const extra: Record<string, number | string> = table === "InventoryBalance" ? { safetyStock: 0 } : {};
      await update(schema, table, { quantityOnHand: 0, quantityReserved: 0, quantityAvailable: 0, ...extra });
      await update(schema, table, { quantityOnHand: "0.3", quantityReserved: "0.1", quantityAvailable: "0.2", ...extra });
      await update(schema, table, { quantityAvailable: 0 });
      await update(schema, table, { quantityOnHand: "999999999999999999.999999" });
    }
    await update(schema, "InventoryReservation", { quantity: "0.000001" });
    await update(schema, "InventoryReservation", { quantity: "999999999999999999.999999" });
    console.info(`Inventory CHECKs: ${cases.length * 2} rejected INSERT/UPDATE attempts, 5 dirty upgrades rolled back, clean/valid upgrade and boundary cases passed`);
  } finally {
    for (const schema of schemas) await dropSchema(schema);
    await db.$disconnect();
  }
}, 60_000);
