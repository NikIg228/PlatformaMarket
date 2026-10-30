import type { ClientTransport } from "../transport-contract";
import { withQuery } from "../query-path";
import type { OutboxDeadLetterQueryInput, OutboxDeadLetterListResponse, OutboxReplayInput, OutboxReplayResponse } from "@marketplace/schemas";

export function operationObject(transport: ClientTransport, type: import("@marketplace/schemas").OperationQueueType, id: string) { return transport.get<import("@marketplace/schemas").OperationObject>(`/operations/work-queue/${type}/${encodeURIComponent(id)}`); }

export function operatorDocumentException(transport: ClientTransport, id: string, signal?: AbortSignal) { return transport.get<import("@marketplace/schemas").OperatorDocumentException>(`/operations/document-exceptions/${encodeURIComponent(id)}`, { signal }); }

export function operatorAudit(transport: ClientTransport, input: import("@marketplace/schemas").OperatorAuditQuery, signal?: AbortSignal) { return transport.get<import("@marketplace/schemas").OperatorAuditPage>(withQuery("/operations/audit", input), { signal }); }

export function operatorTechnical(transport: ClientTransport, signal?: AbortSignal) { return transport.get<import("@marketplace/schemas").OperatorTechnical>("/operations/technical", { signal }); }

export function operatorTrust(transport: ClientTransport, input: import("@marketplace/schemas").OperatorTrustQuery, signal?: AbortSignal) { return transport.get<import("@marketplace/schemas").OperatorTrust>(withQuery("/trust/operator", input), { signal }); }

export function operatorTrustEvents(transport: ClientTransport, id: string, offset = 0, signal?: AbortSignal) { return transport.get<import("@marketplace/schemas").OperatorTrustEvents>(withQuery(`/trust/operator/suppliers/${encodeURIComponent(id)}/events`, { offset }), { signal }); }

export function resolveOperatorTrustIncident(transport: ClientTransport, id: string, input: import("@marketplace/schemas").OperatorTrustResolve) { return transport.post<import("@marketplace/schemas").OperatorTrustResolved>(`/trust/operator/incidents/${encodeURIComponent(id)}/resolve`, input); }

export function publishOperatorExceptionRecommendation(transport: ClientTransport, id: string, input: import("@marketplace/schemas").OperatorExceptionReview) { return transport.post<import("@marketplace/schemas").OperatorExceptionReviewResult>(`/operations/document-exceptions/${encodeURIComponent(id)}/recommendation`, input); }

export function operationWorkQueue(transport: ClientTransport, query: Partial<import("@marketplace/schemas").OperationWorkQueueQuery> = {}, signal?: AbortSignal) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
    return transport.get<import("@marketplace/schemas").OperationWorkQueue>(`/operations/work-queue?${params}`, { signal });
  }

export function operatorDashboard(transport: ClientTransport, signal?: AbortSignal) { return transport.get<import("@marketplace/schemas").OperatorDashboard>("/operations/dashboard", { signal }); }

export function operatorCapabilities(transport: ClientTransport, signal?: AbortSignal) { return transport.get<import("@marketplace/schemas").OperatorCapabilities>("/operations/capabilities", { signal }); }

export function operatorOrganizations(transport: ClientTransport, query: Partial<import("@marketplace/schemas").OperatorOrganizationsQuery> = {}, signal?: AbortSignal) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
    return transport.get<import("@marketplace/schemas").OperatorOrganizations>(`/operations/organizations?${params}`, { signal });
  }

export function operatorOrders(transport: ClientTransport, query: Partial<import("@marketplace/schemas").OperatorOrdersQuery> = {}, signal?: AbortSignal) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
    return transport.get<import("@marketplace/schemas").OperatorOrders>(`/operations/orders?${params}`, { signal });
  }

export function operatorOrder(transport: ClientTransport, id: string, signal?: AbortSignal) {
    return transport.get<import("@marketplace/schemas").OperatorOrderDetail>(`/operations/orders/${encodeURIComponent(id)}`, { signal });
  }

export function operatorOrganization(transport: ClientTransport, id: string, signal?: AbortSignal) { return transport.get<import("@marketplace/schemas").OperatorOrganizationDetail>(`/operations/organizations/${encodeURIComponent(id)}`, { signal }); }

export function operationAssignees(transport: ClientTransport) { return transport.get<{ id: string; displayName: string }[]>("/operations/work-queue/assignees"); }

export function assignOperation(transport: ClientTransport, type: import("@marketplace/schemas").OperationQueueType, id: string, input: import("@marketplace/schemas").OperationAssignment) { return transport.post<import("@marketplace/schemas").OperationAssignmentResult>(`/operations/work-queue/${type}/${encodeURIComponent(id)}/assignment`, input); }

export function operationHistory(transport: ClientTransport, type: import("@marketplace/schemas").OperationQueueType, id: string) { return transport.get<import("@marketplace/schemas").OperationHistory>(`/operations/work-queue/${type}/${encodeURIComponent(id)}/history`); }

export function listOutboxDeadLetters(transport: ClientTransport, input: OutboxDeadLetterQueryInput = {}, signal?: AbortSignal) {
    return transport.get<OutboxDeadLetterListResponse>(
      withQuery("/operations/outbox/dead-letter", input),
      { signal },
    );
  }

export function replayOutboxDeadLetter(transport: ClientTransport, eventId: string, input: OutboxReplayInput) {
    return transport.post<OutboxReplayResponse>(
      `/operations/outbox/dead-letter/${eventId}/replay`,
      input,
    );
  }
