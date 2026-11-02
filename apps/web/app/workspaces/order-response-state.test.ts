import { describe, expect, it } from "vitest";
import { orderResponseState } from "./order-response-state";
const order = { status: "AWAITING_CONFIRMATION", responseDeadlineAt: "2026-11-03T05:00:00Z" };
describe("order response presentation", () => {
  it("does not invent timers for legacy orders", () => expect(orderResponseState({ status: "CONFIRMED" })).toBe("legacy"));
  it("shows durable stage changes without converting silence to consent", () => {
    expect(orderResponseState(order)).toBe("waiting");
    expect(orderResponseState({ ...order, responseRemindedAt: "2026-11-03T04:45:00Z" })).toBe("reminded");
    expect(orderResponseState({ ...order, responseOverdueAt: order.responseDeadlineAt })).toBe("overdue");
    expect(orderResponseState({ ...order, responseEscalatedAt: "2026-11-03T06:00:00Z" })).toBe("escalated");
  });
  it("prioritizes a received answer over historical overdue/escalation", () => {
    const escalated = { ...order, responseEscalatedAt: "2026-11-03T06:00:00Z" };
    expect(orderResponseState({ ...escalated, responseReceivedAt: "2026-11-03T06:01:00Z" })).toBe("answeredLate");
    expect(orderResponseState({ ...order, responseReceivedAt: order.responseDeadlineAt })).toBe("answered");
    expect(orderResponseState({ ...order, status: "CONFIRMED" })).toBe("answered");
    expect(orderResponseState({ ...escalated, status: "CANCELLED" })).toBe("stopped");
  });
});
