import { cancellationWorkflow, cancellationScope, cancellationId } from "./cancellation-draft";
export { cancellationScope as historyScope, cancellationId as historyId };
export function historyWorkflow() {
  const workflow = cancellationWorkflow();
  workflow.events = [
    { id: cancellationId(9800), action: "ACCEPT_COMPOSITION", actorId: cancellationScope.userId, organizationId: cancellationScope.organizationId, createdAt: "2026-10-28T10:00:00.000Z", details: { reason: "SYNTHETIC private event reason", amountMinor: "999999999999999999" } },
    { id: cancellationId(9801), action: "REQUEST_RETURN", actorId: cancellationId(9802), organizationId: cancellationId(9803), createdAt: "2026-10-28T11:00:00.000Z", details: { private: "SYNTHETIC opaque event details" } },
    { id: cancellationId(9804), action: "SYNTHETIC_FUTURE_PRIVATE_ACTION", actorId: cancellationScope.userId, organizationId: cancellationScope.organizationId, createdAt: "SYNTHETIC invalid date", details: {} },
  ]; return workflow;
}
