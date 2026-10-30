import type { ClientTransport } from "../transport-contract";
import { withQuery } from "../query-path";
import type { SupplierImportBatchResponse, CreateImportBatchInput, SupplierImportDiagnosticsResponse, RollbackImportBatchInput, SupplierImportRollbackResponse } from "@marketplace/schemas";

export function listSupplierImportBatches(transport: ClientTransport, supplierId: string, query: import("@marketplace/schemas").SupplierImportHistoryQuery = {}) {
    return transport.get<SupplierImportBatchResponse[]>(withQuery(`/suppliers/${supplierId}/import-batches`, query));
  }

export function previewSupplierImport(transport: ClientTransport, supplierId: string, input: import("@marketplace/schemas").SupplierImportPreviewInput) {
    return transport.post<import("@marketplace/schemas").SupplierImportPreview>(`/suppliers/${supplierId}/import-preview`, input);
  }

export function previewSupplierImportTax(transport: ClientTransport, supplierId: string, input: import("@marketplace/schemas").SupplierImportTaxPreviewInput) {
    return transport.post<import("@marketplace/schemas").SupplierImportTaxPreview>(`/suppliers/${supplierId}/import-tax-preview`, input);
  }

export function createSupplierImportBatch(transport: ClientTransport, supplierOrganizationId: string, input: CreateImportBatchInput) {
    return transport.post<SupplierImportBatchResponse>(
      `/suppliers/${supplierOrganizationId}/import-batches`,
      input,
    );
  }

export function processSupplierImportBatch(transport: ClientTransport, supplierOrganizationId: string, batchId: string) {
    return transport.post<SupplierImportBatchResponse>(
      `/suppliers/${supplierOrganizationId}/import-batches/${batchId}/process`,
      {},
    );
  }

export function getSupplierImportBatch(transport: ClientTransport, supplierOrganizationId: string, batchId: string) {
    return transport.get<SupplierImportBatchResponse>(
      `/suppliers/${supplierOrganizationId}/import-batches/${batchId}`,
    );
  }

export function getSupplierImportDiagnostics(transport: ClientTransport, supplierOrganizationId: string, batchId: string) {
    return transport.get<SupplierImportDiagnosticsResponse>(
      `/suppliers/${supplierOrganizationId}/import-batches/${batchId}/diagnostics`,
    );
  }

export function rollbackSupplierImportBatch(transport: ClientTransport, supplierOrganizationId: string, batchId: string, input: RollbackImportBatchInput) {
    return transport.post<SupplierImportRollbackResponse>(
      `/suppliers/${supplierOrganizationId}/import-batches/${batchId}/rollback`,
      input,
    );
  }
