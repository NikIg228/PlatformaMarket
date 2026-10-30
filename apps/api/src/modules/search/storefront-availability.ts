import { Prisma } from "@prisma/client";

/** A storefront lists offers with at least one orderable quantity at one warehouse/lot. */
export function storefrontAvailabilitySql() {
  const minimum = Prisma.sql`(CEIL(GREATEST(o."minimumOrderQuantity", o."orderIncrement") / NULLIF(o."orderIncrement", 0)) * o."orderIncrement")`;
  return Prisma.sql`EXISTS (
    SELECT 1 FROM "InventoryBalance" ib JOIN "Warehouse" w ON w.id = ib."warehouseId"
    WHERE ib."offerId" = o.id AND ib."supplierOrganizationId" = o."supplierOrganizationId"
      AND w.status = 'ACTIVE' AND ib."freshnessStatus" = 'FRESH'
      AND (ib."freshnessExpiresAt" IS NULL OR ib."freshnessExpiresAt" > timezone('UTC', NOW()))
      AND ib."quantityAvailable" > 0 AND ib."quantityAvailable" >= ${minimum}
      AND (NOT EXISTS (SELECT 1 FROM "InventoryLot" lot WHERE lot."inventoryBalanceId" = ib.id)
        OR EXISTS (SELECT 1 FROM "InventoryLot" lot WHERE lot."inventoryBalanceId" = ib.id
          AND lot.status = 'ACTIVE' AND (lot."expirationDate" IS NULL OR lot."expirationDate" > timezone('UTC', NOW()))
          AND lot."quantityAvailable" >= ${minimum}))
  )`;
}
