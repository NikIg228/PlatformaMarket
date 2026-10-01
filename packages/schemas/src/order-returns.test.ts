import { describe, expect, it } from "vitest";
import { orderWorkflowCommandSchema } from "./order-workflow.js";
const id = "10000000-0000-4000-8000-000000000001";
const command = { action: "REQUEST_RETURN", kind: "GOODS", reason: "Unopened package", expectedVersion: 1, idempotencyKey: id };
describe("manual return contract", () => {
  it("requires exact positive quantities and a described condition", () => {
    for (const quantity of ["0", "0.000000", "-1", "1e3", "0.0000001"]) expect(orderWorkflowCommandSchema.safeParse({ ...command, items: [{ orderItemId: id, quantity, condition: "Unopened" }] }).success).toBe(false);
    expect(orderWorkflowCommandSchema.safeParse({ ...command, items: [{ orderItemId: id, quantity: "0.000001", condition: "Unopened" }] }).success).toBe(true);
  });
  it("requires a receipt for sent money and an independent receipt action", () => {
    expect(orderWorkflowCommandSchema.safeParse({ action: "SEND_MANUAL_REFUND", returnId: id, expectedVersion: 1, idempotencyKey: id }).success).toBe(false);
    expect(orderWorkflowCommandSchema.safeParse({ action: "RECEIVE_MANUAL_REFUND", returnId: id, expectedVersion: 1, idempotencyKey: id }).success).toBe(true);
  });
});
