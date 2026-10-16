import type { OperatorOrderDetail, OperatorOrder, DocumentArchiveItem } from "@marketplace/schemas";
export const orderViewId = (n: number) => `62000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const orderViewDate = "2026-10-16T08:00:00.000Z";
export function operatorOrderView() {
  const id = orderViewId, at = orderViewDate;
  const buyer = { id: id(2), displayName: "Клиника проверки", legalName: "ТОО Клиника проверки", bin: "123456789012" }, supplier = { id: id(3), displayName: "Поставщик проверки", legalName: "ТОО Поставщик проверки", bin: "123456789013" };
  const items: OperatorOrder[] = Array.from({ length: 31 }, (_, i) => ({ id: id(100 + i), orderNumber: `ORD-${String(i + 1).padStart(2, "0")}`, buyer, supplier, status: "PARTIALLY_FULFILLED", paymentStatus: "PAID", subtotalAmountMinor: "9007199254740993", currency: "KZT", createdAt: at, updatedAt: at, version: 3 }));
  const order = items[30];
  const detail: OperatorOrderDetail = { canWrite: false, canViewDocuments: true, canViewSupport: true, workflow: { orderId: order.id, version: 3, status: order.status, paymentStatus: order.paymentStatus, invoiceDocumentId: id(9),
    order: { ...order, checkoutId: id(4), buyerOrganizationId: buyer.id, supplierOrganizationId: supplier.id, transactionMode: "ONE_TIME",
      items: [{ id: id(5), supplierOrderId: order.id, offerId: id(6), productVariantId: id(7), warehouseId: id(8), quantity: "10", acceptedQuantity: "10", decisionReason: null, unitPriceMinor: "100", totalPriceMinor: "1000", currency: "KZT", status: "CONFIRMED", offer: { id: id(6), productVariant: { id: id(7), product: { id: id(10), canonicalName: "Композит для реставрации зубов" } } } }],
      shipments: [{ id: id(11), supplierOrderId: order.id, warehouseId: id(8), shipmentNumber: "SHP-10", method: "PICKUP", status: "PARTIALLY_DELIVERED", trackingNumber: null, carrierName: null, pickup: true, deliveryWindowStart: null, deliveryWindowEnd: null, recipientName: buyer.displayName, recipientPhone: null, dispatchedAt: at, deliveredAt: null, failureReason: null, version: 2,
        items: [{ id: id(12), shipmentId: id(11), supplierOrderItemId: id(5), quantity: "10", deliveredQuantity: "8" }], fulfillmentSteps: [], createdAt: at, updatedAt: at }],
    },
    paymentSummary: { confirmedAmountMinor: "800", remainingAmountMinor: "200", overpaidAmountMinor: "0", status: "PARTIALLY_RECEIVED" },
    claims: [{ id: id(13), invoiceDocumentId: id(9), documentId: id(14), amountMinor: "1000", currency: "KZT", paidAt: at, comment: "Перевод заявлен клиникой", status: "CONFIRMED", createdAt: at, confirmedAt: at, confirmedById: id(15), receivedAmountMinor: "800", supportTicketId: id(16) }],
    events: [{ id: id(17), action: "REPORT_TRANSFER", actorId: id(18), organizationId: buyer.id, createdAt: at, details: {} }],
    returns: [{ id: id(19), supplierOrderId: order.id, kind: "GOODS", status: "REQUESTED", reason: "Запрос возврата повреждённого товара", decisionReason: null, amountMinor: "100", currency: "KZT", items: [{ orderItemId: id(5), quantity: "1", condition: "Упаковка повреждена" }], requestedById: id(18), createdAt: at, decidedAt: null, goodsSentAt: null, goodsReceivedAt: null, refundDocumentId: null, refundSentAt: null, refundReceivedAt: null }],
  }, discrepancies: [{ id: id(20), shipmentId: id(11), version: 4, status: "AGREED", previousDiscrepancyId: null, resolution: "RESUPPLY", kind: "SHORTAGE", reason: "Получено 8 вместо 10", sourceDocumentId: id(9), sourceDocumentVersion: 1, createdAt: at, updatedAt: at, events: [],
    resupply: { canDispatch: false, issues: [], documentStatus: "INCOMPLETE", warehouseName: "Склад", recipientName: buyer.displayName, method: "PICKUP", lines: [{ shipmentItemId: id(12), orderItemId: id(5), name: "Композит", uom: "шт", originalReceivedQuantity: "8", quantity: "2", deliveredQuantity: "2" }], shipment: { id: id(21), number: "SHP-2", status: "DELIVERED", dispatchedAt: at, deliveredAt: at, carrierName: null, trackingNumber: null } } }],
    tickets: [{ id: id(16), number: "T-31", subject: "Недостача по заказу", status: "OPEN", createdAt: at, updatedAt: at }],
  };
  const document: DocumentArchiveItem = { id: id(9), ownerOrganizationId: supplier.id, category: "SHIPMENT", kind: "WAYBILL", format: "PDF", source: "GENERATED", status: "DRAFT", accountingStatus: "NOT_APPLICABLE", title: "Накладная SHP-10", documentNumber: "DOC-10", documentDate: at, amountMinor: "1000", currency: "KZT", version: 2, fileName: "fixture.pdf", checksumSha256: "a".repeat(64), immutableAt: null, generatedAt: at, expiresAt: null, baseAgreementDocumentId: null,
    supplierOrder: { id: order.id, orderNumber: order.orderNumber, paymentStatus: "PAID", buyerOrganizationId: buyer.id, supplierOrganizationId: supplier.id }, paymentIntent: null, paymentTransaction: null, refund: null,
    participants: [{ organizationId: supplier.id, role: "SIGNER", organization: supplier }, { organizationId: buyer.id, role: "SIGNER", organization: buyer }], signatures: [],
    versions: [{ id: id(9), version: 2, status: "DRAFT", documentDate: at, createdAt: at }, { id: id(22), version: 1, status: "SUPERSEDED", documentDate: at, createdAt: at }], createdAt: at, updatedAt: at };
  return { items, detail, document };
}
