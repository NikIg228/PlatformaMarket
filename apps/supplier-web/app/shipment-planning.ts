import type { ShipmentOrder } from "./shipment-panel";

export function shipmentPlanning(order: ShipmentOrder, selectedWarehouseId: string) {
  const planned = new Map<string, number>();
  for (const shipment of order.shipments ?? []) {
    if (["CANCELLED", "RETURNED"].includes(shipment.status)) continue;
    for (const line of shipment.items) planned.set(line.supplierOrderItemId,
      (planned.get(line.supplierOrderItemId) ?? 0) + Number(line.quantity));
  }
  const remaining = order.items.map(item => ({ item,
    quantity: Math.max(0, Number(item.acceptedQuantity ?? 0) - (planned.get(item.id) ?? 0)),
  })).filter(line => line.quantity > 0);
  const warehouses = [...new Map(remaining.map(({ item }) => [item.warehouseId, item.warehouse])).entries()];
  const warehouseId = warehouses.some(([id]) => id === selectedWarehouseId) ? selectedWarehouseId : warehouses[0]?.[0] ?? "";
  return { warehouses, warehouseId, remainingItems: remaining.filter(({ item }) => item.warehouseId === warehouseId) };
}
