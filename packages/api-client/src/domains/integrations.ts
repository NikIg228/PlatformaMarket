import type { ClientTransport } from "../transport-contract";


export function listIntegrationTaxBindings(transport: ClientTransport, supplierId: string) {
    return transport.get<import("@marketplace/schemas").IntegrationTaxBinding[]>(`/suppliers/${supplierId}/integrations/price-tax`);
  }

export function updateIntegrationTax(transport: ClientTransport, supplierId: string, connectionId: string, bindingId: string, input: import("@marketplace/schemas").UpdateIntegrationTaxInput) {
    return transport.patch<import("@marketplace/schemas").IntegrationTaxBinding>(`/suppliers/${supplierId}/integrations/${connectionId}/bindings/${bindingId}/tax`, input);
  }

export function resolveIntegrationReconciliation(transport: ClientTransport, supplierId: string, connectionId: string, entryId: string, input: import("@marketplace/schemas").ResolveReconciliationInput) {
    return transport.post<import("@marketplace/schemas").ResolvedReconciliation>(
      `/suppliers/${supplierId}/integrations/${connectionId}/reconciliation/${entryId}/resolve`, input,
    );
  }
