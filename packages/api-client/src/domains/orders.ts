import type { ClientTransport } from "../transport-contract";
import { withQuery } from "../query-path";
import type { SupplierOrderResponse, ConfirmSupplierOrderRequest, OrderWorkflowResponse, OrderReviewState, CreateVerifiedReviewInput, VerifiedOrderReview, SupplierPaymentPolicyResponse, SaveSupplierPaymentPolicy, OrderWorkflowCommand, OrderWorkflowResult } from "@marketplace/schemas";

export function listBuyerOrders(transport: ClientTransport, buyerOrganizationId: string) {
    return transport.get<SupplierOrderResponse[]>(
      `/buyers/${buyerOrganizationId}/orders`,
    );
  }

export function listSupplierOrders(transport: ClientTransport, checkoutId?: string) {
    return transport.get<SupplierOrderResponse[]>(
      withQuery("/supplier-orders", { checkoutId }),
    );
  }

export function confirmSupplierOrder(transport: ClientTransport, orderId: string, input: ConfirmSupplierOrderRequest) {
    return transport.post<SupplierOrderResponse>(
      `/supplier-orders/${orderId}/confirm`,
      input,
    );
  }

export function getOrderWorkflow(transport: ClientTransport, orderId: string) {
    return transport.get<OrderWorkflowResponse>(`/supplier-orders/${orderId}/workflow`);
  }

export function getOrderReviewState(transport: ClientTransport, orderId: string) {
    return transport.get<OrderReviewState>(`/trust/orders/${encodeURIComponent(orderId)}/review-state`);
  }

export function createOrderReview(transport: ClientTransport, orderId: string, input: CreateVerifiedReviewInput) {
    return transport.post<VerifiedOrderReview>(`/trust/orders/${encodeURIComponent(orderId)}/reviews`, input);
  }

export function getSupplierPaymentPolicy(transport: ClientTransport) {
    return transport.get<SupplierPaymentPolicyResponse>("/suppliers/current/payment-review-policy");
  }

export function saveSupplierPaymentPolicy(transport: ClientTransport, input: SaveSupplierPaymentPolicy) {
    return transport.post<SupplierPaymentPolicyResponse>("/suppliers/current/payment-review-policy", input);
  }

export function executeOrderWorkflow(transport: ClientTransport, orderId: string, input: OrderWorkflowCommand) {
    return transport.post<OrderWorkflowResult>(`/supplier-orders/${orderId}/workflow`, input);
  }
