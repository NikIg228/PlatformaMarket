import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { localDatabaseProfile, databaseLabel } from "./lib/local-database-profile.mjs";
import { assertPreviewTarget, inspectPreview, applyPreview } from "./lib/product-page-preview-seed.mjs";

const { databaseUrl } = localDatabaseProfile();
assertPreviewTarget(databaseUrl);
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
try {
  const snapshot = await inspectPreview(prisma);
  console.log(`Target: ${databaseLabel(databaseUrl)}; products: ${snapshot.products.length}; known pilot suppliers: ${snapshot.suppliers.length}`);
  if (process.argv.includes("--apply")) {
    const backup = path.resolve(".tmp", `product-preview-before-${Date.now()}.json`);
    await fs.mkdir(path.dirname(backup), { recursive: true });
    await fs.writeFile(backup, JSON.stringify(snapshot, null, 2), { flag: "wx" });
    console.log(`Before snapshot: ${backup}`);
    const result = await prisma.$transaction(tx => applyPreview(tx), { timeout: 60000, isolationLevel: "Serializable" });
    console.log(JSON.stringify(result));
  } else console.log("Read-only preflight passed. --apply prepares only the five approved local preview products.");
} finally { await prisma.$disconnect(); }
