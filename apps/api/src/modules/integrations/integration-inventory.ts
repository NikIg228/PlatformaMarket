import { Prisma } from "@prisma/client";
import { RetryableIntegrationError } from "./adapters/integration-adapter";

/** Replace only the exact stock/reservation snapshot that was read. */
export async function writeSyncedInventory(tx: Prisma.TransactionClient, before: { id: string; version: number } | null,
  identity: { supplierOrganizationId: string; warehouseId: string; productVariantId: string },
  data: Omit<Prisma.InventoryBalanceUncheckedCreateInput, keyof typeof identity | "id" | "quantityReserved" | "safetyStock">,
  safetyStock: number) {
  if (!before) return tx.inventoryBalance.create({ data: { ...identity, ...data, quantityReserved: 0, safetyStock } });
  const result = await tx.inventoryBalance.updateMany({ where: { id: before.id, version: before.version }, data: { ...data, version: { increment: 1 } } });
  if (result.count !== 1) throw new RetryableIntegrationError("Inventory or reservations changed during sync; retry with a fresh snapshot");
  return tx.inventoryBalance.findUniqueOrThrow({ where: { id: before.id } });
}
