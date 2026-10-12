import { describe, expect, it, vi } from "vitest";
import { ConversationsService } from "./conversations.service";

const context = { actorId: "actor", organizationId: "buyer" };
describe("conversation authorization boundaries", () => {
  it("denies revoked or unprivileged actors before loading conversation data", async () => {
    const findFirst = vi.fn();
    const service = new ConversationsService({ businessConversation: { findFirst } } as never, { hasAll: vi.fn().mockResolvedValue(false) } as never, {} as never, {} as never);
    await expect(service.get("conversation", context)).rejects.toThrow("permission");
    expect(findFirst).not.toHaveBeenCalled();
  });
  it("does not grant operators a conversation bypass without support management permission", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new ConversationsService({ organizationCapability: { findUnique: vi.fn().mockResolvedValue({}) }, businessConversation: { findFirst } } as never, { hasAll: vi.fn(async (_actor: string, _organization: string, permissions: string[]) => !permissions.includes("support.ticket.manage")) } as never, {} as never, {} as never);
    await expect(service.get("conversation", context)).rejects.toThrow("not found");
    expect(findFirst.mock.calls[0][0].where.OR).toEqual([{ buyerOrganizationId: "buyer" }, { supplierOrganizationId: "buyer" }]);
  });
  it("requires an escalation even for authorized operators", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new ConversationsService({ organizationCapability: { findUnique: vi.fn().mockResolvedValue({}) }, businessConversation: { findFirst } } as never, { hasAll: vi.fn().mockResolvedValue(true) } as never, {} as never, {} as never);
    await expect(service.get("conversation", { ...context, organizationId: "operator" })).rejects.toThrow("not found");
    expect(findFirst.mock.calls[0][0].where.OR).toContainEqual({ supportTicketId: { not: null } });
  });
  it("prevents suppliers from starting a cold offer conversation", async () => {
    const prisma = { organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) }, supplierOffer: { findFirst: vi.fn() } };
    const service = new ConversationsService(prisma as never, { hasAll: vi.fn().mockResolvedValue(true) } as never, {} as never, {} as never);
    await expect(service.start({ contextType: "OFFER", contextId: "offer", body: "Hello", idempotencyKey: "key" }, context)).rejects.toThrow("Only a buyer");
    expect(prisma.supplierOffer.findFirst).not.toHaveBeenCalled();
  });
  it("does not accept or read attachments before permission/participant authorization", async () => {
    const files = { upload: vi.fn(), download: vi.fn() };
    const db = { organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) }, businessConversation: { findFirst: vi.fn().mockResolvedValue(null) } };
    const denied = new ConversationsService(db as never, { hasAll: vi.fn().mockResolvedValue(false) } as never, files as never, {} as never);
    await expect(denied.uploadAttachment({ contextType: "OFFER", contextId: "offer", fileName: "a.pdf", contentBase64: "JVBERg==" }, context)).rejects.toThrow("permission");
    const allowed = new ConversationsService(db as never, { hasAll: vi.fn().mockResolvedValue(true) } as never, files as never, {} as never);
    await expect(allowed.downloadAttachment("foreign", "message", "asset", context)).rejects.toThrow("not found");
    expect(files.upload).not.toHaveBeenCalled();
    expect(files.download).not.toHaveBeenCalled();
  });
  it("returns authoritative product, variant, packaging and supplier before creating a conversation", async () => {
    const offer = { supplierOrganizationId: "supplier", supplierSku: "sku", supplier: { organization: { displayName: "Supplier" } },
      productVariant: { productId: "product", sku: "REF", externalMetadata: { label: "A2" }, product: { canonicalName: "Composite long", catalogName: "Composite", media: [] } },
      packaging: { name: "Шприц", quantityInBaseUnit: "4", unit: { symbol: "г" } }, saleUnit: null, baseUnitsPerSaleUnit: "1" };
    const db = { organizationCapability: { findUnique: vi.fn(async ({ where }) => where.organizationId_capability.capability === "BUYER" ? {} : null) },
      businessConversation: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() }, supplierOffer: { findFirst: vi.fn().mockResolvedValue(offer) } };
    const service = new ConversationsService(db as never, { hasAll: vi.fn().mockResolvedValue(true) } as never, {} as never, {} as never);
    expect(await service.lookup({ contextType: "OFFER", contextId: "offer" }, context)).toEqual({ conversationId: null, context: {
      title: "Предложение sku", counterpartyName: "Supplier", productId: "product", productName: "Composite", variantLabel: "A2", packagingLabel: "Шприц · 4 г", imageUrl: null,
    } });
    expect(db.businessConversation.create).not.toHaveBeenCalled();
    db.supplierOffer.findFirst.mockResolvedValueOnce(null);
    await expect(service.lookup({ contextType: "OFFER", contextId: "private-offer" }, context)).rejects.toThrow("Published offer not found");
    expect(db.supplierOffer.findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "private-offer", status: "ACTIVE", publication: { status: "PUBLISHED", marketplaceVisible: true } } }));
  });
  it("scopes an order context to the requesting party before revealing its counterparty", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new ConversationsService({ organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) }, businessConversation: { findFirst }, supplierOrder: { findFirst } } as never,
      { hasAll: vi.fn().mockResolvedValue(true) } as never, {} as never, {} as never);
    await expect(service.lookup({ contextType: "ORDER", contextId: "private-order" }, context)).rejects.toThrow("Order not found");
    expect(findFirst).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: "private-order", OR: [{ buyerOrganizationId: "buyer" }, { supplierOrganizationId: "buyer" }] } }));
  });
});
