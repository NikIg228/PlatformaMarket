import { PrismaClient } from "@prisma/client";

export async function localDataReadiness(databaseUrl, publicOrganizationId) {
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const buyer = publicOrganizationId
      ? await db.organization.findUnique({ where: { id: publicOrganizationId }, include: { capabilities: true } })
      : await db.organization.findUnique({ where: { bin: "970000000001" }, include: { capabilities: true } });
    if (!buyer || buyer.status !== "ACTIVE" || !buyer.capabilities.some(c => c.capability === "BUYER")) {
      throw new Error("Public catalog buyer is missing or inactive. Run npm run db:prepare:dev or set a valid PUBLIC_CATALOG_ORGANIZATION_ID for this database.");
    }
    const [cities, products, offers, loginAccounts] = await Promise.all([
      db.city.count(), db.product.count(),
      db.offerPublication.count({ where: { status: "PUBLISHED", marketplaceVisible: true } }),
      db.user.count({ where: { status: "ACTIVE", passwordHash: { not: null }, emailVerifiedAt: { not: null } } }),
    ]);
    if (!cities || !products || !offers || !loginAccounts) throw new Error("Local catalog or login accounts are missing. Run npm run db:prepare:dev; dev startup never reseeds data.");
    return { publicOrganizationId: buyer.id, cities, products, publishedOffers: offers, loginAccounts };
  } finally { await db.$disconnect(); }
}
