import { describe, expect, it, vi } from "vitest";
import { ConversationsService } from "./conversations.service";

const context = { actorId: "actor", organizationId: "buyer" };
describe("conversation authorization boundaries", () => {
  it("denies revoked or unprivileged actors before loading conversation data", async () => {
    const findFirst = vi.fn();
    const service = new ConversationsService({ businessConversation: { findFirst } } as never, { hasAll: vi.fn().mockResolvedValue(false) } as never);
    await expect(service.get("conversation", context)).rejects.toThrow("permission");
    expect(findFirst).not.toHaveBeenCalled();
  });
  it("does not grant operators a conversation bypass without support management permission", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new ConversationsService({ organizationCapability: { findUnique: vi.fn().mockResolvedValue({}) }, businessConversation: { findFirst } } as never, { hasAll: vi.fn(async (_actor: string, _organization: string, permissions: string[]) => !permissions.includes("support.ticket.manage")) } as never);
    await expect(service.get("conversation", context)).rejects.toThrow("not found");
    expect(findFirst.mock.calls[0][0].where.OR).toEqual([{ buyerOrganizationId: "buyer" }, { supplierOrganizationId: "buyer" }]);
  });
  it("requires an escalation even for authorized operators", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new ConversationsService({ organizationCapability: { findUnique: vi.fn().mockResolvedValue({}) }, businessConversation: { findFirst } } as never, { hasAll: vi.fn().mockResolvedValue(true) } as never);
    await expect(service.get("conversation", { ...context, organizationId: "operator" })).rejects.toThrow("not found");
    expect(findFirst.mock.calls[0][0].where.OR).toContainEqual({ supportTicketId: { not: null } });
  });
  it("prevents suppliers from starting a cold offer conversation", async () => {
    const prisma = { organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) }, supplierOffer: { findFirst: vi.fn() } };
    const service = new ConversationsService(prisma as never, { hasAll: vi.fn().mockResolvedValue(true) } as never);
    await expect(service.start({ contextType: "OFFER", contextId: "offer", body: "Hello", idempotencyKey: "key" }, context)).rejects.toThrow("Only a buyer");
    expect(prisma.supplierOffer.findFirst).not.toHaveBeenCalled();
  });
});
