import { describe, expect, it, vi } from "vitest";
import { ConversationsService } from "./conversations.service";
import { requirePublicDecision, syncConversationReview } from "./conversation-review";

const party = { actorId: "buyer-user", organizationId: "buyer" };
const operator = { actorId: "operator-user", organizationId: "operator" };
const conversation = { id: "chat", supportTicketId: "ticket", version: 3, resolved: false, buyerOrganizationId: "buyer", supplierOrganizationId: "supplier" };
function fixture(isOperator = false) {
  const ticket = { id: "ticket", status: "OPEN", organizationId: "buyer" };
  const tx = {
    $queryRaw: vi.fn(), $transaction: vi.fn(),
    organizationCapability: { findUnique: vi.fn().mockResolvedValue(isOperator ? {} : null) },
    businessConversation: { findFirst: vi.fn().mockResolvedValue(conversation), findUniqueOrThrow: vi.fn().mockResolvedValue(conversation), update: vi.fn().mockResolvedValue({ latestSequence: 7 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    supportTicket: { findUniqueOrThrow: vi.fn().mockResolvedValue(ticket), update: vi.fn().mockResolvedValue({ ...ticket, status: "RESOLVED" }) },
    user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ displayName: "Support" }) },
    conversationMessage: { create: vi.fn().mockResolvedValue({ id: "decision" }) },
    auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() },
  };
  tx.$transaction.mockImplementation(callback => callback(tx));
  return { tx, service: new ConversationsService(tx as never, { hasAll: vi.fn().mockResolvedValue(true) } as never, {} as never, {} as never) };
}
describe("moderated conversation lifecycle", () => {
  it("denies party resolution after escalation without mutating either state", async () => {
    const { service, tx } = fixture();
    await expect(service.resolve("chat", 3, party)).rejects.toThrow("оператор");
    expect(tx.supportTicket.update).not.toHaveBeenCalled();
    expect(tx.businessConversation.updateMany).not.toHaveBeenCalled();
  });
  it("rejects stale versions and missing public decisions", async () => {
    const { service, tx } = fixture(true);
    await expect(service.resolve("chat", 2, operator, "Публичное решение")).rejects.toThrow("changed");
    await expect(service.resolve("chat", 3, operator)).rejects.toThrow("решение оператора");
    expect(tx.supportTicket.update).not.toHaveBeenCalled();
  });
  it("resolves ticket and conversation together, publishing a decision to both parties", async () => {
    const { service, tx } = fixture(true);
    await service.resolve("chat", 3, operator, "Стороны согласовали замену товара.");
    expect(tx.supportTicket.update.mock.calls[0][0].data.status).toBe("RESOLVED");
    expect(tx.businessConversation.update.mock.calls[0][0].data.resolved).toBe(true);
    expect(tx.conversationMessage.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ body: "Решение оператора: Стороны согласовали замену товара.", authorRole: "OPERATOR", sequence: 7 }));
    expect(tx.outboxEvent.create.mock.calls[0][0].data.payload).toEqual(expect.objectContaining({ buyerOrganizationId: "buyer", supplierOrganizationId: "supplier" }));
  });
  it("does not demand a public decision for unrelated tickets or duplicate terminal transitions", () => {
    expect(() => requirePublicDecision(null, "OPEN", "CLOSED")).not.toThrow();
    expect(() => requirePublicDecision(conversation as never, "RESOLVED", "CLOSED")).not.toThrow();
    expect(() => requirePublicDecision(conversation as never, "OPEN", "CLOSED", "short")).toThrow();
  });
  it("reopens status without copying private ticket text or emitting a decision", async () => {
    const { tx } = fixture(true);
    await syncConversationReview(tx as never, { ...conversation, resolved: true } as never, { status: "CLOSED" } as never, { id: "ticket", status: "IN_PROGRESS" } as never, party);
    expect(tx.businessConversation.update.mock.calls[0][0].data.resolved).toBe(false);
    expect(tx.conversationMessage.create).not.toHaveBeenCalled();
  });
});
