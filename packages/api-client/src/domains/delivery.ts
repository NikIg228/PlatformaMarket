import type { ClientTransport } from "../transport-contract";
import type { ShipmentResponse, CreateShipmentRequest, TransitionShipmentRequest } from "@marketplace/schemas";

export function listOrderShipments(transport: ClientTransport, orderId: string) {
    return transport.get<ShipmentResponse[]>(
      `/supplier-orders/${orderId}/shipments`,
    );
  }

export function createShipment(transport: ClientTransport, orderId: string, input: CreateShipmentRequest) {
    return transport.post<ShipmentResponse>(
      `/supplier-orders/${orderId}/shipments`,
      input,
    );
  }

export function transitionShipment(transport: ClientTransport, shipmentId: string, input: TransitionShipmentRequest) {
    return transport.post<ShipmentResponse>(
      `/shipments/${shipmentId}/transitions`,
      input,
    );
  }

export function listOfferDeliveryOptions(transport: ClientTransport, supplierId: string, offerId: string) {
    return transport.get<import("@marketplace/schemas").OfferDeliveryOptionResponse[]>(`/suppliers/${supplierId}/offers/${offerId}/delivery-options`);
  }

export function saveOfferDeliveryOption(transport: ClientTransport, supplierId: string, offerId: string, input: import("@marketplace/schemas").CreateOfferDeliveryOptionInput) {
    return transport.post<import("@marketplace/schemas").OfferDeliveryOptionResponse>(`/suppliers/${supplierId}/offers/${offerId}/delivery-options`, input);
  }
