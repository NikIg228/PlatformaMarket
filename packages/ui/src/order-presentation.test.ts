import { describe, expect, it } from "vitest";
import type { OrderWorkflowResponse } from "@marketplace/schemas";
import { orderItemCount, orderOverview, orderPaymentPresentation } from "./order-presentation";
const data = (status: string, changes = {}) => ({ status, paymentStatus: "UNPAID", order: { items: [] }, claims: [], events: [], invoiceDocumentId: null, ...changes } as unknown as OrderWorkflowResponse);
describe("order presentation invariants", () => {
  it("never promises payment or fulfillment after cancellation", () => {
    const result = orderOverview(data("CANCELLED"), true);
    expect(result.title).toBe("Заказ отменён"); expect(result.action).toBeNull(); expect(result.payment.label).toBe("Оплата не требуется");
    expect(result.steps.every(step => step.state === "stopped")).toBe(true);
  });
  it("keeps transfer claims separate from received payment", () => {
    expect(orderPaymentPresentation({ status: "AWAITING_PAYMENT", paymentStatus: "UNPAID", paymentReviewPending: true }).label).toBe("Перевод на проверке");
    expect(orderPaymentPresentation({ status: "AWAITING_PAYMENT", paymentStatus: "UNPAID", partiallyPaid: true }).label).toBe("Частично оплачено");
  });
  it("preserves refund attention on delivered orders", () => {
    const result = orderOverview(data("DELIVERED", { paymentStatus: "PAID", returns: [{ status: "REFUND_SENT" }] }), true);
    expect(result.title).toBe("Заказ выполнен"); expect(result.openReturn).toBe(true); expect(result.payment.label).toBe("Возврат в процессе");
  });
  it("partial delivery never completes the roadmap", () => {
    const result = orderOverview(data("PARTIALLY_FULFILLED", { paymentStatus: "PAID" }), false);
    expect(result.steps.at(-1)?.state).not.toBe("done"); expect(result.title).toBe("Заказ получен частично");
  });
  it("handles Russian item counts", () => {
    expect([1, 2, 11, 21, 112].map(orderItemCount)).toEqual(["1 позиция", "2 позиции", "11 позиций", "21 позиция", "112 позиций"]);
  });
});
