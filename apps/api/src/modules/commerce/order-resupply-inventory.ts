import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { DiscrepancyResupply } from "@marketplace/schemas";
import type { SupplierActorContext } from "../suppliers/supplier-access.service";
import { lockInventoryBalances, usableLotWhere } from "../inventory/lot-eligibility";
import type { ResupplySource } from "./order-resupply.rules";

const conflict = (message: string): never => { throw new ConflictException({ code: "ORDER_DISCREPANCY_CONFLICT", message }); };

/** Additional physical goods, never a second consumption of the paid order reservation. */
export async function consumeResupplyInventory(tx: Prisma.TransactionClient, source: ResupplySource,
  lines: DiscrepancyResupply["lines"], replacementId: string, claimId: string, context: SupplierActorContext) {
  const selected = lines.map(line => ({ line, original: source.items.find(item => item.id === line.shipmentItemId)! }));
  await lockInventoryBalances(tx, selected.map(({ original }) => original.supplierOrderItem.reservation!.inventoryBalanceId));
  const result: Array<{ supplierOrderItemId: string; quantity: Prisma.Decimal; resupplyReservationId: string }> = [];
  for (const { line, original } of selected.sort((a, b) => a.original.supplierOrderItem.reservation!.inventoryBalanceId.localeCompare(b.original.supplierOrderItem.reservation!.inventoryBalanceId))) {
    const paid = original.supplierOrderItem.reservation!;
    const quantity = new Prisma.Decimal(line.quantity), at = new Date();
    const balance = await tx.inventoryBalance.findUniqueOrThrow({ where: { id: paid.inventoryBalanceId } });
    if (balance.supplierOrganizationId !== context.organizationId || balance.warehouseId !== source.warehouseId ||
        balance.productVariantId !== original.supplierOrderItem.productVariantId) conflict("Складской остаток не соответствует исходной позиции.");
    if (balance.freshnessStatus !== "FRESH" || balance.freshnessExpiresAt && balance.freshnessExpiresAt <= at)
      conflict("Обновите сведения об остатке перед отправкой допоставки.");
    if (balance.quantityAvailable.lt(quantity) || balance.quantityOnHand.minus(balance.quantityReserved).minus(balance.safetyStock).lt(quantity))
      conflict("Недостаточно доступного остатка для допоставки. Другие резервы сохранены.");
    const lot = await tx.inventoryLot.findFirst({ where: { inventoryBalanceId: balance.id, supplierOrganizationId: context.organizationId,
      warehouseId: source.warehouseId, productVariantId: balance.productVariantId, ...usableLotWhere(at), quantityAvailable: { gte: quantity } },
      orderBy: [{ expirationDate: { sort: "asc", nulls: "last" } }, { id: "asc" }] });
    if (!lot && await tx.inventoryLot.count({ where: { inventoryBalanceId: balance.id } }))
      conflict("Ни одна пригодная складская партия не покрывает количество допоставки.");
    if (lot) {
      await tx.$queryRaw`SELECT id FROM "InventoryLot" WHERE id = ${lot.id}::uuid FOR UPDATE`;
      const updated = await tx.inventoryLot.updateMany({ where: { id: lot.id, version: lot.version, ...usableLotWhere(new Date()),
        quantityAvailable: { gte: quantity }, quantityOnHand: { gte: quantity.plus(lot.quantityReserved) } },
        data: { quantityOnHand: { decrement: quantity }, quantityAvailable: { decrement: quantity }, version: { increment: 1 },
          ...(lot.quantityOnHand.eq(quantity) ? { status: "DEPLETED" } : {}) } });
      if (updated.count !== 1) conflict("Складская партия изменилась. Допоставка не зарегистрирована.");
    }
    const changed = await tx.inventoryBalance.updateMany({ where: { id: balance.id, version: balance.version,
      quantityAvailable: { gte: quantity }, quantityOnHand: { gte: quantity.plus(balance.quantityReserved).plus(balance.safetyStock) } },
      data: { quantityOnHand: { decrement: quantity }, quantityAvailable: { decrement: quantity }, version: { increment: 1 },
        availabilityStatus: balance.quantityAvailable.minus(quantity).gt(0) ? "IN_STOCK" : "OUT_OF_STOCK" } });
    if (changed.count !== 1) conflict("Остаток изменился. Допоставка не зарегистрирована.");
    const reservation = await tx.inventoryReservation.create({ data: { inventoryBalanceId: balance.id, inventoryLotId: lot?.id ?? null,
      supplierOrganizationId: context.organizationId, warehouseId: source.warehouseId, productVariantId: balance.productVariantId,
      quantity, status: "CONSUMED", expiresAt: at, referenceType: "ORDER_RESUPPLY", referenceId: replacementId,
      idempotencyKey: `resupply:${claimId}:${original.supplierOrderItemId}` } });
    await tx.auditLog.create({ data: { ...context, action: "inventory.resupply_consumed", entityType: "InventoryReservation", entityId: reservation.id,
      after: { shipmentId: replacementId, discrepancyId: claimId, sourceShipmentId: source.id, balanceId: balance.id,
        lotId: lot?.id ?? null, quantity: quantity.toString(), originalReservationId: paid.id } } });
    await tx.outboxEvent.create({ data: { aggregateType: "InventoryBalance", aggregateId: balance.id, eventType: "InventoryBalanceChanged",
      payload: { supplierOrganizationId: context.organizationId, balanceId: balance.id, quantityAvailable: balance.quantityAvailable.minus(quantity).toString() } } });
    result.push({ supplierOrderItemId: original.supplierOrderItemId, quantity, resupplyReservationId: reservation.id });
  }
  return result;
}
