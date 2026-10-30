import type { ClientTransport } from "../transport-contract";
import type { SetOfferPublicationInput, SupplierOfferPublicationResponse } from "@marketplace/schemas";

export function getSupplierVatSettings(transport: ClientTransport, supplierId: string) { return transport.get<import("@marketplace/schemas").SupplierVatSettings>(`/suppliers/${supplierId}/vat`); }

export function saveSupplierVatSettings(transport: ClientTransport, supplierId: string, input: import("@marketplace/schemas").SaveSupplierVatSettingsInput) { return transport.post<import("@marketplace/schemas").SupplierVatSettings>(`/suppliers/${supplierId}/vat`, input); }

export function previewOfferVat(transport: ClientTransport, supplierId: string, input: import("@marketplace/schemas").PreviewOfferVatInput) { return transport.post<import("@marketplace/schemas").OfferVatPreview>(`/suppliers/${supplierId}/vat/offers/preview`, input); }

export function applyOfferVat(transport: ClientTransport, supplierId: string, input: import("@marketplace/schemas").ApplyOfferVatInput) { return transport.post<import("@marketplace/schemas").OfferVatApplyResult>(`/suppliers/${supplierId}/vat/offers/apply`, input); }

export function listSupplierWarehouses(transport: ClientTransport, supplierId: string) {
    return transport.get<import("@marketplace/schemas").SupplierWarehouseList>(`/suppliers/${supplierId}/warehouses`);
  }

export function createSupplierOffer(transport: ClientTransport, supplierId: string, input: import("@marketplace/schemas").CreateSupplierOfferInput) {
    return transport.post<import("@marketplace/schemas").SupplierOfferCreated>(`/suppliers/${supplierId}/offers`, input);
  }

export function setSupplierOfferPrice(transport: ClientTransport, supplierId: string, offerId: string, input: import("@marketplace/schemas").SetOfferPriceInput) {
    return transport.put<unknown>(`/suppliers/${supplierId}/offers/${offerId}/price`, input);
  }

export function getSupplierOfferCommercial(transport: ClientTransport, supplierId: string, offerId: string, warehouseId: string) {
    return transport.get<import("@marketplace/schemas").OfferCommercialState>(`/suppliers/${supplierId}/offers/${offerId}/commercial/${warehouseId}`);
  }

export function saveSupplierOfferCommercial(transport: ClientTransport, supplierId: string, offerId: string, input: import("@marketplace/schemas").SaveOfferCommercialInput) {
    return transport.put<import("@marketplace/schemas").OfferCommercialState>(`/suppliers/${supplierId}/offers/${offerId}/commercial`, input);
  }

export function saveSupplierOfferStock(transport: ClientTransport, supplierId: string, offerId: string, input: import("@marketplace/schemas").SaveOfferStockInput) {
    return transport.put<import("@marketplace/schemas").OfferCommercialState>(`/suppliers/${supplierId}/offers/${offerId}/commercial/stock`, input);
  }

export function saveSupplierOfferPrice(transport: ClientTransport, supplierId: string, offerId: string, input: import("@marketplace/schemas").SaveOfferPriceInput) {
    return transport.put<import("@marketplace/schemas").OfferCommercialState>(`/suppliers/${supplierId}/offers/${offerId}/commercial/price`, input);
  }

export function assignSupplierOfferPackaging(transport: ClientTransport, supplierId: string, offerId: string, input: import("@marketplace/schemas").AssignOfferPackagingInput) {
    return transport.put<unknown>(`/suppliers/${supplierId}/offers/${offerId}/packaging`, input);
  }

export function setSupplierInventory(transport: ClientTransport, supplierId: string, input: import("@marketplace/schemas").SetInventoryBalanceInput) {
    return transport.put<unknown>(`/suppliers/${supplierId}/inventory/balances`, input);
  }

export function setSupplierOfferPublication(transport: ClientTransport, supplierOrganizationId: string, offerId: string, input: SetOfferPublicationInput) {
    return transport.put<SupplierOfferPublicationResponse>(
      `/suppliers/${supplierOrganizationId}/offers/${offerId}/publication`,
      input,
    );
  }
