import { describe, expect, it } from "vitest";
import { conversationMessageInputSchema, conversationReadSchema, startConversationSchema, conversationQuerySchema } from "./conversations";
import { operationAssignmentSchema } from "./operations-workflow";
import { updateSupportTicketSchema } from "./commercial";

const id = "00000000-0000-4000-8000-000000000001";
describe("internal conversation and operator command contracts", () => {
  it("rejects forged participants, arbitrary contexts and attachments", () => {
    const input = { contextType: "ORDER", contextId: id, body: "Вопрос по заказу", idempotencyKey: id };
    expect(startConversationSchema.safeParse(input).success).toBe(true);
    for (const extra of [{ buyerOrganizationId: id }, { authorId: id }, { attachments: [] }, { contextType: "ORGANIZATION" }]) expect(startConversationSchema.safeParse({ ...input, ...extra }).success).toBe(false);
  });
  it("bounds text, paging and read cursors", () => {
    expect(conversationMessageInputSchema.safeParse({ body: " ", idempotencyKey: id }).success).toBe(false);
    expect(conversationMessageInputSchema.safeParse({ body: "x".repeat(10_001), idempotencyKey: id }).success).toBe(false);
    expect(conversationMessageInputSchema.safeParse({ body: "x", idempotencyKey: "unscoped" }).success).toBe(false);
    expect(conversationReadSchema.safeParse({ throughSequence: -1 }).success).toBe(false);
    expect(conversationQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });
  it("requires a reason and concurrency version for operator changes", () => {
    const assignment = { expectedVersion: 0, priority: "HIGH", assigneeId: null, dueAt: null, reason: "Уточнить сведения о поставке", idempotencyKey: id };
    expect(operationAssignmentSchema.safeParse(assignment).success).toBe(true);
    expect(operationAssignmentSchema.safeParse({ ...assignment, reason: "" }).success).toBe(false);
    expect(updateSupportTicketSchema.safeParse({ status: "CLOSED" }).success).toBe(false);
    expect(updateSupportTicketSchema.safeParse({ expectedVersion: 1, reason: "Вопрос решён оператором", idempotencyKey: id }).success).toBe(false);
  });
});
