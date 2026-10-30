import type { ClientTransport } from "../transport-contract";
import { withQuery } from "../query-path";
import type { GenerateOrderDocumentPackRequest, OrderDocumentPackResponse, OrderDiscrepanciesResponse, ResupplyDocumentsResponse, PrepareResupplyDocumentInput, ResupplyDocumentView, OrderDiscrepancyCommand, OrderDiscrepancyResult, ShipmentWaybillsResponse, PrepareShipmentWaybillInput, ShipmentWaybillView, OrderInvoicesResponse, PrepareOrderInvoiceInput, OrderInvoiceView, PreparedOrderDocumentsResponse, DocumentArchiveQueryInput, DocumentArchivePageResponse, DocumentArchiveSummaryResponse, DocumentArchiveItem, UpdateDocumentAccountingStatusInput, UploadDocumentInput } from "@marketplace/schemas";

export function generateOrderDocumentPack(transport: ClientTransport, orderId: string, input: GenerateOrderDocumentPackRequest) {
    return transport.post<OrderDocumentPackResponse>(
      `/supplier-orders/${orderId}/document-pack`,
      input,
    );
  }

export function getOrderDiscrepancies(transport: ClientTransport, orderId: string) {
    return transport.get<OrderDiscrepanciesResponse>(`/supplier-orders/${orderId}/discrepancies`);
  }

export function getResupplyDocuments(transport: ClientTransport, orderId: string, discrepancyId: string) {
    return transport.get<ResupplyDocumentsResponse>(`/supplier-orders/${orderId}/discrepancies/${discrepancyId}/documents`);
  }

export function prepareResupplyDocument(transport: ClientTransport, orderId: string, discrepancyId: string, input: PrepareResupplyDocumentInput) {
    return transport.post<ResupplyDocumentView>(`/supplier-orders/${orderId}/discrepancies/${discrepancyId}/documents/prepare`, input);
  }

export function downloadResupplyDocument(transport: ClientTransport, orderId: string, discrepancyId: string, documentId: string) {
    return transport.get<{ fileName: string; mimeType: string; contentBase64: string }>(`/supplier-orders/${orderId}/discrepancies/${discrepancyId}/documents/${documentId}/download`);
  }

export function executeOrderDiscrepancy(transport: ClientTransport, orderId: string, input: OrderDiscrepancyCommand) {
    return transport.post<OrderDiscrepancyResult>(`/supplier-orders/${orderId}/discrepancies`, input);
  }

export function uploadDiscrepancyAttachment(transport: ClientTransport, orderId: string, input: { fileName: string; contentBase64: string }) {
    return transport.post<{ id: string; name: string; mimeType: string; sizeBytes: number }>(`/supplier-orders/${orderId}/discrepancies/attachments`, input);
  }

export function downloadDiscrepancyAttachment(transport: ClientTransport, orderId: string, discrepancyId: string, assetId: string) {
    return transport.get<{ fileName: string; mimeType: string; contentBase64: string }>(`/supplier-orders/${orderId}/discrepancies/${discrepancyId}/attachments/${assetId}`);
  }

export function getShipmentWaybills(transport: ClientTransport, orderId: string, shipmentId: string) {
    return transport.get<ShipmentWaybillsResponse>(`/supplier-orders/${orderId}/shipments/${shipmentId}/waybills`);
  }

export function prepareShipmentWaybill(transport: ClientTransport, orderId: string, shipmentId: string, input: PrepareShipmentWaybillInput) {
    return transport.post<ShipmentWaybillView>(`/supplier-orders/${orderId}/shipments/${shipmentId}/waybills/prepare`, input);
  }

export function getOrderInvoices(transport: ClientTransport, orderId: string) {
    return transport.get<OrderInvoicesResponse>(`/supplier-orders/${orderId}/invoices`);
  }

export function prepareOrderInvoice(transport: ClientTransport, orderId: string, input: PrepareOrderInvoiceInput) {
    return transport.post<OrderInvoiceView>(`/supplier-orders/${orderId}/invoices/prepare`, input);
  }

export function prepareOrderDocuments(transport: ClientTransport, orderId: string) {
    return transport.post<PreparedOrderDocumentsResponse>(
      `/supplier-orders/${orderId}/documents/prepare`,
      {},
    );
  }

export function listDocumentArchive(transport: ClientTransport, input: DocumentArchiveQueryInput = {}) {
    return transport.get<DocumentArchivePageResponse>(
      withQuery("/documents/archive", input),
    );
  }

export function getDocumentArchiveSummary(transport: ClientTransport) {
    return transport.get<DocumentArchiveSummaryResponse>("/documents/archive/summary");
  }

export function getArchiveDocument(transport: ClientTransport, documentId: string) {
    return transport.get<DocumentArchiveItem>(`/documents/archive/${documentId}`);
  }

export function updateDocumentAccountingStatus(transport: ClientTransport, documentId: string, input: UpdateDocumentAccountingStatusInput) {
    return transport.patch<DocumentArchiveItem>(`/documents/archive/${documentId}/accounting-status`, input);
  }

export function uploadDocument(transport: ClientTransport, input: UploadDocumentInput) {
    return transport.post<import("@marketplace/schemas").UploadedDocument>("/documents/upload", input);
  }

export function downloadDocument(transport: ClientTransport, documentId: string) {
    return transport.download(`/documents/${documentId}/download`);
  }
