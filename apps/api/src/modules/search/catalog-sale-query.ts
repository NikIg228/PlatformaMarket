import { Prisma } from "@prisma/client";
import type { SearchCatalogInput } from "@marketplace/schemas";

/** Same publication, price freshness and stock rules as toSearchItem. Bound parameters only. */
export function catalogSaleJoin(input: SearchCatalogInput, admitted: string[]) {
  const where: Prisma.Sql[] = [
    Prisma.sql`v."productId" = p.id AND v.status = 'ACTIVE' AND o.status = 'ACTIVE'`,
    Prisma.sql`pub.status IN ('PUBLISHED', 'RESTRICTED') AND pub."marketplaceVisible"`,
    admitted.length ? Prisma.sql`o."supplierOrganizationId" IN (${Prisma.join(admitted.map(id => Prisma.sql`${id}::uuid`))})` : Prisma.sql`FALSE`,
    Prisma.sql`(pub."allowedBuyerIds" IS NULL OR pub."allowedBuyerIds" = 'null'::jsonb OR pub."allowedBuyerIds" = '[]'::jsonb OR pub."allowedBuyerIds" @> ${JSON.stringify([input.buyerOrganizationId])}::jsonb)`,
  ];
  if (input.supplierOrganizationId) where.push(Prisma.sql`o."supplierOrganizationId" = ${input.supplierOrganizationId}::uuid`);
  if (input.packaging) where.push(Prisma.sql`COALESCE(pack.name, unit."nameRu") = ${input.packaging}`);
  if (input.unit) where.push(Prisma.sql`COALESCE(pu.symbol, unit.symbol) = ${input.unit}`);
  if (input.warehouseId) where.push(Prisma.sql`EXISTS (SELECT 1 FROM "InventoryBalance" ib WHERE ib."offerId" = o.id AND ib."warehouseId" = ${input.warehouseId}::uuid)`);
  if (input.deliveryMethod) where.push(Prisma.sql`EXISTS (SELECT 1 FROM "OfferDeliveryOption" od WHERE od."offerId" = o.id AND od.status = 'ACTIVE' AND od.method = ${input.deliveryMethod}::"DeliveryMethod")`);
  if (input.cityId) {
    where.push(Prisma.sql`(pub."allowedCityIds" IS NULL OR pub."allowedCityIds" = 'null'::jsonb OR pub."allowedCityIds" = '[]'::jsonb OR pub."allowedCityIds" @> ${JSON.stringify([input.cityId])}::jsonb)`);
    where.push(Prisma.sql`(EXISTS (SELECT 1 FROM "InventoryBalance" ib JOIN "Warehouse" w ON w.id = ib."warehouseId" WHERE ib."offerId" = o.id AND w."cityId" = ${input.cityId}::uuid) OR EXISTS (SELECT 1 FROM "OfferDeliveryOption" od WHERE od."offerId" = o.id AND od.status = 'ACTIVE' AND od.method IN ('NATIONWIDE','CARRIER','MARKETPLACE_LOGISTICS')))`);
  }
  return Prisma.sql`JOIN LATERAL (
    SELECT COUNT(*) AS "offerCount", COALESCE(BOOL_OR(x.available), FALSE) AS available,
      COALESCE(MIN(x.price) FILTER (WHERE x.available), MIN(x.price)) AS price
    FROM (
      SELECT price."amountMinor" AS price,
        COALESCE(price."amountMinor" > 0 AND price.currency = 'KZT' AND EXISTS (
          SELECT 1 FROM "InventoryBalance" ib WHERE ib."offerId" = o.id AND ib."freshnessStatus" = 'FRESH'
          AND (ib."freshnessExpiresAt" IS NULL OR ib."freshnessExpiresAt" > NOW()) AND ib."quantityAvailable" > 0
        ), FALSE) AS available
      FROM "ProductVariant" v JOIN "SupplierOffer" o ON o."productVariantId" = v.id
      JOIN "OfferPublication" pub ON pub."offerId" = o.id
      LEFT JOIN "ProductPackaging" pack ON pack.id = o."packagingId"
      LEFT JOIN "UnitOfMeasure" pu ON pu.id = pack."unitId"
      LEFT JOIN "UnitOfMeasure" unit ON unit.id = o."saleUnitId"
      LEFT JOIN LATERAL (
        SELECT pr."amountMinor", pr.currency FROM "OfferPrice" pr WHERE pr."offerId" = o.id AND pr.status = 'ACTIVE'
        AND pr."validFrom" <= NOW() AND (pr."validTo" IS NULL OR pr."validTo" >= NOW())
        AND (pr."freshnessExpiresAt" IS NULL OR pr."freshnessExpiresAt" >= NOW())
        ORDER BY pr."validFrom" DESC LIMIT 1
      ) price ON TRUE WHERE ${Prisma.join(where, " AND ")}
    ) x
  ) sale ON TRUE`;
}
