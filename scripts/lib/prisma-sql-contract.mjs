import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");

export function prismaCommand(args, databaseUrl, input) {
  const result = spawnSync(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), ...args], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf8", timeout: 180_000, windowsHide: true, input,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.replaceAll(databaseUrl, "[TEST_DATABASE_URL]");
  assert.equal(result.status, 0, `Prisma ${args[0]} ${args[1]} failed (${result.error?.code ?? result.status}):\n${output}`);
  return output;
}

export function assertPrismaSqlDiff(databaseUrl) {
  prismaCommand(["migrate", "diff", "--from-url", databaseUrl, "--to-schema-datamodel", "apps/api/prisma/schema.prisma", "--exit-code"], databaseUrl);
}

const finite = columns => columns.flatMap(column => [`${column} >= 0`, `${column} < 'Infinity'::numeric`]).join(" AND ");
const checks = {
  InventoryBalance_quantities_nonnegative_check: ["InventoryBalance", finite(["quantityOnHand", "quantityReserved", "safetyStock", "quantityAvailable"])],
  InventoryBalance_quantities_capacity_check: ["InventoryBalance", "quantityAvailable + quantityReserved + safetyStock <= quantityOnHand"],
  InventoryLot_quantities_nonnegative_check: ["InventoryLot", finite(["quantityOnHand", "quantityReserved", "quantityAvailable"])],
  InventoryLot_quantities_capacity_check: ["InventoryLot", "quantityAvailable + quantityReserved <= quantityOnHand"],
  InventoryReservation_quantity_positive_check: ["InventoryReservation", "quantity > 0 AND quantity < 'Infinity'::numeric"],
};
// PostgreSQL adds casts and parentheses when deparsing these numeric expressions.
const normalize = sql => sql.replace(/^CHECK\s*/i, "").replaceAll("::numeric", "").replace(/[\s()\"]/g, "");

export async function assertSqlOnlyContract(db, schema) {
  const columns = await db.$queryRaw`
    SELECT a.attgenerated, format_type(a.atttypid, a.atttypmod) AS type,
      pg_get_expr(d.adbin, d.adrelid) AS expression
    FROM pg_attribute a JOIN pg_class t ON t.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = t.oid AND d.adnum = a.attnum
    WHERE n.nspname = ${schema} AND t.relname = 'ProductSearchDocument'
      AND a.attname = 'searchVector' AND NOT a.attisdropped`;
  assert.equal(columns.length, 1, "searchVector must exist");
  assert.equal(columns[0].attgenerated, "s", "searchVector must be STORED generated, not a DEFAULT");
  assert.equal(columns[0].type, "tsvector");
  assert.equal(columns[0].expression, `to_tsvector('simple'::regconfig, "normalizedText")`);

  const constraints = await db.$queryRaw`
    SELECT c.conname, c.convalidated, t.relname, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = ${schema} AND c.contype = 'c'`;
  for (const [name, [table, expression]] of Object.entries(checks)) {
    const constraint = constraints.find(c => c.conname === name && c.relname === table);
    assert.ok(constraint, `Missing SQL CHECK ${name}`);
    assert.equal(constraint.convalidated, true, `Unvalidated SQL CHECK ${name}`);
    assert.equal(normalize(constraint.definition), normalize(expression), `Changed SQL CHECK ${name}`);
  }
}
