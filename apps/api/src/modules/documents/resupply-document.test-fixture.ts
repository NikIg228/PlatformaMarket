import { Prisma } from "@prisma/client";
import type { ResupplyDocumentClaim } from "./resupply-document.rules";
export const rdId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function resupplyDocumentFixture(): ResupplyDocumentClaim {
  const id = rdId, d = (n: number) => new Prisma.Decimal(n);
  return { id: id(2), version: 4, supplierOrderId: id(10), shipmentId: id(5), status: "AGREED", resolution: "RESUPPLY",
    statement: { kind: "SHORTAGE", reason: "Получено восемь", requestedResolution: "RESUPPLY", attachmentIds: [], lines: [{ shipmentItemId: id(3), actualQuantity: "8", damagedQuantity: "0" }] },
    source: { orderVersion: 1, shipmentVersion: 1, shipmentNumber: "SHP-1", documentId: null, documentVersion: null,
      documentChecksum: null, documentSnapshot: null, sourceReceiptEventId: null,
      lines: [{ shipmentItemId: id(3), orderItemId: id(4), name: "Товар", uom: "шт.", sentQuantity: "10", recordedReceivedQuantity: "0", unitPriceMinor: "100", taxSnapshot: null, isGift: false }] },
    supplierOrder: { id: id(10), version: 2, orderNumber: "ORD-1", checkoutId: id(11), status: "DELIVERED", supplierOrganizationId: id(1), buyerOrganizationId: id(20),
      supplier: { legalName: "Поставщик", displayName: "Поставщик" }, buyer: { legalName: "Клиника", displayName: "Клиника" } },
    shipment: { id: id(5), version: 3, items: [{ id: id(3), supplierOrderItemId: id(4), quantity: d(10), deliveredQuantity: d(8) }],
      resupplyShipment: { id: id(6), version: 2, shipmentNumber: "SHP-2", resupplyDiscrepancyId: id(2), status: "DELIVERED", dispatchedAt: new Date("2026-10-16T10:00:00Z"), deliveredAt: new Date("2026-10-16T11:00:00Z"), carrierName: null, trackingNumber: null,
        items: [{ supplierOrderItemId: id(4), quantity: d(2), deliveredQuantity: d(2) }] } },
  } as unknown as ResupplyDocumentClaim;
}
