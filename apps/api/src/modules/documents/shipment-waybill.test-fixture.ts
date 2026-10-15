import { Prisma } from "@prisma/client";
import { invoiceTestId as id, invoiceTestOrder } from "./order-invoice.test-fixture";
import type { WaybillShipment } from "./shipment-waybill.rules";
export function waybillTestShipment(): WaybillShipment {
  const order = invoiceTestOrder(); order.paymentStatus = "PAID"; order.status = "ASSEMBLING";
  order.items[0].warehouseId = id(50);
  return { id: id(60), supplierOrderId: order.id, shipmentNumber: "TEST-SHIP-1", version: 2, status: "PACKING", pickup: false,
    recipientName: "Тестовый получатель", destinationAddress: { line1: "Тестовая улица 1" }, carrierName: null, trackingNumber: null,
    warehouseId: id(50), warehouse: { id: id(50), supplierOrganizationId: order.supplierOrganizationId, name: "Тестовый склад", addressLine: "Тестовый адрес 2" },
    items: [{ id: id(61), supplierOrderItemId: order.items[0].id, quantity: new Prisma.Decimal(1) }], supplierOrder: order } as unknown as WaybillShipment;
}
