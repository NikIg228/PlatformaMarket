import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { orderLineVat, shipmentWaybillSnapshotSchema, type OrganizationRequisitesRevision, type ShipmentWaybillSnapshot } from "@marketplace/schemas";
import { calculateLineTotal } from "../commerce/commerce-rules";
import { requisitesDate } from "../organizations/organization-requisites.rules";
import { invoiceOrderInclude } from "./order-invoice.rules";

export const WAYBILL_PREVIEW = "WAYBILL_PREVIEW:";
export function waybillPreviewVisibility(organizationId?: string): Prisma.DocumentWhereInput {
  return { OR: [{ externalId: null }, { NOT: { externalId: { startsWith: WAYBILL_PREVIEW } } },
    ...(organizationId ? [{ ownerOrganizationId: organizationId }] : [])] };
}
export const waybillShipmentInclude = {
  items: { orderBy: { id: "asc" as const } }, warehouse: true,
  supplierOrder: { include: invoiceOrderInclude },
} satisfies Prisma.ShipmentInclude;
export type WaybillShipment = Prisma.ShipmentGetPayload<{ include: typeof waybillShipmentInclude }>;
export const waybillConflict = (message: string) => new ConflictException({ code: "SHIPMENT_WAYBILL_CONFLICT", message });
export function waybillAddress(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const address = value as Record<string, unknown>;
  return [address.postalCode, address.city, address.region, address.line1, address.line2]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim())).map(part => part.trim()).join(", ");
}
export function waybillIssues(shipment: WaybillShipment): string[] {
  const order = shipment.supplierOrder, issues: string[] = [];
  if (!["PACKING", "READY"].includes(shipment.status)) issues.push("Подготовка накладной доступна при сборке и готовности партии к отправке");
  if (order.paymentStatus !== "PAID" || ["CANCELLED", "REJECTED", "DELIVERED", "RETURN_DISPUTE"].includes(order.status)) issues.push("Текущий статус заказа не допускает подготовку накладной");
  if (shipment.warehouse.supplierOrganizationId !== order.supplierOrganizationId) issues.push("Склад не принадлежит поставщику заказа");
  if (!shipment.warehouse.addressLine?.trim()) issues.push("Укажите адрес склада перед подготовкой накладной");
  if (!shipment.recipientName.trim() || !shipment.pickup && !waybillAddress(shipment.destinationAddress)) issues.push("В отгрузке должны быть указаны получатель и адрес доставки");
  if (order.currency !== "KZT") issues.push("Для этого шаблона требуется партия в тенге");
  if (!shipment.items.length) issues.push("В партии нет позиций");
  return issues;
}
export function waybillLines(shipment: WaybillShipment): ShipmentWaybillSnapshot["lines"] {
  return shipment.items.map(line => {
    const item = shipment.supplierOrder.items.find(item => item.id === line.supplierOrderItemId);
    if (!item || item.warehouseId !== shipment.warehouseId || !line.quantity.gt(0) || line.quantity.gt(item.acceptedQuantity)) throw waybillConflict("Позиции партии не соответствуют согласованному заказу и складу");
    if (!calculateLineTotal(item.unitPriceMinor.toString(), item.acceptedQuantity.toString()).eq(item.totalPriceMinor)) throw waybillConflict("Цена позиции не соответствует согласованному итогу заказа");
    const totalMinor = calculateLineTotal(item.unitPriceMinor.toString(), line.quantity.toString()).toString();
    const gift = Boolean(item.giftForItemId) && item.totalPriceMinor.eq(0);
    const tax = orderLineVat(item.offerSnapshot, totalMinor);
    if (!tax && !gift) throw waybillConflict("Уточните налоговые условия позиций заказа перед подготовкой накладной");
    const unit = item.offer.packaging?.name ?? item.productVariant.saleUnit?.nameRu ?? "";
    if (!unit) throw waybillConflict("Для позиции не указана единица продажи");
    return { id: item.id, shipmentItemId: line.id, name: item.productVariant.product.canonicalName,
      article: item.productVariant.sku ?? "", unit, orderedQuantity: item.acceptedQuantity.toString(),
      quantity: line.quantity.toString(), unitPriceMinor: item.unitPriceMinor.toString(), totalMinor, gift, tax };
  });
}
export function waybillSnapshot(shipment: WaybillShipment, supplier: OrganizationRequisitesRevision,
  buyer: OrganizationRequisitesRevision, version: number, preparedBy: { id: string; name: string }, date = requisitesDate()) {
  const issues = waybillIssues(shipment);
  if (issues.length) throw waybillConflict(issues.join(". "));
  const order = shipment.supplierOrder, lines = waybillLines(shipment);
  return shipmentWaybillSnapshotSchema.parse({ templateVersion: "PM_WAYBILL_PREVIEW_V1",
    orderId: order.id, orderNumber: order.orderNumber, orderVersion: order.version,
    shipmentId: shipment.id, shipmentNumber: shipment.shipmentNumber, shipmentVersion: shipment.version,
    number: `WB-${shipment.shipmentNumber}`, version, date, supplier, buyer,
    warehouse: { id: shipment.warehouseId, name: shipment.warehouse.name, address: shipment.warehouse.addressLine },
    recipient: { name: shipment.recipientName, address: shipment.pickup ? shipment.warehouse.addressLine : waybillAddress(shipment.destinationAddress) },
    carrierName: shipment.carrierName, trackingNumber: shipment.trackingNumber, preparedBy, lines, currency: order.currency,
    totalMinor: lines.reduce((sum, line) => sum + BigInt(line.totalMinor), 0n).toString(),
    baseMinor: lines.reduce((sum, line) => sum + BigInt(line.tax?.baseMinor ?? "0"), 0n).toString(),
    vatMinor: lines.reduce((sum, line) => sum + BigInt(line.tax?.vatMinor ?? "0"), 0n).toString() });
}
