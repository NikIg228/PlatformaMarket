import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

export function lotIsUsable(lot: { status: string; expirationDate: Date | null }, at = new Date(), consumed = false) {
  return (lot.status === "ACTIVE" || (consumed && lot.status === "DEPLETED")) &&
    (!lot.expirationDate || lot.expirationDate > at);
}

export function usableLotWhere(at = new Date()): Prisma.InventoryLotWhereInput {
  return { status: "ACTIVE", OR: [{ expirationDate: null }, { expirationDate: { gt: at } }] };
}

export async function lockInventoryBalances(tx: Prisma.TransactionClient, balanceIds: string[]) {
  for (const id of [...new Set(balanceIds)].sort())
    await tx.$queryRaw`SELECT id FROM "InventoryBalance" WHERE id = ${id}::uuid FOR UPDATE`;
}

export async function assertShipmentLotsUsable(tx: Prisma.TransactionClient, supplierOrganizationId: string,
  items: Array<{ inventoryLotId: string | null; warehouseId: string }>) {
  const ids = [...new Set(items.flatMap(item => item.inventoryLotId ? [item.inventoryLotId] : []))].sort();
  if (!ids.length) return;
  const identities = await tx.inventoryLot.findMany({ where: { id: { in: ids }, supplierOrganizationId }, select: { id: true, inventoryBalanceId: true } });
  if (identities.length !== ids.length) throw new ConflictException("Партия заказа недоступна для отгрузки");
  await lockInventoryBalances(tx, identities.map(lot => lot.inventoryBalanceId));
  for (const id of ids) await tx.$queryRaw`SELECT id FROM "InventoryLot" WHERE id = ${id}::uuid FOR UPDATE`;
  const lots = await tx.inventoryLot.findMany({ where: { id: { in: ids }, supplierOrganizationId } });
  const at = new Date();
  for (const item of items) {
    if (!item.inventoryLotId) continue;
    const lot = lots.find(candidate => candidate.id === item.inventoryLotId);
    // Paid goods may already have exhausted the physical lot. Recall/expiry
    // still overrides that accounting state before shipment is permitted.
    if (!lot || lot.warehouseId !== item.warehouseId || !lotIsUsable(lot, at, true))
      throw new ConflictException("Партия отозвана, просрочена или заблокирована. Отгрузка запрещена; обратитесь в поддержку.");
  }
}
