import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

/** Import changes physical stock, never reservations or the supplier's safety stock. */
export async function applyImportedInventory(tx: Prisma.TransactionClient, input: {
  supplierOrganizationId: string; warehouseId: string; productVariantId: string; offerId: string; quantity: string;
}) {
  const { quantity, offerId, ...identity } = input;
  const before = await tx.inventoryBalance.findUnique({ where: { supplierOrganizationId_warehouseId_productVariantId: identity } });
  const reserved = before?.quantityReserved ?? new Prisma.Decimal(0);
  const safetyStock = before?.safetyStock ?? new Prisma.Decimal(0);
  const available = new Prisma.Decimal(quantity).minus(reserved).minus(safetyStock);
  if (available.isNegative()) throw new ConflictException("Остаток из файла меньше суммы действующих резервов и страхового запаса. Строка не изменена.");
  const now = new Date();
  const data = { offerId, quantityOnHand: quantity, quantityAvailable: available,
    availabilityStatus: available.isZero() ? "OUT_OF_STOCK" as const : available.lte(5) ? "LOW_STOCK" as const : "IN_STOCK" as const,
    freshnessStatus: "FRESH" as const, source: "IMPORT" as const, externalUpdatedAt: now, lastSuccessfulSyncAt: now,
    freshnessExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) };
  if (before) {
    const result = await tx.inventoryBalance.updateMany({ where: { id: before.id, version: before.version }, data: { ...data, version: { increment: 1 } } });
    if (result.count !== 1) throw new ConflictException("Остаток или резервы изменились во время импорта. Строка не изменена; загрузите её повторно.");
  } else {
    // A concurrent first insert must fail this row, never overwrite the new balance.
    await tx.inventoryBalance.create({ data: { ...identity, ...data, quantityReserved: 0, safetyStock: 0 } });
  }
}
