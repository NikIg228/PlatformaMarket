import { PrismaClient } from "@prisma/client";
import { testDatabaseUrl } from "./lib/test-database-profile.mjs";
import { assertPrismaSqlDiff, assertSqlOnlyContract } from "./lib/prisma-sql-contract.mjs";

const url = testDatabaseUrl();
const schema = new URL(url).searchParams.get("schema") ?? "public";
const db = new PrismaClient({ datasourceUrl: url });
try {
  assertPrismaSqlDiff(url);
  await assertSqlOnlyContract(db, schema);
  console.log("PASS: Prisma/SQL diff empty; generated search vector and quantity CHECKs intact.");
} finally {
  await db.$disconnect();
}
